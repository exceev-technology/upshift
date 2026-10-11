import { randomBytes, randomInt } from 'node:crypto';
import http from 'node:http';

const LOCAL_COLLECTOR_HOSTS = new Set([
  'alloy',
  'localhost',
  '127.0.0.1',
  '[::1]',
]);
const METHODS = new Set([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
  'HEAD',
]);
const ENVIRONMENTS = new Set(['development', 'staging', 'production', 'test']);
const MAX_PENDING_EVENTS = 256;
const MAX_BATCH_EVENTS = 32;
const MAX_ATTEMPTS = 3;
const EXPORT_TIMEOUT_MS = 2_000;
const FLUSH_INTERVAL_MS = 1_000;
const METRICS_INTERVAL_MS = 15_000;
const RETRY_DELAYS_MS = [250, 1_000];
const DURATION_BOUNDARIES_SECONDS = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
const INSTRUMENTATION_SCOPE = { name: 'upshift.observability', version: '1' };

export const readObservabilityConfiguration = (environment) => {
  if (environment.UPSHIFT_OBSERVABILITY_ENABLED !== 'true') return null;

  let endpoint;
  try {
    endpoint = new URL(environment.UPSHIFT_OTLP_ENDPOINT);
  } catch {
    return null;
  }

  if (
    endpoint.protocol !== 'http:' ||
    !LOCAL_COLLECTOR_HOSTS.has(endpoint.hostname) ||
    !endpoint.port ||
    endpoint.username ||
    endpoint.password ||
    endpoint.pathname !== '/' ||
    endpoint.search ||
    endpoint.hash
  )
    return null;

  const environmentName =
    environment.UPSHIFT_OBSERVABILITY_ENVIRONMENT ?? 'production';
  const service = environment.UPSHIFT_OBSERVABILITY_SERVICE ?? 'server';
  if (
    !ENVIRONMENTS.has(environmentName) ||
    !['server', 'worker'].includes(service)
  )
    return null;

  const sampleRate =
    environment.UPSHIFT_TRACE_SAMPLE_RATE === undefined
      ? 0.1
      : Number(environment.UPSHIFT_TRACE_SAMPLE_RATE);
  if (!Number.isFinite(sampleRate) || sampleRate < 0 || sampleRate > 1)
    return null;

  return {
    endpoint: endpoint.origin,
    environmentName,
    serviceName: `upshift-${service}`,
    sampleRate,
  };
};

