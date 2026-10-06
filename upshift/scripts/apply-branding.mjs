#!/usr/bin/env node
import { createHash } from 'node:crypto';
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const UPSHIFT_DIRECTORY = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const LAYER_REPOSITORY_ROOT = path.resolve(UPSHIFT_DIRECTORY, '..');
const BRANDING_DIRECTORY = path.join(UPSHIFT_DIRECTORY, 'branding');
const OVERLAY_DIRECTORY = path.join(BRANDING_DIRECTORY, 'overlay');
const CATALOG_HOOK_SOURCE = path.join(
  UPSHIFT_DIRECTORY,
  'scripts',
  'brand-catalogs.mjs',
);
const CATALOG_HOOK_FILE_NAME = 'upshift-brand-catalogs.mjs';
const CATALOG_HOOK_CONFIGURATION_FILE_NAME = 'upshift-brand-catalogs.json';
const CATALOG_TEXT_REPLACEMENTS = [
  ['https://twenty.com/developers/', '{{docsUrl}}/developers/'],
  ['https://docs.twenty.com', '{{docsUrl}}'],
  ['my-twenty-app', 'my-{{slug}}-app'],
  ['twenty.com', '{{domain}}'],
];
const LAYER_MARKER_FILE_NAME = '.upshift-layer-applied';
const ICONS_RELATIVE_DIRECTORY = 'packages/twenty-front/public/images/icons';
const TEMPLATE_EXTENSIONS = new Set(['.ts', '.tsx', '.json', '.html', '.md']);
const TWENTY_BRAND_WORD = /(?<![\w@./-])Twenty(?!\w|\.[a-z])/g;

const FRONT = 'packages/twenty-front';
const SERVER = 'packages/twenty-server/src';
const EMAILS = 'packages/twenty-emails/src';

// Overlays that replace a whole Twenty source file: any upstream edit must be reviewed by hand
const CODE_OVERLAY_UPSTREAM_SHA256 = {
  'packages/twenty-emails/src/components/Footer.tsx': [
    '432bf461b7011834ba31fb30a6d13f4e9a10d5a1dbd77f6d84627e7bf3f612ec',
  ],
};

