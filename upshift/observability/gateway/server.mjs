import { createServer } from 'node:http';
import { mkdir, statfs, writeFile, rename } from 'node:fs/promises';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { parseTenants, datasourceConfiguration } from './config.mjs';
import { createGateway } from './gateway.mjs';
import { measureStorage, renderMetrics } from './storage.mjs';

const tenants = parseTenants(process.env.MONITORING_TENANTS_JSON);
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT ?? 'http://object-storage:8333',
  region: 'us-east-1',
  forcePathStyle: true,
  maxAttempts: 2,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
});
const counters = new Map();
let snapshot;
let scanning = false;
const refresh = async () => {
  if (scanning) return;
  scanning = true;
  try {
    snapshot = await measureStorage({
      tenants,
      listObjects: (signal, continuationToken) =>
        s3.send(
          new ListObjectsV2Command({
            Bucket: `upshift-${signal}`,
            ContinuationToken: continuationToken,
          }),
          { abortSignal: AbortSignal.timeout(15000) },
        ),
      diskUsage: async () => {
        const filesystem = await statfs('/storage');
        return 1 - filesystem.bavail / filesystem.blocks;
      },
    });
  } catch {
    console.error(
      'Monitoring storage inventory failed; ingestion stops when inventory expires.',
    );
  } finally {
    scanning = false;
  }
};
await mkdir('/app/provisioning', { recursive: true });
await writeFile(
  '/app/provisioning/tenants.tmp',
  JSON.stringify(datasourceConfiguration(tenants), null, 2),
  { mode: 0o644 },
);
await rename('/app/provisioning/tenants.tmp', '/app/provisioning/tenants.yaml');
const gateway = createGateway({
  tenants,
  counters,
  getSnapshot: () => snapshot,
});
gateway.listen(8080, '0.0.0.0');
const metrics = createServer((request, response) => {
  if (request.url !== '/metrics' || request.method !== 'GET') {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
  response.end(renderMetrics(tenants, snapshot, counters));
});
metrics.listen(9090, '0.0.0.0');
await refresh();
const interval = setInterval(refresh, 60000);
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () => {
    clearInterval(interval);
    s3.destroy();
    gateway.close();
    metrics.close();
    setTimeout(() => process.exit(0), 11000).unref();
  });
