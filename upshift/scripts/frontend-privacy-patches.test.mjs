import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import { applyReplacements } from './patch-replacements.mjs';

import { FRONTEND_PRIVACY_PATCHES } from './frontend-privacy-patches.mjs';

const sourceRoot =
  process.env.UPSHIFT_PRIVACY_SOURCE_ROOT ??
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const patchedSource = (suffix) => {
  const patch = FRONTEND_PRIVACY_PATCHES.find(({ file }) =>
    file.endsWith(suffix),
  );
  const source = readFileSync(path.join(sourceRoot, patch.file), 'utf8');
  const result = applyReplacements(source, patch.replacements);
  assert.deepEqual(result.failures, [], patch.file);
  return result.content;
};

const withoutImports = (source) =>
  source.replace(/^import[\s\S]*?from ['"][^'"]+['"];\s*/gm, '');

test('every frontend privacy patch matches upstream exactly', () => {
  for (const { file } of FRONTEND_PRIVACY_PATCHES) patchedSource(file);
});

test('admin tabs omit Organization and leave no dangling references', () => {
  const source = withoutImports(patchedSource('/useSettingsAdminTabs.ts'))
    .replace('export const ', 'const ');
  const tabs = Object.fromEntries(
    ['GENERAL', 'APPS', 'AI', 'CONFIG_VARIABLES', 'HEALTH_STATUS', 'ORGANIZATION']
      .map((tab) => [tab, tab]),
  );
  const useSettingsAdminTabs = vm.runInNewContext(
    stripTypeScriptTypes(`${source}\nuseSettingsAdminTabs;`),
    {
      SETTINGS_ADMIN_TABS: tabs,
      currentUserState: 'currentUser',
      useAtomStateValue: () => ({ canAccessFullAdminPanel: true, canImpersonate: false }),
      t: (strings, ...values) => String.raw({ raw: strings }, ...values),
      IconApps: 'IconApps',
      IconHeart: 'IconHeart',
      IconSettings2: 'IconSettings2',
      IconSparkles: 'IconSparkles',
      IconVariable: 'IconVariable',
    },
  );
  // Array.from keeps the comparison in this realm; vm arrays carry a foreign prototype.
  assert.deepEqual(
    Array.from(useSettingsAdminTabs(), ({ id }) => id),
    ['GENERAL', 'APPS', 'AI', 'CONFIG_VARIABLES', 'HEALTH_STATUS'],
  );
});

test('direct Organization tab access cannot render activation or checkout', () => {
  const source = withoutImports(patchedSource('/SettingsAdminTabContent.tsx'))
    .replace('export const ', 'const ')
    .replace(/<([A-Za-z]+) \/>/g, '"$1"');
  const tabs = Object.fromEntries(
    [
      'GENERAL',
      'APPS',
      'AI',
      'CONFIG_VARIABLES',
      'HEALTH_STATUS',
      'ORGANIZATION',
    ].map((tab) => [tab, tab]),
  );
  const renderTab = vm.runInNewContext(
    stripTypeScriptTypes(`${source}\nSettingsAdminTabContent;`),
    { SETTINGS_ADMIN_TABS: tabs },
  );
  assert.equal(renderTab({ activeTabId: 'ORGANIZATION' }), null);
  assert.equal(renderTab({ activeTabId: 'GENERAL' }), 'SettingsAdminGeneral');
  assert.equal(renderTab({ activeTabId: 'AI' }), 'SettingsAdminAI');
  assert.equal(renderTab({ activeTabId: 'APPS' }), 'SettingsAdminApps');
  assert.equal(
    renderTab({ activeTabId: 'CONFIG_VARIABLES' }),
    'SettingsAdminConfigVariables',
  );
  assert.equal(
    renderTab({ activeTabId: 'HEALTH_STATUS' }),
    'SettingsAdminHealthStatus',
  );
});

test('self-hosted feature gates do not offer enterprise purchase while billing stays available', () => {
  const source = withoutImports(
    patchedSource('/SettingsEnterpriseFeatureGateCard.tsx'),
  );
  const body = source.slice(
    source.indexOf('  const billing ='),
    source.indexOf('  return ('),
  );
  for (const isBillingEnabled of [false, true]) {
    const canDisplayUpgradeButton = vm.runInNewContext(
      `${body}\ncanDisplayUpgradeButton;`,
      {
        billingState: 'billing',
        useAtomStateValue: () => ({ isBillingEnabled }),
        useNavigateSettings: () => {},
        SettingsPath: {
          BillingPlans: 'billing',
          AdminPanelOrganization: 'organization',
        },
      },
    );
    assert.equal(canDisplayUpgradeButton, isBillingEnabled);
  }
});

test('enterprise settings do not mount the purchase modal', () => {
  assert.doesNotMatch(
    patchedSource('/SettingsEnterprise.tsx'),
    /<EnterprisePlanModal\b/,
  );
});
