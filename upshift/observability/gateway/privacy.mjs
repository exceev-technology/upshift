const METHODS = new Set([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
  'HEAD',
  'OTHER',
]);
const ROUTES = new Set([
  '/healthz',
  '/metrics',
  '/graphql',
  '/metadata',
  '/rest/*',
  '/auth/*',
  '/files/*',
  '/other',
]);
const ENVIRONMENTS = new Set(['development', 'staging', 'production', 'test']);
const METRICS = new Map([
  ['upshift_http_requests', 'sum'],
  ['upshift_http_request_duration_seconds', 'histogram'],
  ['upshift_process_memory_bytes', 'gauge'],
  ['upshift_process_uptime_seconds', 'gauge'],
]);
const array = (value) =>
  Array.isArray(value) && value.length <= 1024 ? value : [];
const unsigned = (value) =>
  /^\d{1,20}$/.test(String(value)) ? String(value) : '0';
const number = (value) =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= 0 &&
  value < 1e18
    ? value
    : 0;
const identifier = (value, length) =>
  typeof value === 'string' &&
  new RegExp(`^[a-fA-F0-9]{${length}}$`).test(value)
    ? value
    : '0'.repeat(length);
const strings = (attributes) =>
  Object.fromEntries(
    array(attributes).map(({ key, value }) => [key, value?.stringValue]),
  );
const attribute = (key, value) => ({ key, value: { stringValue: value } });

const attributes = (values, metric = false) =>
  array(values).flatMap(({ key, value }) => {
    const string = value?.stringValue;
    if (key === 'http.request.method' && METHODS.has(string))
      return [attribute(key, string)];
    if (key === 'http.route' && ROUTES.has(string))
      return [attribute(key, string)];
    if (
      metric &&
      key === 'http.response.status_class' &&
      /^[1-5]xx$/.test(string)
    )
      return [attribute(key, string)];
    if (
      !metric &&
      key === 'http.response.status_code' &&
      /^[1-5]\d{2}$/.test(String(value?.intValue))
    )
      return [{ key, value: { intValue: String(value.intValue) } }];
    if (!metric && key === 'upshift.duration_ms')
      return [{ key, value: { doubleValue: number(value?.doubleValue) } }];
    if (
      !metric &&
      key === 'error.type' &&
      ['request_aborted', 'http_error'].includes(string)
    )
      return [attribute(key, string)];
    return [];
  });

// Rebuild the wire document: unknown OTLP fields must never become a bypass around the allowlist.
export const sanitizePayload = (signal, input) => {
  const resourceKey = {
    logs: 'resourceLogs',
    traces: 'resourceSpans',
    metrics: 'resourceMetrics',
  }[signal];
  const scopeKey = {
    logs: 'scopeLogs',
    traces: 'scopeSpans',
    metrics: 'scopeMetrics',
  }[signal];
  const recordKey = { logs: 'logRecords', traces: 'spans', metrics: 'metrics' }[
    signal
  ];
  const resources = array(input[resourceKey]).flatMap((group) => {
    const resourceAttributes = strings(group.resource?.attributes);
    if (
      resourceAttributes['upshift.observability.schema'] !== '1' ||
      !['upshift-server', 'upshift-worker'].includes(
        resourceAttributes['service.name'],
      ) ||
      !ENVIRONMENTS.has(resourceAttributes['deployment.environment.name'])
    )
      return [];
    const scopes = array(group[scopeKey])
      .filter(({ scope }) => scope?.name === 'upshift.observability')
      .map((scope) => ({
        scope: { name: 'upshift.observability', version: '1' },
        [recordKey]: array(scope[recordKey]).flatMap((record) => {
          if (signal === 'metrics') {
            const kind = METRICS.get(record.name);
            if (!kind || !record[kind]) return [];
            const dataPoints = array(record[kind].dataPoints).map((point) => {
              const common = {
                attributes: attributes(point.attributes, true),
                timeUnixNano: unsigned(point.timeUnixNano),
                ...(point.startTimeUnixNano
                  ? { startTimeUnixNano: unsigned(point.startTimeUnixNano) }
                  : {}),
              };
              if (kind === 'histogram') {
                const bounds = array(point.explicitBounds).map(number);
                const buckets = array(point.bucketCounts).map(unsigned);
                if (bounds.length > 16 || buckets.length !== bounds.length + 1)
                  throw new Error('Invalid histogram');
                return {
                  ...common,
                  count: unsigned(point.count),
                  sum: number(point.sum),
                  explicitBounds: bounds,
                  bucketCounts: buckets,
                };
              }
              return {
                ...common,
                ...(point.asInt !== undefined
                  ? { asInt: unsigned(point.asInt) }
                  : { asDouble: number(point.asDouble) }),
              };
            });
            return [
              {
                name: record.name,
                [kind]: {
                  ...(kind !== 'gauge' ? { aggregationTemporality: 2 } : {}),
                  ...(kind === 'sum' ? { isMonotonic: true } : {}),
                  dataPoints,
                },
              },
            ];
          }
          const common = {
            traceId: identifier(record.traceId, 32),
            spanId: identifier(record.spanId, 16),
            attributes: attributes(record.attributes),
          };
          if (signal === 'logs')
            return [
              {
                ...common,
                timeUnixNano: unsigned(record.timeUnixNano),
                observedTimeUnixNano: unsigned(record.observedTimeUnixNano),
                severityNumber: [9, 13, 17].includes(record.severityNumber)
                  ? record.severityNumber
                  : 9,
                body: { stringValue: 'http_request_completed' },
              },
            ];
          const values = strings(common.attributes);
          return [
            {
              ...common,
              name: `${values['http.request.method'] ?? 'OTHER'} ${values['http.route'] ?? '/other'}`,
              kind: 2,
              startTimeUnixNano: unsigned(record.startTimeUnixNano),
              endTimeUnixNano: unsigned(record.endTimeUnixNano),
              status: { code: record.status?.code === 2 ? 2 : 0 },
            },
          ];
        }),
      }));
    return [
      {
        resource: {
          attributes: [
            'service.name',
            'deployment.environment.name',
            'upshift.observability.schema',
          ].map((key) => attribute(key, resourceAttributes[key])),
        },
        [scopeKey]: scopes,
      },
    ];
  });
  if (resources.length === 0)
    throw new Error('No approved telemetry resources');
  return { [resourceKey]: resources };
};
