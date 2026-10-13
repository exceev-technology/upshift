import { createServer } from 'node:http';
import { gunzip } from 'node:zlib';
import { promisify } from 'node:util';
import { hashToken } from './config.mjs';
import { sanitizePayload } from './privacy.mjs';

const decompress = promisify(gunzip);
const MAX_BODY_BYTES = 1024 * 1024;
const RATE_BYTES_PER_SECOND = 128 * 1024;
const MAX_INFLIGHT_PER_TENANT = 4;
const MAX_INFLIGHT_GLOBAL = 32;
const ROUTES = new Map([
  [
    '/v1/logs',
    { signal: 'logs', destination: 'http://loki:3100/otlp/v1/logs' },
  ],
  [
    '/v1/traces',
    { signal: 'traces', destination: 'http://tempo:4318/v1/traces' },
  ],
  [
    '/v1/metrics',
    { signal: 'metrics', destination: 'http://mimir:9009/otlp/v1/metrics' },
  ],
]);

export const createGateway = ({
  tenants,
  getSnapshot,
  counters = new Map(),
  forward = fetch,
  now = Date.now,
}) => {
  const credentials = new Map(
    tenants.map((tenant) => [tenant.tokenSha256, tenant]),
  );
  const limits = new Map(
    tenants.map(({ id }) => [
      id,
      { remaining: MAX_BODY_BYTES, updatedAt: now(), inflight: 0 },
    ]),
  );
  let inflight = 0;
  const respond = (response, status, retry = false) => {
    if (response.destroyed) return;
    response.writeHead(status, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...(retry ? { 'Retry-After': '60' } : {}),
    });
    response.end(
      status === 200
        ? '{}'
        : JSON.stringify({ error: 'Monitoring request rejected', status }),
    );
  };
  const server = createServer(
    { maxHeaderSize: 8192, requestTimeout: 10000, headersTimeout: 10000 },
    async (request, response) => {
      const snapshot = getSnapshot();
      const fresh = snapshot && now() - snapshot.measuredAt < 180000;
      if (request.method === 'GET' && request.url === '/healthz') {
        respond(response, fresh ? 200 : 503);
        return;
      }
      const route = ROUTES.get(request.url);
      if (request.method !== 'POST' || !route) {
        respond(response, 404);
        request.resume();
        return;
      }
      const authorization = request.headers.authorization ?? '';
      const tenant = /^Bearer [A-Za-z0-9_-]{43,128}$/.test(authorization)
        ? credentials.get(hashToken(authorization.slice(7)))
        : undefined;
      if (!tenant) {
        respond(response, 401);
        request.resume();
        return;
      }
      const record = (outcome) => {
        const key = `${tenant.id}|${route.signal}|${outcome}`;
        counters.set(key, (counters.get(key) ?? 0) + 1);
      };
      const reject = (status, outcome) => {
        record(outcome);
        respond(response, status, [429, 503].includes(status));
        request.resume();
      };
      if (!fresh) {
        reject(503, 'stale_inventory');
        return;
      }
      if (snapshot.usedRatio >= 0.9) {
        reject(503, 'disk_budget');
        return;
      }
      const retained = Object.values(snapshot.retained[tenant.id] ?? {}).reduce(
        (total, value) => total + value,
        0,
      );
      if (retained >= tenant.budgetBytes) {
        reject(429, 'tenant_budget');
        return;
      }
      const contentType = request.headers['content-type']?.split(';')[0];
      if (contentType !== 'application/json') {
        reject(415, 'content_type');
        return;
      }
      if (
        request.headers['content-encoding'] &&
        request.headers['content-encoding'] !== 'gzip'
      ) {
        reject(415, 'encoding');
        return;
      }
      const limit = limits.get(tenant.id);
      if (
        limit.inflight >= MAX_INFLIGHT_PER_TENANT ||
        inflight >= MAX_INFLIGHT_GLOBAL
      ) {
        reject(429, 'concurrency');
        return;
      }
      limit.inflight++;
      inflight++;
      const deadline = setTimeout(() => request.destroy(), 10000);
      try {
        const chunks = [];
        let size = 0;
        // Keep the upload readable so a size rejection can flush before remaining bytes are drained.
        for await (const chunk of request.iterator({ destroyOnReturn: false })) {
          size += chunk.length;
          if (size > MAX_BODY_BYTES) {
            reject(413, 'body_size');
            return;
          }
          chunks.push(chunk);
        }
        let body = Buffer.concat(chunks);
        if (request.headers['content-encoding'] === 'gzip') {
          try {
            body = await decompress(body, { maxOutputLength: MAX_BODY_BYTES });
          } catch {
            reject(413, 'body_size');
            return;
          }
        }
        limit.remaining = Math.min(
          MAX_BODY_BYTES,
          limit.remaining +
            ((now() - limit.updatedAt) / 1000) * RATE_BYTES_PER_SECOND,
        );
        limit.updatedAt = now();
        if (body.length > limit.remaining) {
          reject(429, 'rate');
          return;
        }
        limit.remaining -= body.length;
        try {
          body = Buffer.from(
            JSON.stringify(sanitizePayload(route.signal, JSON.parse(body))),
          );
        } catch {
          reject(400, 'invalid_payload');
          return;
        }
        // Never pass caller headers or follow a redirect to a different destination.
        const result = await forward(route.destination, {
          method: 'POST',
          body,
          redirect: 'error',
          signal: AbortSignal.timeout(10000),
          headers: { 'Content-Type': contentType, 'X-Scope-OrgID': tenant.id },
        });
        const status =
          result.status >= 200 && result.status < 300
            ? 200
            : result.status === 429
              ? 429
              : result.status >= 500
                ? 503
                : 400;
        // OTLP partial-success responses need to reach the collector; bound and redact the error text.
        let payload = '{}';
        if (status === 200 && contentType === 'application/json') {
          const reader = result.body?.getReader();
          if (reader) {
            const chunks = [];
            let length = 0;
            while (true) {
              const next = await reader.read();
              if (next.done) break;
              length += next.value.length;
              if (length > 65536) {
                await reader.cancel();
                throw new Error('Oversized backend response');
              }
              chunks.push(next.value);
            }
            const parsed = JSON.parse(Buffer.concat(chunks).toString() || '{}');
            if (parsed.partialSuccess) {
              const fields = [
                'rejectedLogRecords',
                'rejectedSpans',
                'rejectedDataPoints',
              ];
              const partialSuccess = Object.fromEntries(
                fields
                  .filter((field) =>
                    /^\d+$/.test(String(parsed.partialSuccess[field] ?? '')),
                  )
                  .map((field) => [
                    field,
                    String(parsed.partialSuccess[field]),
                  ]),
              );
              payload = JSON.stringify({ partialSuccess });
            }
          }
        } else {
          await result.body?.cancel();
        }
        record(status === 200 ? 'accepted' : 'backend_rejected');
        if (status === 200) {
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end(payload);
        } else respond(response, status, [429, 503].includes(status));
      } catch {
        record('transport_error');
        respond(response, 503, true);
      } finally {
        clearTimeout(deadline);
        limit.inflight--;
        inflight--;
      }
    },
  );
  server.maxConnections = 128;
  server.keepAliveTimeout = 5000;
  return server;
};
