import { createHash, randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const SIGNALS = ['logs', 'traces', 'metrics'];
export const DEFAULT_BUDGET_BYTES = 2 * 1024 ** 3;
export const hashToken = (token) =>
  createHash('sha256').update(token).digest('hex');

export const parseTenants = (value) => {
  const tenants = JSON.parse(value ?? 'null');
  if (!Array.isArray(tenants) || tenants.length < 1 || tenants.length > 100) {
    throw new Error('MONITORING_TENANTS_JSON must contain 1 to 100 tenants');
  }
  const identifiers = new Set();
  const tokens = new Set();
  return tenants.map(
    ({ id, tokenSha256, budgetBytes = DEFAULT_BUDGET_BYTES }) => {
      if (
        typeof id !== 'string' ||
        !/^[a-z][a-z0-9-]{0,31}$/.test(id) ||
        ['anonymous', 'fake', 'index'].includes(id)
      ) {
        throw new Error('Invalid tenant identifier');
      }
      if (
        !/^[a-f0-9]{64}$/.test(tokenSha256 ?? '') ||
        tokens.has(tokenSha256) ||
        identifiers.has(id)
      ) {
        throw new Error(
          'Tenant identifiers and SHA256 token hashes must be valid and unique',
        );
      }
      if (!Number.isSafeInteger(budgetBytes) || budgetBytes < 1024 ** 2) {
        throw new Error(
          'Tenant budgetBytes must be an integer of at least 1 MiB',
        );
      }
      identifiers.add(id);
      tokens.add(tokenSha256);
      return { id, tokenSha256, budgetBytes };
    },
  );
};

export const datasourceConfiguration = (tenants) => ({
  apiVersion: 1,
  prune: true,
  datasources: [
    {
      name: 'Monitoring infrastructure',
      uid: 'monitoring-infrastructure',
      type: 'prometheus',
      access: 'proxy',
      url: 'http://prometheus:9090',
      isDefault: true,
      editable: false,
    },
    ...tenants.flatMap(({ id }) =>
      SIGNALS.map((signal) => ({
        name: `${id} ${signal}`,
        uid: `${id}-${signal}`,
        type: { logs: 'loki', traces: 'tempo', metrics: 'prometheus' }[signal],
        access: 'proxy',
        url: {
          logs: 'http://loki:3100',
          traces: 'http://tempo:3200',
          metrics: 'http://mimir:9009/prometheus',
        }[signal],
        editable: false,
        jsonData: {
          httpHeaderName1: 'X-Scope-OrgID',
          ...(signal === 'metrics'
            ? { httpMethod: 'POST', prometheusType: 'Mimir' }
            : {}),
        },
        secureJsonData: { httpHeaderValue1: id },
      })),
    ),
  ],
});

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const id = process.argv[2];
  const token = randomBytes(32).toString('base64url');
  const tenant = {
    id,
    tokenSha256: hashToken(token),
    budgetBytes: DEFAULT_BUDGET_BYTES,
  };
  parseTenants(JSON.stringify([tenant]));
  console.log(
    JSON.stringify(
      { client: { UPSHIFT_MONITORING_TOKEN: token }, centralTenant: tenant },
      null,
      2,
    ),
  );
}
