const SERVER = 'packages/twenty-server/src';

export const SERVER_PRIVACY_PATCHES = [
  {
    file: `${SERVER}/engine/core-modules/enterprise/services/enterprise-plan.service.ts`,
    replacements: [
      {
        from: '@Injectable()\nexport class EnterprisePlanService',
        to: [
          'const UPSHIFT_ENTERPRISE_NETWORK_DISABLED: boolean = true;',
          '',
          '@Injectable()',
          'export class EnterprisePlanService',
        ].join('\n'),
      },
      {
        from: "    const apiUrl = this.twentyConfigService.get('ENTERPRISE_API_URL');",
        to: [
          '    if (UPSHIFT_ENTERPRISE_NETWORK_DISABLED) {',
          "      throw new Error('Enterprise network requests are disabled in Upshift');",
          '    }',
          '',
          "    const apiUrl = this.twentyConfigService.get('ENTERPRISE_API_URL');",
        ].join('\n'),
        count: 6,
      },
    ],
  },
  {
    file: `${SERVER}/instrument.ts`,
    replacements: [
      {
        from: 'if (process.env.EXCEPTION_HANDLER_DRIVER === ExceptionHandlerDriver.SENTRY) {',
        to: [
          '// Persisted settings and container environment must not enable remote reporting.',
          'const UPSHIFT_REMOTE_REPORTING_DISABLED: boolean = true;',
          '',
          'if (',
          '  !UPSHIFT_REMOTE_REPORTING_DISABLED &&',
          '  process.env.EXCEPTION_HANDLER_DRIVER === ExceptionHandlerDriver.SENTRY',
          ') {',
        ].join('\n'),
      },
      {
        from: '...(meterDrivers.includes(MeterDriver.OpenTelemetry)',
        to: '...(!UPSHIFT_REMOTE_REPORTING_DISABLED && meterDrivers.includes(MeterDriver.OpenTelemetry)',
      },
    ],
  },
  {
    file: `${SERVER}/engine/core-modules/exception-handler/exception-handler.module-factory.ts`,
    replacements: [
      {
        from: 'export const exceptionHandlerModuleFactory = async (',
        to: [
          'const UPSHIFT_REMOTE_REPORTING_DISABLED: boolean = true;',
          '',
          'export const exceptionHandlerModuleFactory = async (',
        ].join('\n'),
      },
      {
        from: "  const driverType = twentyConfigService.get('EXCEPTION_HANDLER_DRIVER');",
        to: [
          '  if (UPSHIFT_REMOTE_REPORTING_DISABLED) {',
          '    return { type: ExceptionHandlerDriver.CONSOLE };',
          '  }',
          '',
          "  const driverType = twentyConfigService.get('EXCEPTION_HANDLER_DRIVER');",
        ].join('\n'),
      },
    ],
  },
  {
    file: `${SERVER}/engine/core-modules/client-config/services/client-config.service.ts`,
    replacements: [
      {
        from: "dsn: this.twentyConfigService.get('SENTRY_FRONT_DSN'),",
        to: "dsn: '',",
      },
      {
        from: "analyticsEnabled: this.twentyConfigService.get('ANALYTICS_ENABLED'),",
        to: 'analyticsEnabled: false,',
      },
    ],
  },
  {
    file: `${SERVER}/engine/core-modules/event-logs/emit/event-log-emitter.resolver.ts`,
    replacements: [
      {
        from: '@MetadataResolver(() => Analytics)',
        to: [
          'const UPSHIFT_ANALYTICS_DISABLED: boolean = true;',
          '',
          '@MetadataResolver(() => Analytics)',
        ].join('\n'),
      },
      {
        from: [
          '    const eventLogContext = this.eventLogEmitterService.createContext({',
          '      workspaceId: workspace?.id,',
        ].join('\n'),
        to: [
          '    if (UPSHIFT_ANALYTICS_DISABLED) {',
          '      return { success: true };',
          '    }',
          '',
          '    const eventLogContext = this.eventLogEmitterService.createContext({',
          '      workspaceId: workspace?.id,',
        ].join('\n'),
      },
    ],
  },
];
