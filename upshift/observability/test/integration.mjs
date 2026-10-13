import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { setTimeout } from 'node:timers/promises';
import { installRequestObservability } from '/instrumentation/preload.mjs';

const waitFor = async (name, check, attempts = 90) => {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const result = await check();
      if (result) {
        console.log(`PASS ${name}`);
        return result;
      }
    } catch {}
    await setTimeout(1000);
  }
  throw new Error(`Timed out: ${name}`);
};
for (const url of [
  'http://loki:3100/ready',
  'http://tempo:3200/ready',
  'http://mimir:9009/ready',
  'http://gateway:8080/healthz',
  'http://alloy:12345/-/ready',
  'http://grafana:3000/api/health',
]) {
  await waitFor(
    url,
    async () => (await fetch(url, { signal: AbortSignal.timeout(2000) })).ok,
  );
}
const telemetry = installRequestObservability({
  UPSHIFT_OBSERVABILITY_ENABLED: 'true',
  UPSHIFT_OTLP_ENDPOINT: 'http://alloy:4318',
  UPSHIFT_TRACE_SAMPLE_RATE: '1',
  UPSHIFT_OBSERVABILITY_ENVIRONMENT: 'test',
});
const application = http.createServer((request, response) => {
  request.resume();
  response.writeHead(500).end('private response');
});
application.listen(0, '127.0.0.1');
await once(application, 'listening');
const secret = 'do-not-export@example.com';
await fetch(
  `http://127.0.0.1:${application.address().port}/rest/people/${secret}?password=private`,
  {
    method: 'POST',
    body: 'private AI prompt',
    headers: { authorization: 'Bearer private-token' },
  },
);
await telemetry.flush();
telemetry.close();
application.closeAllConnections();
await new Promise((resolve) => application.close(resolve));
const query = async (url, client = 'client-a') => {
  const response = await fetch(url, {
    headers: { 'X-Scope-OrgID': client },
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(response.status, 200);
  return response.json();
};
const logUrl = `http://loki:3100/loki/api/v1/query_range?query=${encodeURIComponent('{service_name="upshift-server"}')}`;
const logData = await waitFor('Loki stored the operational log', async () => {
  const result = await query(logUrl);
  return result.data.result.length > 0 && result;
});
assert.equal((await query(logUrl, 'client-b')).data.result.length, 0);
assert.ok(!JSON.stringify(logData).includes(secret));
const traceData = await waitFor('Tempo stored the request span', async () => {
  const result = await query('http://tempo:3200/api/search');
  return result.traces?.length > 0 && result;
});
assert.equal(
  (await query('http://tempo:3200/api/search', 'client-b')).traces?.length ?? 0,
  0,
);
assert.ok(!JSON.stringify(traceData).includes(secret));
const metricUrl =
  'http://mimir:9009/prometheus/api/v1/query?query=upshift_http_requests';
await waitFor('Mimir stored cumulative request metrics', async () =>
  (await query(metricUrl)).data.result.some(
    ({ value }) => Number(value[1]) >= 1,
  ),
);
assert.equal((await query(metricUrl, 'client-b')).data.result.length, 0);
await waitFor('Mimir stored application telemetry loss counter', async () =>
  (await query('http://mimir:9009/prometheus/api/v1/query?query=upshift_telemetry_dropped_events'))
    .data.result.some(({ value }) => Number(value[1]) === 0),
);
console.log('PASS all three backends isolate client-b from client-a');
for (const path of ['/metrics', '/api/search', '/loki/api/v1/query'])
  assert.equal((await fetch(`http://gateway:8080${path}`)).status, 404);
assert.equal(
  (await fetch('http://gateway:8080/v1/logs', { method: 'POST', body: '{}' }))
    .status,
  401,
);
const grafana = await fetch('http://grafana:3000/api/datasources', {
  headers: {
    authorization: `Basic ${Buffer.from(`admin:${process.env.GRAFANA_ADMIN_PASSWORD}`).toString('base64')}`,
  },
});
assert.equal(grafana.status, 200);
assert.equal((await grafana.json()).length, 7);
console.log(
  'PASS authenticated Grafana provisioned both clients and infrastructure',
);
const alert = await fetch('http://alertmanager:9093/api/v2/alerts', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify([
    {
      labels: { alertname: 'MonitoringSmokeTest', severity: 'warning' },
      annotations: { summary: 'Synthetic local smoke test' },
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 120000).toISOString(),
    },
  ]),
});
assert.equal(alert.ok, true);
await waitFor(
  'Alertmanager delivered a notification to the local test sink',
  async () =>
    (await (await fetch('http://alert-sink:8080')).json()).received > 0,
  45,
);
const { S3Client, PutObjectCommand, DeleteObjectCommand } =
  createRequire('/app/package.json')('@aws-sdk/client-s3');
const storage = new S3Client({
  endpoint: 'http://object-storage:8333',
  region: 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
});
// This test owns this synthetic object; it is never a backend-created block or index.
const fixture = {
  Bucket: 'upshift-logs',
  Key: 'client-b/smoke-budget-fixture',
};
await storage.send(
  new PutObjectCommand({ ...fixture, Body: Buffer.alloc(1048576) }),
);
const deniedRequest = () =>
  fetch('http://gateway:8080/v1/logs', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.TEST_OTHER_TOKEN}`,
      'content-type': 'application/json',
    },
    body: '{}',
  });
await waitFor(
  'real object inventory enforces the combined retained budget',
  async () => (await deniedRequest()).status === 429,
);
await storage.send(new DeleteObjectCommand(fixture));
await waitFor(
  'ingestion budget recovers after the owned fixture is removed',
  async () => (await deniedRequest()).status === 400,
);
storage.destroy();
console.log('Monitoring integration passed.');
