import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import { LICENSE_UI_PATCHES } from './license-ui-patches.mjs';
import { applyReplacements } from './patch-replacements.mjs';

const sourceRoot =
  process.env.UPSHIFT_PRIVACY_SOURCE_ROOT ??
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const patchedSource = (suffix) => {
  const patch = LICENSE_UI_PATCHES.find(({ file }) => file.endsWith(suffix));
  const source = readFileSync(path.join(sourceRoot, patch.file), 'utf8');
  const result = applyReplacements(source, patch.replacements);
  assert.deepEqual(result.failures, [], patch.file);
  return result.content;
};

const between = (source, start, end) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);
  assert.ok(startIndex >= 0 && endIndex > startIndex, `${start} ... ${end}`);
  return source.slice(startIndex, endIndex);
};

const EVENT_LOG_TABLES = Object.fromEntries(
  ['PAGEVIEW', 'WORKSPACE_EVENT', 'OBJECT_EVENT', 'USAGE_EVENT', 'APPLICATION_LOG'].map(
    (table) => [table, table],
  ),
);

const IGNORED_WORDS = new Set(['boolean', 'const', 'from', 'import', 'null', 'return', 'true', 'undefined']);

const identifiers = (code) =>
  new Set(
    (code.replace(/'[^'\n]*'|"[^"\n]*"/g, '').match(/[A-Za-z_$][\w$]*/g) ?? []).filter(
      (word) => !IGNORED_WORDS.has(word),
    ),
  );

test('every license UI patch matches upstream exactly', () => {
  for (const { file } of LICENSE_UI_PATCHES) patchedSource(file);
});

test('patches keep brackets balanced', () => {
  const netBalance = (source, open, close) =>
    source.split(open).length - source.split(close).length;
  for (const { file } of LICENSE_UI_PATCHES) {
    const original = readFileSync(path.join(sourceRoot, file), 'utf8');
    const patched = patchedSource(file);
    for (const [open, close] of [['{', '}'], ['(', ')'], ['[', ']']]) {
      assert.equal(netBalance(patched, open, close), netBalance(original, open, close), `${file} ${open}${close}`);
    }
  }
});

// Any other upstream name an inserted line uses must appear in a `from`, so a Twenty rename fails the layer check
test('inserted code only introduces the names listed here', () => {
  const introducedByPatch = {
    'SettingsAdminAI.tsx': ['length'],
    'SettingsAdminAiProviderDetail.tsx': ['hasAccess', 'hasCustomAiProviderAccess', 'useCustomAiProviderAccess'],
    'SettingsAI.tsx': [
      'billing',
      'billingState',
      'currentWorkspace',
      'currentWorkspaceState',
      'hasEnterpriseAccess',
      'hasValidEnterpriseValidityToken',
      'isBillingEnabled',
      'useAtomStateValue',
    ],
    'SettingsLogs.tsx': ['isTableAvailable', 'isTableAvailableOnEveryPlan', 'table'],
    'EventLogTableSelector.tsx': ['filter', 'isTableAvailable'],
  };
  for (const { file, replacements } of LICENSE_UI_PATCHES) {
    const anchored = identifiers(replacements.map(({ from }) => from).join('\n'));
    const introduced = [...identifiers(replacements.map(({ to }) => to).join('\n'))]
      .filter((word) => !anchored.has(word))
      .sort();
    assert.deepEqual(introduced, introducedByPatch[path.basename(file)] ?? [], file);
  }
});

test('injected imports appear once in the patched file', () => {
  for (const { file, replacements } of LICENSE_UI_PATCHES) {
    const patched = patchedSource(file);
    const injectedImports = replacements
      .flatMap(({ to }) => to.split('\n'))
      .filter((line) => line.startsWith('import '));
    for (const importLine of injectedImports) {
      assert.equal(patched.split(`${importLine}\n`).length - 1, 1, `${file}: ${importLine}`);
    }
  }
});