const PATCHES = [
  {
    file: `${FRONT}/index.html`,
    replacements: [
      { from: '<title>Twenty</title>', to: '<title>{{name}}</title>' },
      {
        from: '<meta property="og:title" content="Twenty" />',
        to: '<meta property="og:title" content="{{name}}" />',
      },
      {
        from: '<meta name="twitter:title" content="Twenty" />',
        to: '<meta name="twitter:title" content="{{name}}" />',
      },
      {
        from: 'content="A modern open-source CRM"',
        to: 'content="{{description}}"',
        count: 3,
      },
      {
        from: 'https://raw.githubusercontent.com/twentyhq/twenty/main/docs/static/img/social-card.png',
        to: '{{publicAssetsBaseUrl}}/social-card.png',
        count: 2,
      },
    ],
  },
  {
    file: `${FRONT}/public/manifest.json`,
    replacements: [
      { from: '"short_name": "Twenty"', to: '"short_name": "{{name}}"' },
      { from: '"name": "Twenty"', to: '"name": "{{name}}"' },
    ],
  },
  {
    file: `${FRONT}/src/utils/title-utils.ts`,
    replacements: [{ from: "return 'Twenty';", to: "return '{{name}}';" }],
  },
  {
    file: `${FRONT}/src/modules/activities/timeline-activities/utils/getTimelineActivityAuthorFullName.ts`,
    replacements: [{ from: "return 'Twenty';", to: "return '{{name}}';" }],
  },
  {
    file: `${FRONT}/src/modules/ui/navigation/navigation-drawer/constants/DefaultWorkspaceLogo.ts`,
    replacements: [
      {
        from: "'https://twentyhq.github.io/placeholder-images/workspaces/twenty-logo.png'",
        to: '`${window.location.origin}/images/icons/android/android-launchericon-192-192.png`',
      },
    ],
  },
  {
    file: `${FRONT}/src/modules/navigation-menu-item/edit/hooks/useNavigationMenuItemAddOptions.tsx`,
    replacements: [
      { from: "name: 'Twenty',", to: "name: '{{name}}'," },
      { from: "link: 'https://twenty.com',", to: "link: '{{websiteUrl}}'," },
    ],
  },
  {
    file: `${FRONT}/src/modules/settings/mcp-and-apis/constants/McpSetup.ts`,
    replacements: [
      { from: "displayName: 'Twenty',", to: "displayName: '{{name}}'," },
      { from: "name: 'twenty',", to: "name: '{{slug}}'," },
      {
        from: "'https://chatgpt.com/apps/twenty/asdk_app_6a0ac8d7e28c8191a58ea65bb0ca3d5c'",
        to: "''",
      },
    ],
  },
  {
    file: `${FRONT}/src/modules/settings/mcp-and-apis/utils/buildMcpSetupCategories.tsx`,
    replacements: [
      {
        from: [
          '      {',
          '        title: t`ChatGPT`,',
          '        badge: t`Official app`,',
          "        description: t`Open Twenty's official ChatGPT integration for your workspace.`,",
          '        ctaLabel: t`Open`,',
          '        href: MCP_SETUP.chatGptTwentyAppUrl,',
          '        logo: <McpClientLogo src={OpenAiLogo} invertInDarkMode />,',
          '      },',
          '',
        ].join('\n'),
        to: '',
      },
    ],
  },
  {
    file: `${FRONT}/src/modules/settings/hooks/useSettingsNavigationItems.tsx`,
    replacements: [
      {
        pattern:
          /(label: t`Community`,\n\s+path: SettingsPath\.Community,\n\s+Icon: IconUsers,\n\s+isHidden: )[^\n]+,/g,
        to: '$1true,',
      },
    ],
  },
  {
    file: `${FRONT}/src/modules/app/components/SettingsRoutes.tsx`,
    replacements: [
      {
        from: [
          '      <Route path={SettingsPath.LegalDpa} element={<SettingsLegalDpa />} />',
          '      <Route',
          '        path={SettingsPath.LegalDpaNew}',
          '        element={<SettingsLegalDpaNew />}',
          '      />',
          '',
        ].join('\n'),
        to: '',
      },
      {
        from: '      <Route path={SettingsPath.Community} element={<SettingsCommunity />} />\n',
        to: '',
      },
    ],
  },
  {
    file: 'packages/twenty-shared/src/constants/DocumentationBaseUrl.ts',
    replacements: [{ from: "'https://docs.twenty.com'", to: "'{{docsUrl}}'" }],
  },
  {
    file: `${FRONT}/src/modules/workflow/workflow-steps/workflow-actions/form-action/components/WorkflowEditActionFormBuilder.tsx`,
    replacements: [{ from: "'https://docs.twenty.com/", to: "'{{docsUrl}}/" }],
  },
  {
    file: `${FRONT}/src/modules/settings/data-model/constants/SettingsCompositeFieldTypeConfigs.ts`,
    replacements: [
      { pattern: /@twenty\.com/g, to: '@{{domain}}' },
      { from: "'twenty.com'", to: "'{{domain}}'", count: 3 },
      { from: "'github.com/twentyhq/twenty'", to: "'{{repositoryUrl}}'" },
      { brandWord: true, minimum: 2 },
    ],
  },
  {
    file: `${FRONT}/src/pages/settings/applications/tabs/SettingsApplicationsDeveloperTab.tsx`,
    replacements: [
      {
        from: "'npx create-twenty-app@latest my-twenty-app'",
        to: "'npx create-twenty-app@latest my-{{slug}}-app'",
      },
    ],
  },
  {
    file: `${FRONT}/src/modules/onboarding/constants/CalLink.ts`,
    replacements: [
      { from: "'https://cal.com/team/twenty/talk-to-us'", to: "'{{websiteUrl}}'" },
    ],
  },
  {
    file: `${FRONT}/src/modules/apollo/services/apollo.factory.ts`,
    replacements: [{ brandWord: true }],
  },
  {
    file: 'packages/twenty-front-component-renderer/src/remote/worker/fetch-proxy/utils/getTextBodyFromFetchRequestArguments.ts',
    replacements: [{ brandWord: true, minimum: 2 }],
  },
  {
    file: `${FRONT}/src/modules/settings/mcp-and-apis/utils/mcpSetup.ts`,
    replacements: [
      {
        from: "'Access your Twenty workspace through MCP'",
        to: "'Access your {{name}} workspace through MCP'",
      },
    ],
  },
  {
    file: `${FRONT}/src/modules/settings/admin-panel/components/SettingsAdminVersionDisplay.tsx`,
    replacements: [
      {
        from: '`https://hub.docker.com/r/twentycrm/twenty/tags?name=${version}`',
        to: "'{{imageRegistryUrl}}'",
      },
    ],
  },
  {
    file: `${FRONT}/src/modules/auth/utils/getTwentyWebsiteUrl.ts`,
    replacements: [
      {
        from: [
          '  const url = new URL(',
          '    isLocalizedWebsitePath ? `/${language}/${page}` : `/${page}`,',
          '    TWENTY_WEBSITE_HREF,',
          '  );',
          '',
          '  return url.toString();',
        ].join('\n'),
        to: "  return page === 'terms' ? '{{termsUrl}}' : '{{privacyPolicyUrl}}';",
      },
      { from: "'https://twenty.com'", to: "'{{websiteUrl}}'" },
    ],
  },
  {
    file: `${FRONT}/src/modules/auth/sign-in-up/components/FooterNote.tsx`,
    replacements: [
      { from: 'href="https://twenty.com/legal/dpa"', to: 'href="{{dpaUrl}}"' },
    ],
  },
  {
    file: `${FRONT}/src/modules/onboarding/constants/OnboardingNetworkPreviewPeople.ts`,
    replacements: [
      {
        from: '`https://twentyhq.github.io/placeholder-images/people/image-${imageNumber}.png`',
        to: "''",
      },
    ],
  },
  {
    file: 'packages/twenty-shared/src/utils/image/getLogoUrlFromDomainName.ts',
    replacements: [
      { from: '`https://twenty-icons.com/${sanitizedDomain}`', to: 'undefined' },
    ],
  },
  {
    file: `${SERVER}/engine/core-modules/twenty-config/config-variables.ts`,
    replacements: [
      {
        from: 'ALLOW_REQUESTS_TO_TWENTY_ICONS = true;',
        to: 'ALLOW_REQUESTS_TO_TWENTY_ICONS = false;',
      },
      {
        from: "EMAIL_FROM_NAME = 'Felix from Twenty';",
        to: "EMAIL_FROM_NAME = '{{emailFromName}}';",
      },
      { from: 'TELEMETRY_ENABLED = true;', to: 'TELEMETRY_ENABLED = false;' },
      {
        from: "description: 'Twenty server version',",
        to: "description: '{{name}} server version',",
      },
    ],
  },
  {
    file: `${SERVER}/engine/core-modules/telemetry/telemetry.service.ts`,
    replacements: [
      {
        from: '@Injectable()\nexport class TelemetryService {',
        to: 'const UPSHIFT_TELEMETRY_DISABLED: boolean = true;\n\n@Injectable()\nexport class TelemetryService {',
      },
      {
        from: "    if (!this.twentyConfigService.get('TELEMETRY_ENABLED')) {",
        to: "    if (\n      UPSHIFT_TELEMETRY_DISABLED ||\n      !this.twentyConfigService.get('TELEMETRY_ENABLED')\n    ) {",
      },
    ],
  },
  {
    file: `${SERVER}/modules/contact-creation-manager/services/create-company.service.ts`,
    replacements: [
      {
        from: 'const response = await this.httpService.get(`/${domainName}`);',
        to: "const response = await Promise.reject<{\n        data: { name?: string; city: string };\n      }>(new Error('Company enrichment is disabled'));",
      },
    ],
  },
  {
    file: `${SERVER}/engine/core-modules/tool/tools/search-help-center-tool/search-help-center-tool.ts`,
    replacements: [
      {
        from: '      const useDirectApi = MINTLIFY_API_KEY && MINTLIFY_SUBDOMAIN;\n',
        to: [
          '      const useDirectApi = MINTLIFY_API_KEY && MINTLIFY_SUBDOMAIN;',
          '',
          '      if (!useDirectApi) {',
          '        return {',
          '          success: false,',
          '          message: `Help center search is not available for "${query}"`,',
          "          error: 'Help center search is disabled',",
          '        };',
          '      }',
          '',
        ].join('\n'),
      },
      { from: "'https://twenty-help-search.com/search/twenty'", to: "''" },
      { brandWord: true },
    ],
  },
  {
    file: `${SERVER}/engine/core-modules/auth/services/sign-in-up.service.ts`,
    replacements: [
      {
        from: 'const logoUrl = `${TWENTY_ICONS_BASE_URL}/${getDomainFromEmailOrThrow(email)}`;',
        to: 'const logoUrl: string | undefined = undefined;\n\n      if (!isDefined(logoUrl)) {\n        return;\n      }\n',
      },
    ],
  },
  {
    file: `${SERVER}/engine/workspace-manager/standard-objects-prefill-data/utils/prefill-people.util.ts`,
    replacements: [
      {
        pattern:
          /'https:\/\/twentyhq\.github\.io\/placeholder-images\/founders\/[a-z-]+\.jpg'/g,
        to: "''",
      },
    ],
  },
  {
    file: `${SERVER}/engine/core-modules/workspace-invitation/services/workspace-invitation.service.ts`,
    replacements: [{ from: '(via Twenty)', to: '(via {{name}})' }],
  },
  {
    file: `${SERVER}/engine/core-modules/approved-access-domain/services/approved-access-domain.service.ts`,
    replacements: [{ from: '(via Twenty)', to: '(via {{name}})' }],
  },
  {
    file: `${SERVER}/engine/core-modules/two-factor-authentication/two-factor-authentication.service.ts`,
    replacements: [
      {
        from: '`Twenty${workspaceDisplayName',
        to: '`{{name}}${workspaceDisplayName',
        count: 2,
      },
    ],
  },
  {
    file: `${SERVER}/engine/core-modules/frontend/frontend.service.ts`,
    replacements: [
      {
        from: "'Unable to load Twenty. Please try again.'",
        to: "'Unable to load {{name}}. Please try again.'",
      },
    ],
  },
  {
    file: `${SERVER}/engine/api/mcp/constants/mcp-server-info.const.ts`,
    replacements: [
      { from: "'Twenty MCP Server'", to: "'{{name}} MCP Server'" },
    ],
  },
  {
    file: `${SERVER}/engine/core-modules/well-known/utils/build-mcp-server-card.util.ts`,
    replacements: [
      { from: "title: 'Twenty CRM',", to: "title: '{{name}} CRM'," },
      {
        from: "'Read and write your Twenty CRM data",
        to: "'Read and write your {{name}} CRM data",
      },
      {
        from: "websiteUrl: 'https://twenty.com',",
        to: "websiteUrl: '{{websiteUrl}}',",
      },
      { from: "name: 'com.twenty/twenty',", to: "name: '{{mcpServerId}}'," },
      {
        from: "url: 'https://github.com/twentyhq/twenty',",
        to: "url: '{{repositoryUrl}}',",
      },
    ],
  },
  {
    file: `${SERVER}/engine/core-modules/open-api/utils/base-schema.utils.ts`,
    replacements: [
      {
        from: "'https://github.com/twentyhq/twenty?tab=coc-ov-file#readme'",
        to: "'{{termsUrl}}'",
      },
      { from: "email: 'felix@twenty.com',", to: "email: '{{contactEmail}}'," },
      {
        from: "'https://github.com/twentyhq/twenty?tab=License-1-ov-file#readme'",
        to: "'{{repositoryUrl}}/blob/upshift-main/LICENSE'",
      },
      { from: "url: 'https://twenty.com',", to: "url: '{{websiteUrl}}'," },
      { from: '> twenty-${schemaName}.json', to: '> {{slug}}-${schemaName}.json' },
      { brandWord: true, minimum: 3 },
    ],
  },
  {
    file: `${SERVER}/engine/workspace-manager/standard-objects-prefill-data/utils/prefill-workflows.util.ts`,
    replacements: [
      { from: "value: 'https://twenty.com',", to: "value: '{{websiteUrl}}'," },
      { from: "value: 'twenty.com',", to: "value: '{{domain}}'," },
    ],
  },
  {
    file: `${SERVER}/engine/workspace-manager/twenty-standard-application/utils/page-layout-widget/compute-my-first-dashboard-widgets.util.ts`,
    replacements: [
      {
        from: "'https://docs.twenty.com/getting-started/introduction'",
        to: "'{{docsUrl}}/getting-started/introduction'",
      },
    ],
  },
  ...[
    'engine/core-modules/tool/tools/code-interpreter-tool/twenty-mcp-helper.const.ts',
    'engine/workspace-manager/twenty-standard-application/utils/skill-metadata/create-standard-flat-skill-metadata.util.ts',
    'engine/core-modules/tool/tools/search-help-center-tool/search-help-center-tool.schema.ts',
    'engine/core-modules/application/application-package/application-version-validation.service.ts',
    'engine/core-modules/auth/controllers/oauth-propagator.controller.ts',
    'engine/core-modules/application/application-registration/application-registration.service.ts',
    'engine/workspace-manager/twenty-standard-application/constants/twenty-cli-application-registration.constant.ts',
    'engine/workspace-manager/workspace-migration/services/workspace-migration-flat-entity-maps.service.ts',
    'engine/metadata-modules/ai/ai-chat/constants/chat-system-prompts.const.ts',
    'engine/metadata-modules/ai/ai-chat/constants/workspace-setup-system-prompt.constant.ts',
    'engine/metadata-modules/ai/ai-agent/constants/agent-run-base-system-prompt.const.ts',
    'engine/metadata-modules/ai/ai-agent/constants/workflow-base-system-prompt.const.ts',
    'engine/api/mcp/utils/build-mcp-server-instructions.util.ts',
    'engine/workspace-manager/twenty-standard-application/utils/agent-metadata/create-standard-flat-agent-metadata.util.ts',
    'engine/metadata-modules/navigation-menu-item/tools/schemas/navigation-menu-item-scope.schema.ts',
  ].map((relativePath) => ({
    file: `${SERVER}/${relativePath}`,
    replacements: [{ brandWord: true }],
  })),
  {
    file: `${EMAILS}/components/Logo.tsx`,
    replacements: [
      {
        from: 'src="https://app.twenty.com/images/icons/windows11/Square150x150Logo.scale-100.png"',
        to: 'src="{{publicAssetsBaseUrl}}/logo-email.png"',
      },
      { from: 'alt="Twenty logo"', to: 'alt="{{name}} logo"' },
    ],
  },
  {
    file: `${EMAILS}/components/BaseHead.tsx`,
    replacements: [
      { from: '<title>Twenty email</title>', to: '<title>{{name}} email</title>' },
    ],
  },
  {
    file: `${EMAILS}/constants/DefaultWorkspaceLogo.ts`,
    replacements: [
      {
        from: "'https://twentyhq.github.io/placeholder-images/workspaces/twenty-logo.png'",
        to: "'{{publicAssetsBaseUrl}}/logo-email.png'",
      },
    ],
  },
  {
    file: `${EMAILS}/emails/clean-suspended-workspace.email.tsx`,
    replacements: [
      { from: 'href="https://app.twenty.com/"', to: 'href="{{websiteUrl}}"' },
    ],
  },
  {
    file: `${EMAILS}/emails/send-email-verification-link.email.tsx`,
    replacements: [{ brandWord: true, minimum: 2 }],
  },
  ...[
    'password-reset-link',
    'password-update-notify',
    'send-email-verification-link',
    'send-invite-link',
    'validate-approved-access-domain',
    'billing-subscription-renewing',
    'billing-trial-converting',
    'billing-trial-ending',
    'warn-suspended-workspace',
  ].map((emailName) => ({
    file: `${EMAILS}/emails/${emailName}.email.tsx`,
    replacements: [
      { pattern: /https:\/\/(app|acme)\.twenty\.com/g, to: '{{websiteUrl}}' },
    ],
  })),
];

