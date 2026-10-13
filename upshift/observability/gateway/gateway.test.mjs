import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { gzipSync } from 'node:zlib';
import test from 'node:test';
import { hashToken, parseTenants, datasourceConfiguration } from './config.mjs';
import { createGateway } from './gateway.mjs';
import { measureStorage } from './storage.mjs';
import { sanitizePayload } from './privacy.mjs';

const TOKEN = 'a'.repeat(43);
const tenants = parseTenants(
  JSON.stringify([
    { id: 'client-a', tokenSha256: hashToken(TOKEN), budgetBytes: 1048576 },
    {
      id: 'client-b',
      tokenSha256: hashToken('b'.repeat(43)),
      budgetBytes: 1048576,
    },
  ]),
);
const resource = {
  attributes: [
    { key: 'service.name', value: { stringValue: 'upshift-server' } },
    { key: 'deployment.environment.name', value: { stringValue: 'test' } },
    { key: 'upshift.observability.schema', value: { stringValue: '1' } },
  ],
};
const payload = {
  resourceLogs: [
    {
      resource,
      scopeLogs: [
        {
          scope: { name: 'upshift.observability' },
          logRecords: [
            {
              body: { stringValue: 'http_request_completed' },
              timeUnixNano: '1',
            },
          ],
        },
      ],
    },
  ],
};
const fixture = async (context) => {
  const calls = [];
  const requests = [];
  let snapshot = {
    measuredAt: Date.now(),
    usedRatio: 0.2,
    retained: {
      'client-a': { logs: 0, traces: 0, metrics: 0 },
      'client-b': { logs: 0 },
    },
  };
  const server = createGateway({
    tenants,
    getSnapshot: () => snapshot,
    forward: async (...argumentsList) => {
      calls.push(argumentsList);
      return new Response('{}');
    },
  });
  server.on('request', (request) => requests.push(request));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  context.after(
    () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  );
  const url = `http://127.0.0.1:${server.address().port}`;
  const send = (
    body = JSON.stringify(payload),
    headers = {},
    path = '/v1/logs',
  ) =>
    fetch(`${url}${path}`, {
      method: 'POST',
      body,
      headers: {
        authorization: `Bearer ${TOKEN}`,
        'content-type': 'application/json',
        ...headers,
      },
    });
  return {
    calls,
    requests,
    send,
    url,
    setSnapshot: (value) => {
      snapshot = { ...snapshot, ...value };
    },
  };
};

test('tenants require unique hashed tokens and safe identifiers', () => {
  assert.throws(() => parseTenants('[]'));
  for (const id of ['../a', 'a|b', 'fake', 'A', 'x\nsecret', 'a'.repeat(33)])
    assert.throws(() =>
      parseTenants(JSON.stringify([{ id, tokenSha256: hashToken(TOKEN) }])),
    );
  assert.throws(() => parseTenants(JSON.stringify([tenants[0], tenants[0]])));
  const configuration = datasourceConfiguration(tenants);
  assert.equal(configuration.datasources.length, 7);
  assert.equal(
    configuration.datasources.find(({ uid }) => uid === 'client-a-logs')
      .secureJsonData.httpHeaderValue1,
    'client-a',
  );
  assert.ok(!JSON.stringify(configuration).includes(TOKEN));
});

test('authentication maps tenant, strips spoofed headers and rejects every read route', async (context) => {
  const gateway = await fixture(context);
  assert.equal((await gateway.send()).status, 200);
  assert.equal(
    (
      await gateway.send(undefined, {
        'X-Scope-OrgID': 'client-b',
        cookie: 'secret',
        'x-forwarded-for': 'sensitive',
      })
    ).status,
    200,
  );
  for (const [, options] of gateway.calls) {
    assert.deepEqual(options.headers, {
      'Content-Type': 'application/json',
      'X-Scope-OrgID': 'client-a',
    });
    assert.equal(options.redirect, 'error');
  }
  assert.equal(
    (await gateway.send(undefined, { authorization: 'Bearer wrong' })).status,
    401,
  );
  assert.equal(
    (await gateway.send(undefined, {}, '/v1/logs?tenant=client-b')).status,
    404,
  );
  for (const path of [
    '/metrics',
    '/loki/api/v1/query',
    '/prometheus/api/v1/query',
    '/api/traces/id',
  ])
    assert.equal((await fetch(`${gateway.url}${path}`)).status, 404);
  assert.equal(gateway.calls.length, 2);
});

test('budget, stale inventory and disk gates block only when required and recover', async (context) => {
  const gateway = await fixture(context);
  gateway.setSnapshot({ retained: { 'client-a': { logs: 1048576 } } });
  assert.equal((await gateway.send()).status, 429);
  assert.equal(
    (
      await gateway.send(undefined, {
        authorization: `Bearer ${'b'.repeat(43)}`,
      })
    ).status,
    200,
  );
  gateway.setSnapshot({
    retained: { 'client-a': { logs: 0 } },
    usedRatio: 0.91,
  });
  assert.equal((await gateway.send()).status, 503);
  gateway.setSnapshot({ usedRatio: 0.2, measuredAt: Date.now() - 180001 });
  assert.equal((await gateway.send()).status, 503);
  gateway.setSnapshot({ measuredAt: Date.now() });
  assert.equal((await gateway.send()).status, 200);
});

