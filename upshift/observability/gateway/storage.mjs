import { SIGNALS } from './config.mjs';

export const attributeObject = (signal, key, identifiers) => {
  const parts = key.split('/');
  if (identifiers.has(parts[0])) return parts[0];
  // TSDB indexes share a table prefix, but each tenant has its own child prefix.
  if (
    signal === 'logs' &&
    parts[0] === 'index' &&
    /^index_\d+$/.test(parts[1]) &&
    identifiers.has(parts[2])
  )
    return parts[2];
  return undefined;
};

export const measureStorage = async ({
  tenants,
  listObjects,
  diskUsage,
  now = Date.now,
}) => {
  const identifiers = new Set(tenants.map(({ id }) => id));
  const retained = Object.fromEntries(
    tenants.map(({ id }) => [
      id,
      Object.fromEntries(SIGNALS.map((signal) => [signal, 0])),
    ]),
  );
  const unattributed = Object.fromEntries(SIGNALS.map((signal) => [signal, 0]));
  for (const signal of SIGNALS) {
    let continuationToken;
    let pages = 0;
    do {
      const page = await listObjects(signal, continuationToken);
      if (++pages > 10000)
        throw new Error('Storage inventory exceeded scan limit');
      for (const object of page.Contents ?? []) {
        if (
          typeof object.Key !== 'string' ||
          !Number.isSafeInteger(object.Size) ||
          object.Size < 0
        )
          throw new Error('Invalid storage inventory');
        const tenant = attributeObject(signal, object.Key, identifiers);
        if (tenant) retained[tenant][signal] += object.Size;
        else unattributed[signal] += object.Size;
      }
      if (
        page.IsTruncated &&
        (!page.NextContinuationToken ||
          page.NextContinuationToken === continuationToken)
      )
        throw new Error('Invalid storage pagination');
      continuationToken = page.IsTruncated
        ? page.NextContinuationToken
        : undefined;
    } while (continuationToken);
  }
  const usedRatio = await diskUsage();
  if (!Number.isFinite(usedRatio) || usedRatio < 0 || usedRatio > 1)
    throw new Error('Invalid disk usage');
  return { retained, unattributed, usedRatio, measuredAt: now() };
};

export const renderMetrics = (
  tenants,
  snapshot,
  counters,
  now = Date.now(),
) => {
  const lines = [
    '# HELP upshift_monitoring_storage_measurement_timestamp_seconds Last complete storage scan.',
    '# TYPE upshift_monitoring_storage_measurement_timestamp_seconds gauge',
    `upshift_monitoring_storage_measurement_timestamp_seconds ${(snapshot?.measuredAt ?? 0) / 1000}`,
    `upshift_monitoring_storage_used_ratio ${snapshot?.usedRatio ?? 0}`,
    `upshift_monitoring_storage_measurement_age_seconds ${snapshot ? (now - snapshot.measuredAt) / 1000 : 1e9}`,
  ];
  for (const { id, budgetBytes } of tenants) {
    lines.push(
      `upshift_monitoring_tenant_budget_bytes{client="${id}"} ${budgetBytes}`,
    );
    for (const signal of SIGNALS)
      lines.push(
        `upshift_monitoring_tenant_retained_bytes{client="${id}",signal="${signal}"} ${snapshot?.retained[id]?.[signal] ?? 0}`,
      );
  }
  for (const signal of SIGNALS)
    lines.push(
      `upshift_monitoring_unattributed_bytes{signal="${signal}"} ${snapshot?.unattributed[signal] ?? 0}`,
    );
  for (const [key, value] of counters) {
    const [client, signal, outcome] = key.split('|');
    lines.push(
      `upshift_monitoring_requests_total{client="${client}",signal="${signal}",outcome="${outcome}"} ${value}`,
    );
  }
  return `${lines.join('\n')}\n`;
};