const CATALOG_HOOKS = [
  { project: FRONT, generatedDirectory: 'src/locales/generated' },
  {
    project: 'packages/twenty-server',
    generatedDirectory: 'src/engine/core-modules/i18n/locales/generated',
  },
  { project: 'packages/twenty-emails', generatedDirectory: 'src/locales/generated' },
];

const YARN_CONFIGURATION_FILES = [
  '.yarnrc.yml',
  `${SERVER}/engine/core-modules/application/application-package/constants/yarn-engine/.yarnrc.yml`,
];

const CENSUS_ROOTS = [
  `${FRONT}/index.html`,
  `${FRONT}/public`,
  `${FRONT}/src`,
  SERVER,
  'packages/twenty-shared/src',
  EMAILS,
  'packages/twenty-ui/src',
  'packages/twenty-front-component-renderer/src',
];
const CENSUS_TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.json',
  '.html',
]);
const CENSUS_EXCLUDED_PATH =
  /\.(spec|test|stories)\.|__tests__|__mocks__|__stories__|\/mocks?\/|mock-data|\/testing\/|dev-seeder|\/generated\//;

const TRANSLATED_IN_CATALOGS = 'translated message, rewritten in the compiled catalogs';
const UNREACHABLE_DPA = 'Twenty legal DPA, its routes are removed';
const NEUTRALIZED = 'neutralized by a patch above';
const BARREL_EXPORT = 'constant re-export only';