test('gzip expands within a strict bound and rate counts uncompressed bytes across requests', async (context) => {
  const gateway = await fixture(context);
  assert.equal(
    (
      await gateway.send(gzipSync(JSON.stringify(payload)), {
        'content-encoding': 'gzip',
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await gateway.send(gzipSync(' '.repeat(1048577)), {
        'content-encoding': 'gzip',
      })
    ).status,
    413,
  );
  assert.equal(
    (await gateway.send('{}', { 'content-type': 'application/x-protobuf' }))
      .status,
    415,
  );
  assert.equal((await gateway.send('invalid json')).status, 400);
  const padded = JSON.stringify({ ...payload, ignored: 'x'.repeat(650000) });
  assert.equal((await gateway.send(padded)).status, 200);
  assert.equal((await gateway.send(padded)).status, 429);
});

test('incremental oversized uploads receive 413 and release in-flight capacity', async (context) => {
  const gateway = await fixture(context);
  const uploads = [];
  context.after(() => uploads.forEach((upload) => upload.destroy()));

  for (let index = 0; index < 4; index++) {
    const upload = httpRequest(`${gateway.url}/v1/logs`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${TOKEN}`,
        'content-type': 'application/json',
        'transfer-encoding': 'chunked',
      },
    });
    uploads.push(upload);
    upload.write(Buffer.alloc(512 * 1024, ' '));
    await new Promise((resolve) => setImmediate(resolve));
    upload.write(Buffer.alloc(512 * 1024 + 1, ' '));

    const [response] = await once(upload, 'response', {
      signal: AbortSignal.timeout(3000),
    });
    response.resume();
    await once(response, 'end');
    assert.equal(response.statusCode, 413);
    assert.equal(gateway.requests.at(-1).destroyed, false);
    upload.end(Buffer.alloc(512, ' '));
    await once(upload, 'finish');
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(upload.socket.destroyed, false);
  }

  assert.equal((await gateway.send()).status, 200);
  assert.equal(gateway.calls.length, 1);
});

test('oversized OTLP record and datapoint arrays are rejected instead of acknowledged', async (context) => {
  const gateway = await fixture(context);
  for (const length of [1024, 1025]) {
    const logs = structuredClone(payload);
    const records = logs.resourceLogs[0].scopeLogs[0].logRecords;
    logs.resourceLogs[0].scopeLogs[0].logRecords = Array(length).fill(records[0]);
    const metrics = {
      resourceMetrics: [{
        resource,
        scopeMetrics: [{
          scope: { name: 'upshift.observability' },
          metrics: [{
            name: 'upshift_process_memory_bytes',
            gauge: { dataPoints: Array(length).fill({ timeUnixNano: '1', asDouble: 1 }) },
          }],
        }],
      }],
    };
    for (const [signal, body] of [['logs', logs], ['metrics', metrics]]) {
      const response = await gateway.send(JSON.stringify(body), {}, `/v1/${signal}`);
      assert.equal(response.status, length === 1024 ? 200 : 400);
    }
  }
  assert.equal(gateway.calls.length, 2);
});

test('storage accounting paginates and attributes Loki indexes plus all three signal buckets', async () => {
  const calls = [];
  const snapshot = await measureStorage({
    tenants,
    now: () => 1234,
    diskUsage: async () => 0.4,
    listObjects: async (signal, token) => {
      calls.push([signal, token]);
      if (signal === 'logs' && !token)
        return {
          Contents: [
            { Key: 'client-a/chunk', Size: 10 },
            { Key: 'index/index_20000/client-a/index', Size: 5 },
          ],
          IsTruncated: true,
          NextContinuationToken: 'page2',
        };
      if (signal === 'logs')
        return {
          Contents: [
            { Key: 'shared-metadata', Size: 3 },
            { Key: 'client-b/chunk', Size: 7 },
          ],
        };
      return { Contents: [{ Key: 'client-a/block/meta.json', Size: 20 }] };
    },
  });
  assert.deepEqual(snapshot.retained['client-a'], {
    logs: 15,
    traces: 20,
    metrics: 20,
  });
  assert.equal(snapshot.unattributed.logs, 3);
  assert.equal(snapshot.retained['client-b'].logs, 7);
  assert.equal(calls.length, 4);
  await assert.rejects(
    measureStorage({
      tenants,
      diskUsage: async () => 0.2,
      listObjects: async () => ({ IsTruncated: true }),
    }),
  );
});

test('wire allowlist discards bodies, exception text, links, events, identifiers and unsafe dimensions', () => {
  const secret = 'person@example.com';
  const resourceWithSecrets = {
    attributes: [
      ...resource.attributes,
      { key: 'user.email', value: { stringValue: secret } },
    ],
  };
  const attributes = [
    { key: 'http.route', value: { stringValue: `/people/${secret}` } },
    { key: 'http.request.method', value: { stringValue: secret } },
    { key: 'db.statement', value: { stringValue: secret } },
  ];
  const trace = sanitizePayload('traces', {
    resourceSpans: [
      {
        resource: resourceWithSecrets,
        scopeSpans: [
          {
            scope: { name: 'upshift.observability', version: secret },
            spans: [
              {
                traceId: secret,
                spanId: secret,
                name: secret,
                attributes,
                events: [{ name: secret }],
                links: [{ traceState: secret }],
                status: { message: secret },
              },
            ],
          },
        ],
      },
    ],
  });
  assert.ok(!JSON.stringify(trace).includes(secret));
  assert.equal(
    trace.resourceSpans[0].scopeSpans[0].spans[0].name,
    'OTHER /other',
  );
  const logs = structuredClone(payload);
  logs.resourceLogs[0].scopeLogs[0].logRecords[0].body = {
    stringValue: secret,
  };
  assert.ok(!JSON.stringify(sanitizePayload('logs', logs)).includes(secret));
});
