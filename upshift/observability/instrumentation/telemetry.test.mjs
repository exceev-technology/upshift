import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import http from 'node:http';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  createRequestTelemetry,
  readObservabilityConfiguration,
  requestRouteBucket,
} from './telemetry.mjs';

const FIXTURE = fileURLToPath(
  new URL('./fixtures/request-server.mjs', import.meta.url),
);
const PRELOAD = fileURLToPath(new URL('./preload.mjs', import.meta.url));

const receiver = async (context, statusCode = 200) => {
  const payloads = [];
  const server = http.createServer((request, response) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      payloads.push({
        signal: request.url,
        body: JSON.parse(Buffer.concat(chunks).toString()),
      });
      response
        .writeHead(
          typeof statusCode === 'function' ? statusCode(request.url) : statusCode,
        )
        .end('{}');
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  context.after(() => new Promise((resolve) => server.close(resolve)));
  return { payloads, endpoint: `http://127.0.0.1:${server.address().port}` };
};

const application = async (context, endpoint, overrides = {}) => {
  const processEnvironment = { ...process.env };
  for (const key of Object.keys(processEnvironment)) {
    if (
      key.startsWith('UPSHIFT_OBSERVABILITY_') ||
      key === 'UPSHIFT_OTLP_ENDPOINT' ||
      key === 'NODE_OPTIONS'
    )
      delete processEnvironment[key];
  }
  const child = fork(FIXTURE, [], {
    execArgv: ['--import', PRELOAD],
    env: {
      ...processEnvironment,
      UPSHIFT_OBSERVABILITY_ENABLED: 'true',
      UPSHIFT_OTLP_ENDPOINT: endpoint,
      UPSHIFT_OBSERVABILITY_ENVIRONMENT: 'test',
      UPSHIFT_TRACE_SAMPLE_RATE: '1',
      ...overrides,
    },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  let output = '';
  child.stderr.on('data', (chunk) => {
    output += chunk;
  });
  child.stdout.on('data', (chunk) => {
    output += chunk;
  });
  const [message] = await once(child, 'message');
  context.after(async () => {
    if (child.exitCode === null) {
      child.send('close');
      await once(child, 'exit');
    }
    assert.equal(output, '');
  });
  return {
    endpoint: `http://127.0.0.1:${message.port}`,
    flush: async () => {
      child.send('flush');
      const [message] = await once(child, 'message');
      assert.equal(message.flushed, true);
    },
  };
};

const records = (payloads, signal) =>
  payloads
    .filter((payload) => payload.signal === `/v1/${signal}`)
    .flatMap(({ body }) => {
      if (signal === 'traces')
        return body.resourceSpans.flatMap(({ scopeSpans }) =>
          scopeSpans.flatMap(({ spans }) => spans),
        );
      if (signal === 'logs')
        return body.resourceLogs.flatMap(({ scopeLogs }) =>
          scopeLogs.flatMap(({ logRecords }) => logRecords),
        );
      return body.resourceMetrics.flatMap(({ scopeMetrics }) =>
        scopeMetrics.flatMap(({ metrics }) => metrics),
      );
    });

test('configuration requires explicit opt-in and only a local collector origin', () => {
  const enabled = {
    UPSHIFT_OBSERVABILITY_ENABLED: 'true',
    UPSHIFT_OTLP_ENDPOINT: 'http://alloy:4318',
  };
  assert.equal(readObservabilityConfiguration({}), null);
  assert.equal(
    readObservabilityConfiguration({
      ...enabled,
      UPSHIFT_OBSERVABILITY_ENABLED: 'TRUE',
    }),
    null,
  );
  assert.equal(
    readObservabilityConfiguration(enabled).serviceName,
    'upshift-server',
  );
  for (const endpoint of [
    'https://alloy:4318',
    'http://alloy',
    'http://alloy:4318/v1/traces',
    'http://user:password@alloy:4318',
    'http://alloy:4318?token=secret',
    'http://alloy:4318#secret',
    'http://twenty.com:4318',
    'http://api.twenty.com:4318',
    'http://evil.example:4318',
  ]) {
    assert.equal(
      readObservabilityConfiguration({
        ...enabled,
        UPSHIFT_OTLP_ENDPOINT: endpoint,
      }),
      null,
      endpoint,
    );
  }
  assert.equal(
    readObservabilityConfiguration({
      ...enabled,
      UPSHIFT_OBSERVABILITY_ENVIRONMENT: 'customer-email@example.org',
    }),
    null,
  );
  assert.equal(
    readObservabilityConfiguration({
      ...enabled,
      UPSHIFT_OBSERVABILITY_SERVICE: 'user-123',
    }),
    null,
  );
  assert.equal(
    readObservabilityConfiguration({
      ...enabled,
      UPSHIFT_TRACE_SAMPLE_RATE: 'NaN',
    }),
    null,
  );
});

test('request buckets never include customer path components or queries', () => {
  assert.equal(
    requestRouteBucket('/rest/people/user-123?email=secret@example.org'),
    '/rest/*',
  );
  assert.equal(requestRouteBucket('/auth/token/secret'), '/auth/*');
  assert.equal(requestRouteBucket('/private/secret@example.org'), '/other');
  assert.equal(requestRouteBucket('/graphql?query=secret'), '/graphql');
});

test('real Node preload exports correlated safe logs, traces and cumulative metrics', async (context) => {
  const collector = await receiver(context);
  const app = await application(context, collector.endpoint);
  const secret = 'private-person@example.org';
  const response = await fetch(
    `${app.endpoint}/rest/people/${secret}?fail=1&token=secret-token`,
    {
      method: 'POST',
      headers: { authorization: 'Bearer secret-token', 'x-request-id': secret },
      body: secret,
    },
  );
  assert.equal(response.status, 500);
  assert.equal(await response.text(), 'application response remains intact');
  await app.flush();
  const spans = records(collector.payloads, 'traces');
  const logs = records(collector.payloads, 'logs');
  const metrics = records(collector.payloads, 'metrics');
  assert.equal(spans.length, 1);
  assert.equal(logs.length, 1);
  assert.equal(spans[0].name, 'POST /rest/*');
  assert.equal(spans[0].status.code, 2);
  assert.equal(spans[0].traceId, logs[0].traceId);
  assert.match(spans[0].traceId, /^[a-f0-9]{32}$/);
  assert.equal(logs[0].body.stringValue, 'http_request_completed');
  assert.equal(logs[0].severityText, 'ERROR');
  const count = metrics.find(({ name }) => name === 'upshift_http_requests');
  assert.equal(count.sum.isMonotonic, true);
  assert.equal(count.sum.aggregationTemporality, 2);
  assert.equal(count.sum.dataPoints[0].asInt, '1');
  const histogram = metrics.find(
    ({ name }) => name === 'upshift_http_request_duration_seconds',
  );
  assert.equal(histogram.histogram.dataPoints[0].count, '1');
  assert.ok(histogram.histogram.dataPoints[0].sum >= 0);
  assert.equal(
    histogram.histogram.dataPoints[0].bucketCounts.reduce(
      (sum, count) => sum + Number(count),
      0,
    ),
    1,
  );
  assert.ok(
    metrics.some(({ name }) => name === 'upshift_process_memory_bytes'),
  );
  assert.ok(
    metrics.some(({ name }) => name === 'upshift_process_uptime_seconds'),
  );
  const serialized = JSON.stringify(collector.payloads);
  for (const sensitiveValue of [
    secret,
    'secret-token',
    'authorization',
    'x-request-id',
    'url.full',
    'user.id',
    'db.statement',
  ])
    assert.ok(!serialized.includes(sensitiveValue), sensitiveValue);
});

test('zero sampling keeps errors and metrics while omitting successful health and requests', async (context) => {
  const collector = await receiver(context);
  const app = await application(context, collector.endpoint, {
    UPSHIFT_TRACE_SAMPLE_RATE: '0',
  });
  for (const path of ['/healthz', '/metrics', '/graphql', '/healthz?fail=1'])
    await fetch(`${app.endpoint}${path}`);
  await app.flush();
  assert.deepEqual(
    records(collector.payloads, 'traces').map(({ name }) => name),
    ['GET /healthz'],
  );
  assert.equal(records(collector.payloads, 'logs').length, 1);
  const count = records(collector.payloads, 'metrics').find(
    ({ name }) => name === 'upshift_http_requests',
  );
  assert.equal(
    count.sum.dataPoints.reduce((sum, point) => sum + Number(point.asInt), 0),
    2,
  );
});

test('disabled preload performs no export and preserves normal application responses', async (context) => {
  const collector = await receiver(context);
  const app = await application(context, collector.endpoint, {
    UPSHIFT_OBSERVABILITY_ENABLED: 'false',
  });
  assert.equal((await fetch(`${app.endpoint}/graphql?fail=1`)).status, 500);
  await app.flush();
  assert.equal(collector.payloads.length, 0);
});

test('one flush drains a full burst in bounded batches', async (context) => {
  const collector = await receiver(context);
  const telemetry = createRequestTelemetry({
    endpoint: collector.endpoint,
    environmentName: 'test',
    serviceName: 'upshift-server',
    sampleRate: 1,
  });
  context.after(telemetry.close);
  for (let index = 0; index < 256; index++)
    telemetry.begin({ method: 'POST', url: '/graphql' })(500);

  await telemetry.flush();

  assert.equal(telemetry.queueStatus().pendingEvents, 0);
  assert.equal(telemetry.queueStatus().droppedEvents, 0);
  assert.equal(records(collector.payloads, 'traces').length, 256);
  assert.equal(records(collector.payloads, 'logs').length, 256);
  assert.equal(
    collector.payloads.filter(({ signal }) => signal === '/v1/traces').length,
    8,
  );
  assert.equal(
    collector.payloads.filter(({ signal }) => signal === '/v1/metrics').length,
    1,
  );
  assert.ok(
    collector.payloads
      .filter(({ signal }) => signal === '/v1/traces')
      .every(
        ({ body }) => body.resourceSpans[0].scopeSpans[0].spans.length === 32,
      ),
  );
});

test('metrics requested during an active event flush are still exported', async (context) => {
  const collector = await receiver(context);
  const telemetry = createRequestTelemetry({
    endpoint: collector.endpoint,
    environmentName: 'test',
    serviceName: 'upshift-server',
    sampleRate: 1,
  });
  context.after(telemetry.close);
  telemetry.begin({ method: 'GET', url: '/graphql' })(200);
  const eventsFlush = telemetry.flush(false);
  await telemetry.flush(true);
  await eventsFlush;
  assert.ok(records(collector.payloads, 'metrics').some(
    ({ name }) => name === 'upshift_telemetry_dropped_events',
  ));
});

test('collector failure keeps the remaining queue and reports queue and export losses', async (context) => {
  const collector = await receiver(context, 503);
  const telemetry = createRequestTelemetry({
    endpoint: collector.endpoint,
    environmentName: 'test',
    serviceName: 'upshift-server',
    sampleRate: 1,
  });
  context.after(telemetry.close);
  for (let index = 0; index < 400; index++)
    telemetry.begin({ method: 'POST', url: `/rest/people/private-${index}` })(
      500,
    );
  assert.equal(telemetry.queueStatus().pendingEvents, 256);
  assert.equal(telemetry.queueStatus().droppedEvents, 144);
  assert.equal(telemetry.queueStatus().metricSeries, 1);
  await telemetry.flush();
  assert.equal(telemetry.queueStatus().pendingEvents, 224);
  assert.equal(telemetry.queueStatus().droppedEvents, 176);
  assert.equal(
    collector.payloads.filter(({ signal }) => signal === '/v1/traces').length,
    3,
  );
  assert.equal(
    collector.payloads.filter(({ signal }) => signal === '/v1/logs').length,
    3,
  );
  assert.equal(
    collector.payloads.filter(({ signal }) => signal === '/v1/metrics').length,
    3,
  );
  assert.ok(
    collector.payloads
      .filter(({ signal }) => signal === '/v1/traces')
      .every(
        ({ body }) => body.resourceSpans[0].scopeSpans[0].spans.length === 32,
      ),
  );
  const dropped = records(collector.payloads, 'metrics').find(
    ({ name }) => name === 'upshift_telemetry_dropped_events',
  );
  assert.equal(dropped.sum.isMonotonic, true);
  assert.equal(dropped.sum.aggregationTemporality, 2);
  assert.equal(dropped.sum.dataPoints[0].asInt, '176');
});

test('losing one signal counts each affected request once', async (context) => {
  const collector = await receiver(context, (signal) =>
    signal === '/v1/logs' ? 400 : 200,
  );
  const telemetry = createRequestTelemetry({
    endpoint: collector.endpoint,
    environmentName: 'test',
    serviceName: 'upshift-server',
    sampleRate: 1,
  });
  context.after(telemetry.close);
  for (let index = 0; index < 64; index++)
    telemetry.begin({ method: 'GET', url: '/graphql' })(200);

  await telemetry.flush();

  assert.equal(telemetry.queueStatus().pendingEvents, 32);
  assert.equal(telemetry.queueStatus().droppedEvents, 32);
  assert.equal(records(collector.payloads, 'traces').length, 32);
  assert.equal(records(collector.payloads, 'logs').length, 32);
  const dropped = records(collector.payloads, 'metrics').find(
    ({ name }) => name === 'upshift_telemetry_dropped_events',
  );
  assert.equal(dropped.sum.dataPoints[0].asInt, '32');
});