// Every remaining reference to Twenty-owned hosts or links; anything new fails the build until reviewed
const REFERENCE_CENSUS = [
  {
    needle: 'twenty.com',
    allowed: {
      [`${FRONT}/src/pages/settings/applications/utils/getCustomApplicationDescription.ts`]:
        TRANSLATED_IN_CATALOGS,
      [`${FRONT}/src/pages/settings/applications/utils/getStandardApplicationDescription.ts`]:
        TRANSLATED_IN_CATALOGS,
      [`${FRONT}/src/modules/settings/billing/constants/SettingsBillingPlanComparisonRows.ts`]:
        TRANSLATED_IN_CATALOGS,
      [`${SERVER}/engine/api/common/common-args-processors/data-arg-processor/validator-utils/validate-links-field-or-throw.util.ts`]:
        TRANSLATED_IN_CATALOGS,
      [`${FRONT}/src/pages/settings/community/SettingsCommunity.tsx`]:
        'Community page, its route and menu item are removed',
      [`${SERVER}/engine/core-modules/dpa/config/dpa-region-config.constant.ts`]: UNREACHABLE_DPA,
      [`${SERVER}/engine/core-modules/dpa/constants/dpa-template.constant.ts`]: UNREACHABLE_DPA,
      [`${SERVER}/engine/core-modules/twenty-config/config-variables.ts`]:
        'ENTERPRISE_API_URL, only used with a Twenty enterprise key',
    },
  },
  {
    needle: 'github.com/twentyhq',
    allowed: {
      [`${SERVER}/engine/api/common/common-query-runners/common-group-by-query-runner.service.ts`]:
        'issue link in a trailing code comment',
      [`${SERVER}/engine/api/rest/rest-api-exception.filter.ts`]:
        'issue link in a trailing code comment',
    },
  },
  { needle: 'chatgpt.com/apps/twenty', allowed: {} },
  { needle: 'cal.com/team/twenty', allowed: {} },
  {
    needle: 'twenty-telemetry.com',
    allowed: {
      [`${SERVER}/engine/core-modules/telemetry/telemetry.service.ts`]: NEUTRALIZED,
    },
  },
  {
    needle: 'twenty-companies.com',
    allowed: {
      'packages/twenty-shared/src/constants/TwentyCompaniesBaseUrl.ts': NEUTRALIZED,
    },
  },
  {
    needle: 'TWENTY_COMPANIES_BASE_URL',
    allowed: {
      'packages/twenty-shared/src/constants/TwentyCompaniesBaseUrl.ts': NEUTRALIZED,
      'packages/twenty-shared/src/constants/index.ts': BARREL_EXPORT,
      [`${SERVER}/modules/contact-creation-manager/services/create-company.service.ts`]:
        NEUTRALIZED,
    },
  },
  { needle: 'twenty-help-search.com', allowed: {} },
  {
    needle: 'twenty-icons.com',
    allowed: {
      'packages/twenty-shared/src/constants/TwentyIconsBaseUrl.ts': NEUTRALIZED,
    },
  },
  {
    needle: 'TWENTY_ICONS_BASE_URL',
    allowed: {
      'packages/twenty-shared/src/constants/TwentyIconsBaseUrl.ts': NEUTRALIZED,
      'packages/twenty-shared/src/constants/index.ts': BARREL_EXPORT,
      [`${SERVER}/engine/core-modules/auth/services/sign-in-up.service.ts`]: NEUTRALIZED,
    },
  },
  { needle: 'twentyhq.github.io', allowed: {} },
];

