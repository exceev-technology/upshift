const FRONT_MODULES = 'packages/twenty-front/src/modules';

// Removing the mounts prevents persisted instance settings from enabling browser telemetry.
export const FRONTEND_PRIVACY_PATCHES = [
  {
    file: 'packages/twenty-front/src/modules/settings/admin-panel/hooks/useSettingsAdminTabs.ts',
    replacements: [
      {
        from: "import { billingState } from '@/client-config/states/billingState';\n",
        to: '',
      },
      {
        from: '  IconKey,\n',
        to: '',
      },
      {
        from: '  const billing = useAtomStateValue(billingState);\n',
        to: '',
      },
      {
        from: '  const isBillingEnabled = billing?.isBillingEnabled;\n',
        to: '',
      },
    ],
  },
  {
    file: 'packages/twenty-front/src/modules/settings/admin-panel/components/SettingsAdminTabContent.tsx',
    replacements: [
      {
        from: "import { SettingsSectionSkeletonLoader } from '@/settings/components/SettingsSectionSkeletonLoader';\n",
        to: '',
      },
      {
        from: "import { lazy, Suspense } from 'react';\n",
        to: '',
      },
      {
        from: "const SettingsEnterprise = lazy(() =>\n  import('~/pages/settings/enterprise/SettingsEnterprise').then((module) => ({\n    default: module.SettingsEnterprise,\n  })),\n);\n",
        to: '',
      },
      {
        from: '    case SETTINGS_ADMIN_TABS.ORGANIZATION:\n      return (\n        <Suspense fallback={<SettingsSectionSkeletonLoader />}>\n          <SettingsEnterprise isAdminPanelTab />\n        </Suspense>\n      );\n',
        to: '',
      },
    ],
  },
  {
    file: 'packages/twenty-front/src/pages/settings/enterprise/SettingsEnterprise.tsx',
    replacements: [
      {
        from: '  EnterprisePlanModal,\n',
        to: '',
      },
      {
        from: '      <EnterprisePlanModal />\n',
        to: '',
      },
    ],
  },
  {
    file: 'packages/twenty-front/src/modules/settings/components/SettingsEnterpriseFeatureGateCard.tsx',
    replacements: [
      {
        from: "import { currentUserState } from '@/auth/states/currentUserState';\n",
        to: '',
      },
      {
        from: '  const currentUser = useAtomStateValue(currentUserState);\n',
        to: '',
      },
      {
        from: '  const canAccessAdminPanel = currentUser?.canAccessFullAdminPanel === true;\n',
        to: '',
      },
      {
        from: '  const canDisplayUpgradeButton = isBillingEnabled || canAccessAdminPanel;',
        to: '  const canDisplayUpgradeButton = isBillingEnabled;',
      },
    ],
  },
  {
    file: `${FRONT_MODULES}/app/components/RootAppProviders.tsx`,
    replacements: [
      {
        from: "import { TrackPageViewEffect } from '@/analytics/components/TrackPageViewEffect';\n",
        to: '',
      },
      {
        pattern: /^[ \t]*<TrackPageViewEffect \/>[ \t]*\r?\n/gm,
        to: '',
      },
    ],
  },
  {
    file: `${FRONT_MODULES}/app/components/WorkspaceAppProviders.tsx`,
    replacements: [
      {
        from: "import { TrackPageViewEffect } from '@/analytics/components/TrackPageViewEffect';\n",
        to: '',
      },
      {
        pattern: /^[ \t]*<TrackPageViewEffect \/>[ \t]*\r?\n/gm,
        to: '',
      },
    ],
  },
  {
    file: `${FRONT_MODULES}/error-handler/components/ExceptionHandlerProvider.tsx`,
    replacements: [
      {
        from: "import { SentryInitEffect } from '@/error-handler/components/SentryInitEffect';\n",
        to: '',
      },
      {
        pattern: /^[ \t]*<SentryInitEffect \/>[ \t]*\r?\n/gm,
        to: '',
      },
    ],
  },
];
