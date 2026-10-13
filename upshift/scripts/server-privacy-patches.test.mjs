import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import { SERVER_PRIVACY_PATCHES } from './server-privacy-patches.mjs';

const sourceRoot =
  process.env.UPSHIFT_PRIVACY_SOURCE_ROOT ??
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const patchedSource = (suffix) => {
  const patch = SERVER_PRIVACY_PATCHES.find(({ file }) =>
    file.endsWith(suffix),
  );
  let source = readFileSync(path.join(sourceRoot, patch.file), 'utf8');

  for (const { from, to, count = 1 } of patch.replacements) {
    assert.equal(
      source.split(from).length - 1,
      count,
      `${patch.file}: ${from}`,
    );
    source = source.split(from).join(to);
  }

  return source;
};

const withoutImports = (source) =>
  source.replace(/^import[\s\S]*?from ['"][^'"]+['"];\s*/gm, '');

test('every server privacy patch matches the expected upstream call sites', () => {
  for (const { file } of SERVER_PRIVACY_PATCHES) patchedSource(file);
});

test('Sentry and OTLP remain disabled with reporting enabled in the environment', () => {
  let installedProvider;
  const failRemoteReporting = () =>
    assert.fail('Remote reporting was initialized');
  const context = {
    process: {
      env: {
        EXCEPTION_HANDLER_DRIVER: 'SENTRY',
        SENTRY_DSN: 'https://public@twenty.invalid/1',
        METER_DRIVER: 'OpenTelemetry,Console,Prometheus',
        OTLP_COLLECTOR_METRICS_ENDPOINT_URL: 'https://twenty.invalid/metrics',
      },
    },
    parseArrayEnvVar: (value) => value.split(','),
    MeterDriver: {
      OpenTelemetry: 'OpenTelemetry',
      Console: 'Console',
      Prometheus: 'Prometheus',
    },
    MeterTemporality: { Cumulative: 'cumulative' },
    AggregationTemporality: { CUMULATIVE: 1, DELTA: 0 },
    ExceptionHandlerDriver: { SENTRY: 'SENTRY' },
    Sentry: new Proxy({}, { get: failRemoteReporting }),
    OTLPMetricExporter: class {
      constructor() {
        failRemoteReporting();
      }
    },
    PrometheusExporter: class {},
    ConsoleMetricExporter: class {},
    PeriodicExportingMetricReader: class {},
    MeterProvider: class {
      constructor(options) {
        this.options = options;
      }
    },
    resourceFromAttributes: (attributes) => attributes,
    POD_NAME: 'privacy-test',
    otelMetrics: {
      setGlobalMeterProvider: (provider) => {
        installedProvider = provider;
      },
    },
  };

  vm.runInNewContext(
    stripTypeScriptTypes(withoutImports(patchedSource('/instrument.ts'))),
    context,
  );

  assert.equal(installedProvider.options.readers.length, 2);
});

test('exceptions still use the console when configuration requests Sentry', async () => {
  const source = withoutImports(
    patchedSource('/exception-handler.module-factory.ts'),
  ).replace(
    'export const exceptionHandlerModuleFactory',
    'const exceptionHandlerModuleFactory',
  );
  const context = {
    ExceptionHandlerDriver: { CONSOLE: 'CONSOLE', SENTRY: 'SENTRY' },
  };
  const factory = vm.runInNewContext(
    stripTypeScriptTypes(`${source}\nexceptionHandlerModuleFactory;`),
    context,
  );
  const result = await factory({ get: () => 'SENTRY' }, {});

  assert.equal(result.type, 'CONSOLE');
});