test('patched screens no longer render a license prompt', () => {
  const licensePrompts = [
    '<OrganizationAdornment',
    '<SettingsEnterpriseFeatureGateCard',
    'SettingsPath.AdminPanelOrganization',
    '{customAiProviderGateDescription}',
    '={customAiProviderTooltipContent}',
    'Organization feature',
    'Organization plan',
    'Organization subscription',
    'Organization key',
    'Upgrade to',
  ];
  for (const { file } of LICENSE_UI_PATCHES) {
    const source = patchedSource(file);
    for (const prompt of licensePrompts) {
      assert.ok(!source.includes(prompt), `${file} still contains ${prompt}`);
    }
  }
});

test('paid settings sections render only for entitled workspaces', () => {
  const sectionGuards = [
    ['/SettingsSecuritySettings.tsx', '{hasSsoEntitlement && (', 'title={t`SSO`}'],
    ['/SettingsSecuritySettings.tsx', '{hasAuditLogsEntitlement && (', 'title={t`Audit Logs`}'],
    ['/ObjectSettings.tsx', 'hasValidationRulesEntitlement &&', 'title={t`Validation rules`}'],
    ['/SettingsRolesList.tsx', '{hasCustomRolesEntitlement && (', '{t`Create Role`}'],
    ['/SettingsAdminAI.tsx', '{hasEnterpriseAccess && (', 'title={t`AI Usage by Workspace`}'],
    [
      '/SettingsAdminAI.tsx',
      '{(hasCustomAiProviderAccess || customProviders.length > 0) && (',
      'title={t`Custom Providers`}',
    ],
    ['/SettingsAdminAiProviderDetail.tsx', 'hasCustomAiProviderAccess && newModelPath', '{t`Add Model`}'],
  ];
  for (const [file, guard, section] of sectionGuards) {
    const source = patchedSource(file);
    const guardIndex = source.indexOf(guard);
    assert.ok(guardIndex >= 0, `${file}: ${guard}`);
    assert.ok(source.indexOf(section) > guardIndex, `${file}: ${section} is not guarded`);
  }
  for (const [file, guard] of [
    ['/SettingsRolePermissionsObjectLevelRecordLevelSection.tsx', 'if (!hasOrganizationPlan) {'],
    ['/SettingsAiUsageTab.tsx', 'if (!hasEnterpriseAccess) {'],
  ]) {
    assert.match(
      between(patchedSource(file), guard, '}'),
      /^if \(!\w+\) \{\s+return null;\s+$/,
      file,
    );
  }
});

test('the AI settings Usage tab only exists with enterprise access', () => {
  const tabsSource = between(
    patchedSource('/pages/settings/ai/SettingsAI.tsx'),
    '  const currentWorkspace = useAtomStateValue(currentWorkspaceState);',
    '  const resolvedTabId',
  );
  const tabIds = ({ isBillingEnabled, hasValidEnterpriseValidityToken }) =>
    Array.from(
      vm.runInNewContext(`${tabsSource}\ntabs;`, {
        currentWorkspaceState: 'workspace',
        billingState: 'billing',
        useAtomStateValue: (atom) =>
          atom === 'billing' ? { isBillingEnabled } : { hasValidEnterpriseValidityToken },
        SETTINGS_AI_TABS: {
          TABS_IDS: { MCP: 'MCP', MODELS: 'MODELS', SKILLS: 'SKILLS', TOOLS: 'TOOLS', USAGE: 'USAGE' },
        },
        t: (strings) => strings.join(''),
        IconBook: 'IconBook',
        IconChartBar: 'IconChartBar',
        IconCpu: 'IconCpu',
        IconSparkles: 'IconSparkles',
        IconTool: 'IconTool',
      }),
      ({ id }) => id,
    );

  const freeTabs = ['MCP', 'MODELS', 'SKILLS', 'TOOLS'];
  assert.deepEqual(tabIds({ isBillingEnabled: false, hasValidEnterpriseValidityToken: false }), freeTabs);
  assert.deepEqual(
    tabIds({ isBillingEnabled: false, hasValidEnterpriseValidityToken: true }),
    [...freeTabs, 'USAGE'],
  );
  assert.deepEqual(
    tabIds({ isBillingEnabled: true, hasValidEnterpriseValidityToken: false }),
    [...freeTabs, 'USAGE'],
  );
});

test('the log console lists only the sources the workspace can read', () => {
  const sourcesSource = between(
    patchedSource('/LogConsole.tsx'),
    '  const isSourceLocked',
    '  const activeSource',
  );
  const sourceIds = (hasAuditLogsEntitlement) =>
    Array.from(
      vm.runInNewContext(stripTypeScriptTypes(`${sourcesSource}\nsources;`), {
        hasAuditLogsEntitlement,
        LOG_CONSOLE_SOURCES: [
          { id: 'records', requiresAuditLogs: false },
          { id: 'pageviews', requiresAuditLogs: true },
          { id: 'applications', requiresAuditLogs: false },
        ],
      }),
      ({ id }) => id,
    );

  assert.deepEqual(sourceIds(false), ['records', 'applications']);
  assert.deepEqual(sourceIds(true), ['records', 'pageviews', 'applications']);
});

test('settings logs open on, and only offer, the log types the workspace can read', () => {
  const settingsLogs = patchedSource('/SettingsLogs.tsx');
  const initialTable = between(settingsLogs, 'useState<EventLogTable>(', ');')
    .replace('useState<EventLogTable>(', '')
    .trim()
    .replace(/,$/, '');
  for (const [hasAuditLogsEntitlement, expected] of [
    [false, 'OBJECT_EVENT'],
    [true, 'PAGEVIEW'],
  ]) {
    assert.equal(
      vm.runInNewContext(initialTable, { hasAuditLogsEntitlement, EventLogTable: EVENT_LOG_TABLES }),
      expected,
    );
  }
  assert.match(settingsLogs, /const renderUpgradeCard = \(\) => null;/);

  const isTableAvailableOnEveryPlan = vm.runInNewContext(
    stripTypeScriptTypes(
      `${between(settingsLogs, 'const isTableAvailableOnEveryPlan', ';\n')};\nisTableAvailableOnEveryPlan;`,
    ),
    { EventLogTable: EVENT_LOG_TABLES },
  );
  const isTableAvailable = (hasAuditLogsEntitlement) =>
    vm.runInNewContext(
      `(${between(settingsLogs, 'isTableAvailable={', '}\n              />').replace('isTableAvailable={', '')})`,
      { hasAuditLogsEntitlement, isTableAvailableOnEveryPlan },
    );

  const selector = patchedSource('/EventLogTableSelector.tsx')
    .replace(/^import[\s\S]*?from ['"][^'"]+['"];\s*/gm, '')
    .replace('export const ', 'const ')
    .replace(/return \(\n\s*<Select[\s\S]*?\/>\n\s*\);/, 'return options;');
  const EventLogTableSelector = vm.runInNewContext(
    stripTypeScriptTypes(`${selector}\nEventLogTableSelector;`),
    {
      EventLogTable: EVENT_LOG_TABLES,
      msg: (strings) => strings.join(''),
      useLingui: () => ({ t: (label) => label }),
    },
  );
  const offeredTables = (props) =>
    Array.from(EventLogTableSelector(props), ({ value }) => value);

  assert.deepEqual(offeredTables({ isTableAvailable: isTableAvailable(false) }), [
    'OBJECT_EVENT',
    'APPLICATION_LOG',
  ]);
  assert.deepEqual(
    offeredTables({ isTableAvailable: isTableAvailable(true) }),
    Object.keys(EVENT_LOG_TABLES),
  );
  assert.deepEqual(offeredTables({}), Object.keys(EVENT_LOG_TABLES));
});