export const requestRouteBucket = (requestUrl) => {
  const pathname =
    typeof requestUrl === 'string' ? requestUrl.split('?', 1)[0] : '';
  if (
    ['/healthz', '/health', '/health/live', '/health/ready'].includes(pathname)
  )
    return '/healthz';
  if (pathname === '/metrics') return '/metrics';
  if (pathname === '/graphql') return '/graphql';
  if (pathname === '/metadata') return '/metadata';
  for (const prefix of ['/rest', '/auth', '/files']) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`))
      return `${prefix}/*`;
  }
  return '/other';
};

const attribute = (key, value) => ({
  key,
  value:
    typeof value === 'number' ? { doubleValue: value } : { stringValue: value },
});

const unixNanoseconds = () => BigInt(Date.now()) * 1_000_000n;

// Collector outages must not grow memory or hold application requests open.
const exportPayload = (endpoint, signal, payload) =>
  new Promise((resolve) => {
    const body = JSON.stringify(payload);
    let settled = false;
    const finish = (retryable) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      resolve(retryable);
    };
    const request = http.request(
      `${endpoint}/v1/${signal}`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
        },
      },
      (response) => {
        const statusCode = response.statusCode ?? 500;
        response.destroy();
        finish([429, 502, 503, 504].includes(statusCode));
      },
    );
    const deadline = setTimeout(() => {
      request.destroy();
      finish(true);
    }, EXPORT_TIMEOUT_MS);
    deadline.unref();
    request.on('socket', (socket) => socket.unref());
    request.on('error', () => finish(true));
    request.end(body);
  });

export const createRequestTelemetry = (configuration) => {
  const resource = {
    attributes: [
      attribute('service.name', configuration.serviceName),
      attribute('deployment.environment.name', configuration.environmentName),
      attribute('upshift.observability.schema', '1'),
    ],
  };
  const pendingEvents = [];
  const requestMetrics = new Map();
  const metricsStartTime = String(unixNanoseconds());
  let exporting = false;
  let closed = false;
  let activeFlush = Promise.resolve();
  let droppedEvents = 0;

  const exportBatch = async (signal, payload) => {
    for (let attempt = 0; attempt < MAX_ATTEMPTS && !closed; attempt++) {
      const retryable = await exportPayload(
        configuration.endpoint,
        signal,
        payload,
      );
      if (!retryable || attempt === MAX_ATTEMPTS - 1) return;
      await new Promise((resolve) => {
        const retryTimer = setTimeout(resolve, RETRY_DELAYS_MS[attempt]);
        retryTimer.unref();
      });
    }
  };

  const metricsPayload = () => {
    const timeUnixNano = String(unixNanoseconds());
    const dimensions = (metric) => ({
      attributes: metric.attributes,
      startTimeUnixNano: metricsStartTime,
      timeUnixNano,
    });
    return {
      resourceMetrics: [
        {
          resource,
          scopeMetrics: [
            {
              scope: INSTRUMENTATION_SCOPE,
              metrics: [
                {
                  name: 'upshift_http_requests',
                  unit: '{request}',
                  sum: {
                    aggregationTemporality: 2,
                    isMonotonic: true,
                    dataPoints: [...requestMetrics.values()].map((metric) => ({
                      ...dimensions(metric),
                      asInt: String(metric.count),
                    })),
                  },
                },
                {
                  name: 'upshift_http_request_duration_seconds',
                  unit: 's',
                  histogram: {
                    aggregationTemporality: 2,
                    dataPoints: [...requestMetrics.values()].map((metric) => ({
                      ...dimensions(metric),
                      count: String(metric.count),
                      sum: metric.sum,
                      bucketCounts: metric.buckets.map(String),
                      explicitBounds: DURATION_BOUNDARIES_SECONDS,
                    })),
                  },
                },
                {
                  name: 'upshift_process_memory_bytes',
                  unit: 'By',
                  gauge: {
                    dataPoints: [
                      {
                        timeUnixNano,
                        asInt: String(process.memoryUsage().rss),
                      },
                    ],
                  },
                },
                {
                  name: 'upshift_process_uptime_seconds',
                  unit: 's',
                  gauge: {
                    dataPoints: [{ timeUnixNano, asDouble: process.uptime() }],
                  },
                },
              ],
            },
          ],
        },
      ],
    };
  };

  const flush = (includeMetrics = true) => {
    if (exporting || closed || (pendingEvents.length === 0 && !includeMetrics))
      return activeFlush;
    exporting = true;
    const events = pendingEvents.splice(0, MAX_BATCH_EVENTS);
    activeFlush = Promise.all([
      ...(events.length === 0
        ? []
        : [
            exportBatch('traces', {
              resourceSpans: [
                {
                  resource,
                  scopeSpans: [
                    {
                      scope: INSTRUMENTATION_SCOPE,
                      spans: events.map(({ span }) => span),
                    },
                  ],
                },
              ],
            }),
            exportBatch('logs', {
              resourceLogs: [
                {
                  resource,
                  scopeLogs: [
                    {
                      scope: INSTRUMENTATION_SCOPE,
                      logRecords: events.map(({ log }) => log),
                    },
                  ],
                },
              ],
            }),
          ]),
      ...(includeMetrics ? [exportBatch('metrics', metricsPayload())] : []),
    ]).finally(() => {
      exporting = false;
    });
    return activeFlush;
  };

  const interval = setInterval(() => flush(false), FLUSH_INTERVAL_MS);
  interval.unref();
  const metricsInterval = setInterval(flush, METRICS_INTERVAL_MS);
  metricsInterval.unref();

  const begin = (request) => {
    const startTime = unixNanoseconds();
    const startDuration = process.hrtime.bigint();
    const method = METHODS.has(request.method) ? request.method : 'OTHER';
    const route = requestRouteBucket(request.url);
    return (responseStatusCode, aborted = false) => {
      if (closed) return;
      const statusCode =
        Number.isInteger(responseStatusCode) &&
        responseStatusCode >= 100 &&
        responseStatusCode <= 599
          ? responseStatusCode
          : 500;
      const failed = aborted || statusCode >= 400;
      if (!failed && (route === '/healthz' || route === '/metrics')) return;
      const duration =
        Number(process.hrtime.bigint() - startDuration) / 1_000_000;
      const statusClass = aborted ? '4xx' : `${Math.floor(statusCode / 100)}xx`;
      const metricKey = `${method}|${route}|${statusClass}`;
      if (!requestMetrics.has(metricKey)) {
        requestMetrics.set(metricKey, {
          attributes: [
            attribute('http.request.method', method),
            attribute('http.route', route),
            attribute('http.response.status_class', statusClass),
          ],
          count: 0,
          sum: 0,
          buckets: Array(DURATION_BOUNDARIES_SECONDS.length + 1).fill(0),
        });
      }
      const metric = requestMetrics.get(metricKey);
      const durationSeconds = duration / 1_000;
      const bucketIndex = DURATION_BOUNDARIES_SECONDS.findIndex(
        (boundary) => durationSeconds <= boundary,
      );
      metric.count++;
      metric.sum += durationSeconds;
      metric.buckets[
        bucketIndex === -1 ? DURATION_BOUNDARIES_SECONDS.length : bucketIndex
      ]++;
      if (
        !failed &&
        randomInt(1_000_000) >= configuration.sampleRate * 1_000_000
      )
        return;
      if (pendingEvents.length >= MAX_PENDING_EVENTS) {
        droppedEvents++;
        return;
      }

      const traceId = randomBytes(16).toString('hex');
      const spanId = randomBytes(8).toString('hex');
      const endTime = startTime + BigInt(Math.round(duration * 1_000_000));
      const attributes = [
        attribute('http.request.method', method),
        {
          key: 'http.response.status_code',
          value: { intValue: String(aborted ? 499 : statusCode) },
        },
        attribute('http.route', route),
        attribute('upshift.duration_ms', duration),
        ...(failed
          ? [
              attribute(
                'error.type',
                aborted ? 'request_aborted' : 'http_error',
              ),
            ]
          : []),
      ];
      pendingEvents.push({
        span: {
          traceId,
          spanId,
          name: `${method} ${route}`,
          kind: 2,
          startTimeUnixNano: String(startTime),
          endTimeUnixNano: String(endTime),
          attributes,
          status: { code: aborted || statusCode >= 500 ? 2 : 0 },
        },
        log: {
          timeUnixNano: String(endTime),
          observedTimeUnixNano: String(endTime),
          severityNumber: aborted || statusCode >= 500 ? 17 : failed ? 13 : 9,
          severityText:
            aborted || statusCode >= 500 ? 'ERROR' : failed ? 'WARN' : 'INFO',
          body: { stringValue: 'http_request_completed' },
          attributes: [
            ...attributes,
            attribute('event.name', 'http_request_completed'),
          ],
          traceId,
          spanId,
          flags: 1,
        },
      });
    };
  };

  return {
    begin,
    flush,
    close: () => {
      closed = true;
      clearInterval(interval);
      clearInterval(metricsInterval);
      pendingEvents.length = 0;
      requestMetrics.clear();
    },
    queueStatus: () => ({
      pendingEvents: pendingEvents.length,
      droppedEvents,
      exporting,
      metricSeries: requestMetrics.size,
    }),
  };
};