const { values: options } = parseArgs({
  options: { root: { type: 'string' } },
});

if (!options.root) {
  console.error('Usage: apply-branding.mjs --root <path to a fresh Twenty checkout>');
  process.exit(1);
}

const twentyRoot = path.resolve(options.root);
const brand = JSON.parse(
  readFileSync(path.join(BRANDING_DIRECTORY, 'brand.json'), 'utf8'),
);
const failures = [];

const plannedWrites = new Map();

const fail = (message) => failures.push(message);

const planWrite = (filePath, content) => plannedWrites.set(filePath, content);

const readPlanned = (filePath) => {
  const plannedContent = plannedWrites.get(filePath);

  if (plannedContent === undefined) {
    return readFileSync(filePath, 'utf8');
  }

  return Buffer.isBuffer(plannedContent)
    ? plannedContent.toString('utf8')
    : plannedContent;
};

const commitPlannedWrites = () => {
  for (const [filePath, content] of plannedWrites) {
    writeFileSync(filePath, content);
  }
};

const exitOnFailures = (stage) => {
  if (failures.length === 0) {
    return;
  }

  console.error(`Upshift layer failed during ${stage}:`);
  failures.forEach((message) => console.error(`  - ${message}`));
  console.error(
    'Twenty changed something the layer depends on. See upshift/README.md, "When the layer check fails".',
  );
  process.exit(1);
};