test('client configuration disables reporting despite enabled environment or database settings', async () => {
  const source = withoutImports(patchedSource('/client-config.service.ts'))
    .replace('@Injectable()', '')
    .replace(/  constructor\([\s\S]*?\n  \) \{\}/, '')
    .replace('export class ClientConfigService', 'class ClientConfigService');
  const ClientConfigService = vm.runInNewContext(
    stripTypeScriptTypes(`${source}\nClientConfigService;`),
    {
      isDefined: (value) => value !== undefined && value !== null,
      isNonEmptyString: (value) =>
        typeof value === 'string' && value.length > 0,
      readBookCallStepMinEmployeeCount: () => undefined,
      readIsCompanyEnrichmentEnabled: () => false,
      EmailingDomainDriver: { LOG: 'LOG' },
      SupportDriver: { NONE: 'NONE' },
      NodeEnvironment: { DEVELOPMENT: 'development' },
      ENTERPRISE_INSTANCE_TYPE: { PRODUCTION: 'production' },
      PUBLIC_FEATURE_FLAGS: [],
      AI_MODEL_TIERS: [],
    },
  );

  for (const databaseConfigEnabled of [false, true]) {
    const service = new ClientConfigService();
    const values = {
      IS_CONFIG_VARIABLES_IN_DB_ENABLED: databaseConfigEnabled,
      ANALYTICS_ENABLED: true,
      SENTRY_FRONT_DSN: 'https://public@twenty.invalid/1',
      SENTRY_ENVIRONMENT: 'production',
      SENTRY_FRONT_TRACES_SAMPLE_RATE: 1,
    };
    service.twentyConfigService = { get: (key) => values[key] };
    service.domainServerConfigService = {
      getFrontUrl: () => new URL('https://upshift.invalid'),
      getPublicBaseHostnameOrUndefined: () => undefined,
    };
    service.aiModelRegistryService = {
      getAdminFilteredModels: () => [],
      getResolvedProvidersForAdmin: () => ({}),
      getAvailableEvaluationModelConfigs: () => [],
    };
    service.maintenanceModeService = {
      getMaintenanceMode: async () => undefined,
    };

    const config = await service.getClientConfig();

    assert.equal(config.analyticsEnabled, false);
    assert.equal(config.sentry.dsn, '');
  }
});

test('direct analytics mutations acknowledge events without storing them', async () => {
  const source = patchedSource('/event-log-emitter.resolver.ts');
  const method = source.slice(source.indexOf('  async trackAnalytics('));
  const body = method.slice(
    method.indexOf('  ) {') + '  ) {'.length,
    method.lastIndexOf('\n  }'),
  );
  const constant = source.match(
    /^const UPSHIFT_ANALYTICS_DISABLED: boolean = true;$/m,
  )?.[0];
  assert.ok(constant);
  const trackAnalytics = vm.runInNewContext(
    stripTypeScriptTypes(
      `${constant}\n(async function(createAnalyticsInput, workspace, user) {${body}\n})`,
    ),
  );
  const result = await trackAnalytics.call(
    {
      eventLogEmitterService: {
        createContext: () => assert.fail('Analytics were forwarded to storage'),
      },
    },
    {
      type: 'pageview',
      name: '/settings',
      properties: { email: 'private@example.com' },
    },
  );

  assert.equal(result.success, true);
});

test('enterprise requests fail before collecting metadata or contacting the licensing server', async () => {
  const source = withoutImports(patchedSource('/enterprise-plan.service.ts'))
    .replace('@Injectable()', '')
    .replace(/  constructor\([\s\S]*?\n  \) \{\}/, '')
    .replace(
      'export class EnterprisePlanService',
      'class EnterprisePlanService',
    );
  const EnterprisePlanService = vm.runInNewContext(
    stripTypeScriptTypes(`${source}\nEnterprisePlanService;`),
    {
      Logger: class {},
      isDefined: (value) => value !== undefined && value !== null,
      fetch: () => assert.fail('Enterprise licensing server was contacted'),
    },
  );
  const service = new EnterprisePlanService();
  service.twentyConfigService = {
    get: () => 'configured-enterprise-value',
    set: () => assert.fail('Enterprise key was persisted before rejection'),
  };
  service.cachedKeyPayload = { sub: 'existing-valid-license' };
  service.refreshKeyPayload = () => {};
  service.getLicenseInfo = async () => ({ isValid: true });
  service.gatherInstanceMetadata = () =>
    assert.fail('Instance metadata was collected');
  service.getOrCreateServerId = () =>
    assert.fail('A server identifier was collected');

  assert.equal(await service.getPortalUrl('/settings'), null);
  assert.equal(await service.getCheckoutUrl('monthly', 1), null);

  for (const method of [
    'refreshValidityToken',
    'reportSeats',
    'releaseServerBinding',
    'getSubscriptionStatus',
    'setEnterpriseKey',
  ]) {
    await assert.rejects(
      service[method](),
      /Enterprise network requests are disabled in Upshift/,
    );
  }
});
