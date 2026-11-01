#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { PLATFORM_WORDING_REPLACEMENTS } from './catalog-wording.mjs';
import { CURRENCY_PATCHES } from './currency-patches.mjs';
import { FRONTEND_PRIVACY_PATCHES } from './frontend-privacy-patches.mjs';
import { LICENSE_MESSAGE_REWRITES } from './license-message-wording.mjs';
import { LICENSE_UI_CENSUS, LICENSE_UI_PATCHES } from './license-ui-patches.mjs';
import {
  OBSERVABILITY_PATCHES,
  readObservabilityInstrumentation,
} from './observability-patches.mjs';
import { applyReplacements, countOccurrences } from './patch-replacements.mjs';
import { PHONE_COUNTRY_PATCHES } from './phone-country-patches.mjs';
import { SERVER_PRIVACY_PATCHES } from './server-privacy-patches.mjs';
import { VERSION_PATCHES } from './version-patches.mjs';

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
  ...Object.values(PLATFORM_WORDING_REPLACEMENTS).flat(),
];
const PLATFORM_SUMMARY =
  "a business platform that digitizes all of a company's processes, from CRM and sales to operations, finance and HR";
const LAYER_MARKER_FILE_NAME = '.upshift-layer-applied';
const ICONS_RELATIVE_DIRECTORY = 'packages/twenty-front/public/images/icons';
const TEMPLATE_EXTENSIONS = new Set(['.ts', '.tsx', '.json', '.html', '.md']);

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
  ...FRONTEND_PRIVACY_PATCHES,
  ...LICENSE_UI_PATCHES,
  ...PHONE_COUNTRY_PATCHES,
  ...SERVER_PRIVACY_PATCHES,
  ...OBSERVABILITY_PATCHES,
  ...VERSION_PATCHES,
  ...CURRENCY_PATCHES,
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
    file: [
      `${FRONT}/src/modules/settings/mcp/constants/McpSetup.ts`,
      `${FRONT}/src/modules/settings/mcp-and-apis/constants/McpSetup.ts`,
    ],
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
    file: [
      `${FRONT}/src/modules/settings/mcp/utils/buildMcpSetupCategories.tsx`,
      `${FRONT}/src/modules/settings/mcp-and-apis/utils/buildMcpSetupCategories.tsx`,
    ],
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
    ],
  },
  // The cover shows Twenty's contributors; the changelog stays hidden until Upshift publishes its own
  {
    file: `${FRONT}/src/pages/settings/community/SettingsCommunity.tsx`,
    replacements: [
      {
        from: '  IconBrandX,\n  IconBriefcase,\n',
        to: '  IconBrandLinkedin,\n  IconBrandX,\n  IconBriefcase,\n',
      },
      {
        from: [
          "      href: 'https://discord.com/invite/cx5n4Jzs57',",
          '      Icon: IconBrandDiscord,',
          '      iconColor: themeCssVariables.color.blue9,',
          '      cardTitle: t`Join our Discord`,',
        ].join('\n'),
        to: [
          "      href: '{{linkedinUrl}}',",
          '      Icon: IconBrandLinkedin,',
          '      iconColor: themeCssVariables.color.blue9,',
          '      cardTitle: t`Follow us on LinkedIn`,',
        ].join('\n'),
      },
      { from: "'https://x.com/twentycrm'", to: "'{{xUrl}}'" },
      {
        from: [
          '        <Section.Root>',
          '          <SettingsDiscoveryHeroCard',
          '            lightSrc={coverLight}',
          '            darkSrc={coverDark}',
          '            instanceIdPrefix={SETTINGS_COMMUNITY_HERO_INSTANCE_ID_PREFIX}',
          '            tabs={[]}',
          '          />',
          '        </Section.Root>',
          '',
          '',
        ].join('\n'),
        to: '',
      },
      // One layout per Twenty version (v2.48 dropped StyledCardLink); the census fails on
      // the twenty.com links if neither matches
      {
        from: [
          '        <Section.Root>',
          '          <Section.Header',
          '            title={t`Partners`}',
          '            description={t`Hire a partner to help you implement and customize Twenty.`}',
          '          />',
          '          <SettingsCard',
          '            href="https://twenty.com/partners/list"',
          '            Icon={',
          '              <IconBriefcase',
          '                size={theme.icon.size.md}',
          '                stroke={theme.icon.stroke.sm}',
          '              />',
          '            }',
          '            title={t`Browse partners`}',
          '          />',
          '        </Section.Root>',
          '',
          '',
        ].join('\n'),
        to: '',
        optional: true,
      },
      {
        from: [
          '        <Section.Root>',
          '          <Section.Header',
          '            title={t`Partners`}',
          '            description={t`Hire a partner to help you implement and customize Twenty.`}',
          '          />',
          '          <StyledCardLink',
          '            href="https://twenty.com/partners/list"',
          '            target="_blank"',
          '            rel="noopener noreferrer"',
          '          >',
          '            <SettingsCard',
          '              Icon={',
          '                <IconBriefcase',
          '                  size={theme.icon.size.md}',
          '                  stroke={theme.icon.stroke.sm}',
          '                />',
          '              }',
          '              title={t`Browse partners`}',
          '            />',
          '          </StyledCardLink>',
          '        </Section.Root>',
          '',
          '',
        ].join('\n'),
        to: '',
        optional: true,
      },
      {
        from: [
          '            <SettingsCard',
          '              href="https://twenty.com/releases"',
          '              Icon={',
          '                <IconTransform',
          '                  size={theme.icon.size.md}',
          '                  stroke={theme.icon.stroke.sm}',
          '                />',
          '              }',
          '              title={t`Read changelog`}',
          '            />',
          '',
        ].join('\n'),
        to: '',
        optional: true,
      },
      {
        from: [
          '            <StyledCardLink',
          '              href="https://twenty.com/releases"',
          '              target="_blank"',
          '              rel="noopener noreferrer"',
          '            >',
          '              <SettingsCard',
          '                Icon={',
          '                  <IconTransform',
          '                    size={theme.icon.size.md}',
          '                    stroke={theme.icon.stroke.sm}',
          '                  />',
          '                }',
          '                title={t`Read changelog`}',
          '              />',
          '            </StyledCardLink>',
          '',
        ].join('\n'),
        to: '',
        optional: true,
      },
      // Self-hosted servers usually expose no beta feature, which would leave an empty section
      {
        from: "import { SettingsLabContent } from '@/settings/lab/components/SettingsLabContent';\n",
        to: [
          "import { SettingsLabContent } from '@/settings/lab/components/SettingsLabContent';",
          "import { labPublicFeatureFlagsState } from '@/client-config/states/labPublicFeatureFlagsState';",
          "import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';",
          '',
        ].join('\n'),
      },
      {
        from: "import { getSettingsPath } from 'twenty-shared/utils';",
        to: "import { getSettingsPath, isNonEmptyArray } from 'twenty-shared/utils';",
      },
      {
        from: '  const { getIcon } = useIcons();\n',
        to: [
          '  const { getIcon } = useIcons();',
          '  const labPublicFeatureFlags = useAtomStateValue(labPublicFeatureFlagsState);',
          '',
        ].join('\n'),
      },
      {
        from: [
          '        <Section.Root>',
          '          <Section.Header',
          '            title={t`Features`}',
        ].join('\n'),
        to: [
          '        {isNonEmptyArray(labPublicFeatureFlags) && (',
          '        <Section.Root>',
          '          <Section.Header',
          '            title={t`Features`}',
        ].join('\n'),
      },
      {
        from: '          </StyledFeaturesContent>\n        </Section.Root>\n',
        to: '          </StyledFeaturesContent>\n        </Section.Root>\n        )}\n',
      },
    ],
  },
  {
    file: `${FRONT}/src/locales/fr-FR.po`,
    replacements: [
      {
        pattern: /(\nmsgid "Follow us on X"\nmsgstr "[^"\n]*"\n)/g,
        to: '$1\n#: src/pages/settings/community/SettingsCommunity.tsx\nmsgid "Follow us on LinkedIn"\nmsgstr "Suivez-nous sur LinkedIn"\n',
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
    file: [
      `${FRONT}/src/pages/settings/developers/tabs/SettingsDevelopersAppsTab.tsx`,
      `${FRONT}/src/pages/settings/applications/tabs/SettingsApplicationsDeveloperTab.tsx`,
    ],
    replacements: [
      // Replaced after Twenty v2.50 by the standalone CLI commands, which name the app my-app
      {
        from: "'npx create-twenty-app@latest my-twenty-app'",
        to: "'npx create-twenty-app@latest my-{{slug}}-app'",
        optional: true,
      },
      { from: "'cd my-twenty-app'", to: "'cd my-{{slug}}-app'", optional: true },
    ],
  },
  {
    file: `${FRONT}/src/pages/settings/developers/tabs/SettingsDevelopersCliTab.tsx`,
    optional: true,
    replacements: [
      {
        from: "'https://github.com/twentyhq/twenty/blob/main/packages/twenty-cli/docs/commands.md'",
        to: "'{{docsUrl}}/developers/extend/apps/operations/cli'",
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
    file: [
      `${FRONT}/src/modules/apollo/services/ApolloFactory.ts`,
      `${FRONT}/src/modules/apollo/services/apollo.factory.ts`,
    ],
    replacements: [{ brandWord: true }],
  },
  {
    file: 'packages/twenty-front-component-renderer/src/remote/worker/fetch-proxy/utils/getTextBodyFromFetchRequestArguments.ts',
    replacements: [{ brandWord: true, minimum: 2 }],
  },
  {
    file: [
      `${FRONT}/src/modules/settings/mcp/utils/mcpSetup.ts`,
      `${FRONT}/src/modules/settings/mcp-and-apis/utils/mcpSetup.ts`,
    ],
    replacements: [
      // Translated since Twenty v2.48, where the catalog hook rebrands it
      {
        from: "'Access your Twenty workspace through MCP'",
        to: "'Access your {{name}} workspace through MCP'",
        optional: true,
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
      // Twenty removed the sign-up DPA link after v2.50
      {
        from: 'href="https://twenty.com/legal/dpa"',
        to: 'href="{{dpaUrl}}"',
        optional: true,
      },
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
      // One layout per Twenty version (v2.50 moved the search to the docs MCP server); the
      // census fails on the Twenty search URL if neither matches
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
        optional: true,
      },
      {
        from: "'https://twenty-help-search.com/search/twenty'",
        to: "''",
        optional: true,
      },
      {
        from: '    try {\n      const httpClient = this.secureHttpClientService.getHttpClient({\n',
        to: [
          "    if (HELP_CENTER_MCP_URL === '') {",
          '      return {',
          '        success: false,',
          '        message: `Help center search is not available for "${query}"`,',
          "        error: 'Help center search is disabled',",
          '      };',
          '    }',
          '',
          '    try {',
          '      const httpClient = this.secureHttpClientService.getHttpClient({',
          '',
        ].join('\n'),
        optional: true,
      },
      { from: "'https://docs.twenty.com/mcp'", to: "''", optional: true },
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
      { from: "title: 'Twenty CRM',", to: "title: '{{name}}'," },
      {
        from: "'Read and write your Twenty CRM data",
        to: "'Read and write your {{name}} data",
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
    file: [
      `${SERVER}/engine/core-modules/open-api/utils/base-schema.util.ts`,
      `${SERVER}/engine/core-modules/open-api/utils/base-schema.utils.ts`,
    ],
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
  // Upshift digitizes all company processes, CRM included: text calling the product
  // "a CRM" or "Twenty CRM" is reworded, CRM as one of its parts stays. Runs before
  // the brand word pass below.
  {
    file: `${SERVER}/engine/api/mcp/utils/build-mcp-server-instructions.util.ts`,
    replacements: [
      { from: 'for a Twenty CRM workspace.', to: 'for this Twenty workspace.' },
      {
        from: 'Your role is to manage CRM data,',
        to: 'Your role is to manage workspace data,',
      },
    ],
  },
  {
    file: `${SERVER}/engine/metadata-modules/ai/ai-agent/constants/agent-run-base-system-prompt.const.ts`,
    replacements: [
      { from: 'You are an AI agent in Twenty CRM,', to: 'You are an AI agent in Twenty,' },
    ],
  },
  {
    file: `${SERVER}/engine/metadata-modules/ai/ai-agent-trigger/constants/agent-trigger-base-system-prompt.const.ts`,
    optional: true,
    replacements: [
      { from: 'You are an AI agent in Twenty CRM,', to: 'You are an AI agent in Twenty,' },
    ],
  },
  ...[
    'engine/metadata-modules/ai/ai-chat/constants/chat-system-prompts.const.ts',
    'engine/metadata-modules/ai/ai-chat/constants/workspace-setup-system-prompt.constant.ts',
  ].map((relativePath) => ({
    file: `${SERVER}/${relativePath}`,
    replacements: [
      {
        from: 'Twenty, a CRM (similar to Salesforce)',
        to: `Twenty, ${PLATFORM_SUMMARY} (similar to Salesforce)`,
      },
    ],
  })),
  {
    file: `${SERVER}/engine/metadata-modules/ai/ai-chat/constants/chat-system-prompts.const.ts`,
    replacements: [
      { from: 'for ALL Twenty CRM data operations', to: 'for ALL Twenty data operations' },
    ],
  },
  {
    file: `${SERVER}/engine/metadata-modules/ai/ai-chat/constants/workspace-setup-alternative-system-prompt.constant.ts`,
    optional: true,
    replacements: [
      { from: 'inside Twenty, a CRM, holding', to: `inside Twenty, ${PLATFORM_SUMMARY}, holding` },
    ],
  },
  {
    file: [
      `${SERVER}/modules/workflow/workflow-executor/workflow-actions/ai-agent/constants/workflow-base-system-prompt.constant.ts`,
      `${SERVER}/engine/metadata-modules/ai/ai-agent/constants/workflow-base-system-prompt.const.ts`,
    ],
    replacements: [
      { from: 'workflow automation in Twenty CRM.', to: 'workflow automation in Twenty.' },
    ],
  },
  {
    file: `${SERVER}/database/commands/upgrade-version-command/2-46/suspend-paused-agent-steps-run-spec.util.ts`,
    optional: true,
    replacements: [
      { from: 'workflow automation in Twenty CRM.', to: 'workflow automation in Twenty.' },
    ],
  },
  {
    file: `${SERVER}/engine/workspace-manager/twenty-standard-application/utils/agent-metadata/create-standard-flat-agent-metadata.util.ts`,
    replacements: [
      { from: 'learn how to use Twenty CRM', to: 'learn how to use Twenty' },
    ],
  },
  ...[
    [
      'engine/core-modules/tool/tools/code-interpreter-tool/twenty-mcp-helper.constant.ts',
      'engine/core-modules/tool/tools/code-interpreter-tool/twenty-mcp-helper.const.ts',
    ],
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
    'engine/api/mcp/utils/build-mcp-server-instructions.util.ts',
    'engine/workspace-manager/twenty-standard-application/utils/agent-metadata/create-standard-flat-agent-metadata.util.ts',
    'engine/metadata-modules/navigation-menu-item/tools/schemas/navigation-menu-item-scope.schema.ts',
  ].map((relativePath) => ({
    file: [relativePath].flat().map((path) => `${SERVER}/${path}`),
    replacements: [{ brandWord: true }],
  })),
  {
    file: [
      `${SERVER}/modules/workflow/workflow-executor/workflow-actions/ai-agent/constants/workflow-base-system-prompt.constant.ts`,
      `${SERVER}/engine/metadata-modules/ai/ai-agent/constants/workflow-base-system-prompt.const.ts`,
    ],
    replacements: [{ brandWord: true }],
  },
  // Not in the latest Twenty release yet: patched once a release ships them
  ...[
    'engine/metadata-modules/ai/ai-agent-trigger/constants/agent-trigger-base-system-prompt.const.ts',
    'engine/metadata-modules/ai/ai-chat/constants/workspace-setup-alternative-system-prompt.constant.ts',
    'database/commands/upgrade-version-command/2-46/suspend-paused-agent-steps-run-spec.util.ts',
  ].map((relativePath) => ({
    file: `${SERVER}/${relativePath}`,
    optional: true,
    replacements: [{ brandWord: true }],
  })),
  {
    file: `${SERVER}/engine/core-modules/tool/tools/email-tool/email-tool.schema.ts`,
    replacements: [
      {
        from: '"href":"https://twenty.com"',
        to: '"href":"{{websiteUrl}}"',
        optional: true,
      },
    ],
  },
  {
    file: `${EMAILS}/components/Logo.tsx`,
    replacements: [
      {
        from: 'src="https://app.twenty.com/images/icons/windows11/Square150x150Logo.scale-100.png"',
        to: 'src="{{publicAssetsBaseUrl}}/logo-email.png"',
      },
      // Translated since Twenty v2.48, where the catalog hook rebrands it
      { from: 'alt="Twenty logo"', to: 'alt="{{name}} logo"', optional: true },
    ],
  },
  {
    file: `${EMAILS}/components/BaseHead.tsx`,
    replacements: [
      // Translated since Twenty v2.48, where the catalog hook rebrands it
      {
        from: '<title>Twenty email</title>',
        to: '<title>{{name}} email</title>',
        optional: true,
      },
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
    messageRewrites: LICENSE_MESSAGE_REWRITES,
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

// Every remaining reference to Twenty-owned hosts, links or removed UI; anything new fails the build until reviewed
const REFERENCE_CENSUS = [
  {
    needle: 'TrackPageViewEffect',
    allowed: {
      [`${FRONT}/src/modules/analytics/components/TrackPageViewEffect.tsx`]:
        'unmounted component; any new caller must be reviewed',
    },
  },
  {
    needle: 'SentryInitEffect',
    allowed: {
      [`${FRONT}/src/modules/error-handler/components/SentryInitEffect.tsx`]:
        'unmounted component; any new caller must be reviewed',
    },
  },
  {
    needle: 'twenty.com',
    allowed: {
      [`${FRONT}/src/pages/settings/applications/utils/getCustomApplicationDescription.ts`]:
        TRANSLATED_IN_CATALOGS,
      [`${FRONT}/src/pages/settings/applications/utils/getStandardApplicationDescription.ts`]:
        TRANSLATED_IN_CATALOGS,
      [`${FRONT}/src/modules/applications/utils/getCustomApplicationDescription.ts`]:
        TRANSLATED_IN_CATALOGS,
      [`${FRONT}/src/modules/applications/utils/getStandardApplicationDescription.ts`]:
        TRANSLATED_IN_CATALOGS,
      [`${FRONT}/src/modules/settings/billing/constants/SettingsBillingPlanComparisonRows.ts`]:
        TRANSLATED_IN_CATALOGS,
      [`${SERVER}/engine/api/common/common-args-processors/data-arg-processor/validator-utils/validate-links-field-or-throw.util.ts`]:
        TRANSLATED_IN_CATALOGS,
      [`${SERVER}/engine/core-modules/dpa/config/dpa-region-config.constant.ts`]: UNREACHABLE_DPA,
      [`${SERVER}/engine/core-modules/dpa/constants/dpa-template.constant.ts`]: UNREACHABLE_DPA,
      [`${SERVER}/engine/core-modules/twenty-config/config-variables.ts`]:
        'enterprise network requests are blocked before this URL is read',
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
  ...LICENSE_UI_CENSUS,
];

const { values: options } = parseArgs({
  options: {
    root: { type: 'string' },
    'check-catalogs': { type: 'boolean', default: false },
  },
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
    mkdirSync(path.dirname(filePath), { recursive: true });
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
    const candidateFiles = Array.isArray(patch.file) ? patch.file : [patch.file];
    const patchedFile = candidateFiles.find((candidateFile) =>
      existsSync(path.join(twentyRoot, candidateFile)),
    );

    if (!patchedFile) {
      if (!patch.optional) {
        fail(`${candidateFiles.join(' or ')} no longer exists in Twenty`);
      }

      continue;
    }

    const filePath = path.join(twentyRoot, patchedFile);
    const content = readPlanned(filePath);

    const result = applyReplacements(
      content,
      patch.replacements,
      fillTemplate,
      brand.name,
    );
    result.failures.forEach((message) => fail(`${patchedFile}: ${message}`));
    replacementCount += result.replacementCount;
    planWrite(filePath, result.content);
  }

  return replacementCount;
};

const installCatalogHooks = () => {
  for (const { project, generatedDirectory, messageRewrites } of CATALOG_HOOKS) {
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
          messageRewrites,
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

// The Docker build compiles catalogs from source; the committed compiled ones exercise the same hook early
const checkCompiledCatalogs = () => {
  for (const { project, generatedDirectory } of CATALOG_HOOKS) {
    const result = spawnSync(
      process.execPath,
      [CATALOG_HOOK_FILE_NAME, generatedDirectory],
      { cwd: path.join(twentyRoot, project), stdio: 'inherit' },
    );

    if (result.status !== 0) {
      fail(`${project}: the translation hook rejected the compiled catalogs`);
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
try {
  for (const { filePath, content } of readObservabilityInstrumentation(twentyRoot)) {
    planWrite(filePath, content);
  }
} catch (error) {
  fail(`Could not prepare observability instrumentation: ${error.message}`);
}
exitOnFailures('preparation (nothing was written)');

commitPlannedWrites();
writeFileSync(
  path.join(twentyRoot, LAYER_MARKER_FILE_NAME),
  `${new Date().toISOString()}\n`,
);

const scannedFileCount = runReferenceCensus();
exitOnFailures('the reference census');

if (options['check-catalogs']) {
  checkCompiledCatalogs();
  exitOnFailures('the catalog check');
}

console.log(
  [
    `Upshift layer applied to ${twentyRoot}`,
    `  ${overlayCount} overlay files`,
    `  ${replacementCount} source replacements in ${PATCHES.length} files`,
    `  translation hook installed in ${CATALOG_HOOKS.length} packages`,
    `  reference census passed on ${scannedFileCount} shipped files`,
  ].join('\n'),
);