const fillTemplate = (text) =>
  text.replace(/\{\{(\w+)\}\}/g, (placeholder, key) => {
    if (!(key in brand)) {
      throw new Error(`Unknown brand key ${placeholder}`);
    }

    return brand[key];
  });

const sha256 = (filePath) =>
  createHash('sha256').update(readFileSync(filePath)).digest('hex');

const listFiles = (entryPath) => {
  if (!existsSync(entryPath)) {
    return [];
  }

  if (!statSync(entryPath).isDirectory()) {
    return [entryPath];
  }

  return readdirSync(entryPath).flatMap((entry) =>
    listFiles(path.join(entryPath, entry)),
  );
};

const toRelative = (absolutePath, base) =>
  path.relative(base, absolutePath).split(path.sep).join('/');

const countOccurrences = (content, needle) => content.split(needle).length - 1;

const assertFreshCheckout = () => {
  if (twentyRoot === LAYER_REPOSITORY_ROOT && !process.env.CI) {
    console.error(
      'Refusing to rebrand your working tree. Pass a separate checkout, for example the one build-image.sh creates.',
    );
    process.exit(1);
  }

  if (!existsSync(path.join(twentyRoot, `${FRONT}/package.json`))) {
    console.error(`${twentyRoot} does not look like a Twenty checkout`);
    process.exit(1);
  }

  if (existsSync(path.join(twentyRoot, LAYER_MARKER_FILE_NAME))) {
    console.error(`The Upshift layer is already applied to ${twentyRoot}`);
    process.exit(1);
  }
};

const applyOverlays = () => {
  const overlayFiles = listFiles(OVERLAY_DIRECTORY);

  for (const overlayFile of overlayFiles) {
    const relativePath = toRelative(overlayFile, OVERLAY_DIRECTORY);
    const targetPath = path.join(twentyRoot, relativePath);

    if (!existsSync(targetPath)) {
      fail(`${relativePath} no longer exists in Twenty; move or drop its overlay`);
      continue;
    }

    const acceptedHashes = CODE_OVERLAY_UPSTREAM_SHA256[relativePath];

    if (acceptedHashes && !acceptedHashes.includes(sha256(targetPath))) {
      fail(
        `${relativePath} changed in Twenty (sha256 ${sha256(targetPath)}); review the overlay, then add the new hash to CODE_OVERLAY_UPSTREAM_SHA256`,
      );
      continue;
    }

    planWrite(
      targetPath,
      TEMPLATE_EXTENSIONS.has(path.extname(overlayFile))
        ? fillTemplate(readFileSync(overlayFile, 'utf8'))
        : readFileSync(overlayFile),
    );
  }

  const upstreamIcons = listFiles(path.join(twentyRoot, ICONS_RELATIVE_DIRECTORY));

  for (const iconPath of upstreamIcons) {
    const relativePath = toRelative(iconPath, twentyRoot);

    if (!existsSync(path.join(OVERLAY_DIRECTORY, relativePath))) {
      fail(
        `${relativePath} has no Upshift version; run node upshift/scripts/generate-icons.mjs --root <checkout>`,
      );
    }
  }

  return overlayFiles.length;
};

const applyPatches = () => {
  let replacementCount = 0;

  for (const patch of PATCHES) {
    const filePath = path.join(twentyRoot, patch.file);

    if (!existsSync(filePath)) {
      fail(`${patch.file} no longer exists in Twenty`);
      continue;
    }

    let content = readPlanned(filePath);

    for (const replacement of patch.replacements) {
      if (replacement.brandWord) {
        const matches = content.match(TWENTY_BRAND_WORD) ?? [];
        const minimum = replacement.minimum ?? 1;

        if (matches.length < minimum) {
          fail(
            `${patch.file}: expected at least ${minimum} "Twenty" mentions, found ${matches.length}`,
          );
          continue;
        }

        content = content.replace(TWENTY_BRAND_WORD, brand.name);
        replacementCount += matches.length;
        continue;
      }

      if (replacement.pattern) {
        const matches = content.match(replacement.pattern) ?? [];

        if (matches.length === 0) {
          fail(`${patch.file}: pattern ${replacement.pattern} not found`);
          continue;
        }

        content = content.replace(replacement.pattern, fillTemplate(replacement.to));
        replacementCount += matches.length;
        continue;
      }

      const expectedCount = replacement.count ?? 1;
      const actualCount = countOccurrences(content, replacement.from);

      if (actualCount !== expectedCount) {
        fail(
          `${patch.file}: expected ${expectedCount} occurrence(s) of ${JSON.stringify(replacement.from.split('\n')[0])}, found ${actualCount}`,
        );
        continue;
      }

      content = content.split(replacement.from).join(fillTemplate(replacement.to));
      replacementCount += actualCount;
    }

    planWrite(filePath, content);
  }

  return replacementCount;
};

const installCatalogHooks = () => {
  for (const { project, generatedDirectory } of CATALOG_HOOKS) {
    const projectJsonPath = path.join(twentyRoot, project, 'project.json');
    const compileCommand = '"command": "lingui compile --typescript"';
    const projectJson = readPlanned(projectJsonPath);

    if (countOccurrences(projectJson, compileCommand) !== 1) {
      fail(`${project}/project.json: lingui compile command not found exactly once`);
      continue;
    }

    planWrite(
      path.join(twentyRoot, project, CATALOG_HOOK_FILE_NAME),
      readFileSync(CATALOG_HOOK_SOURCE),
    );
    planWrite(
      path.join(twentyRoot, project, CATALOG_HOOK_CONFIGURATION_FILE_NAME),
      `${JSON.stringify(
        {
          brandName: brand.name,
          textReplacements: CATALOG_TEXT_REPLACEMENTS.map(([from, to]) => [
            from,
            fillTemplate(to),
          ]),
        },
        null,
        2,
      )}\n`,
    );
    planWrite(
      projectJsonPath,
      projectJson.replace(
        compileCommand,
        `"command": ${JSON.stringify(
          `lingui compile --typescript && node ${CATALOG_HOOK_FILE_NAME} ${generatedDirectory}`,
        )}`,
      ),
    );
  }
};

const disableYarnTelemetry = () => {
  for (const relativePath of YARN_CONFIGURATION_FILES) {
    const filePath = path.join(twentyRoot, relativePath);

    if (!existsSync(filePath)) {
      fail(`${relativePath} no longer exists in Twenty`);
      continue;
    }

    const content = readPlanned(filePath);

    if (!/^enableTelemetry:/m.test(content)) {
      planWrite(
        filePath,
        `${content.endsWith('\n') ? content : `${content}\n`}\nenableTelemetry: false\n`,
      );
    }
  }
};

const COMMENT_LINE = /^\s*(\/\/|\/\*|\*|\{\/\*)/;

const stripCommentLines = (content) =>
  content
    .split('\n')
    .filter((line) => !COMMENT_LINE.test(line))
    .join('\n');

const runReferenceCensus = () => {
  const scannedFiles = CENSUS_ROOTS.flatMap((relativeRoot) =>
    listFiles(path.join(twentyRoot, relativeRoot)),
  )
    .map((filePath) => toRelative(filePath, twentyRoot))
    .filter(
      (relativePath) =>
        CENSUS_TEXT_EXTENSIONS.has(path.extname(relativePath)) &&
        !CENSUS_EXCLUDED_PATH.test(relativePath),
    );

  for (const relativePath of scannedFiles) {
    const content = stripCommentLines(
      readFileSync(path.join(twentyRoot, relativePath), 'utf8'),
    );

    for (const { needle, allowed } of REFERENCE_CENSUS) {
      if (content.includes(needle) && !(relativePath in allowed)) {
        fail(
          `${relativePath} references ${needle}; patch it, or list it in REFERENCE_CENSUS if it is unreachable or intentional`,
        );
      }
    }
  }

  return scannedFiles.length;
};

assertFreshCheckout();
const overlayCount = applyOverlays();
const replacementCount = applyPatches();
installCatalogHooks();
disableYarnTelemetry();
exitOnFailures('preparation (nothing was written)');

commitPlannedWrites();
writeFileSync(
  path.join(twentyRoot, LAYER_MARKER_FILE_NAME),
  `${new Date().toISOString()}\n`,
);

const scannedFileCount = runReferenceCensus();
exitOnFailures('the reference census');

console.log(
  [
    `Upshift layer applied to ${twentyRoot}`,
    `  ${overlayCount} overlay files`,
    `  ${replacementCount} source replacements in ${PATCHES.length} files`,
    `  translation hook installed in ${CATALOG_HOOKS.length} packages`,
    `  reference census passed on ${scannedFileCount} shipped files`,
  ].join('\n'),
);
