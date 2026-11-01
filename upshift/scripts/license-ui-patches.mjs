const FRONT_SOURCE = 'packages/twenty-front/src';
const FRONT_MODULES = `${FRONT_SOURCE}/modules`;

const GATE_CARD_FILE = `${FRONT_MODULES}/settings/components/SettingsEnterpriseFeatureGateCard.tsx`;
const ORGANIZATION_ADORNMENT_FILE = `${FRONT_MODULES}/settings/enterprise/components/OrganizationAdornment.tsx`;

const REMOVE_GATE_CARD_IMPORT = {
  from: "import { SettingsEnterpriseFeatureGateCard } from '@/settings/components/SettingsEnterpriseFeatureGateCard';\n",
  to: '',
};

const REMOVE_ORGANIZATION_ADORNMENT_IMPORT = {
  from: "import { OrganizationAdornment } from '@/settings/enterprise/components/OrganizationAdornment';\n",
  to: '',
};

const lines = (...content) => content.join('\n');

// Pins upstream code that inserted lines depend on, so a rename fails the layer check instead of the page
const requireUnchanged = (text) => ({ from: text, to: text });

const ENTERPRISE_ACCESS_RULE = lines(
  '  const hasEnterpriseAccess =',
  '    isBillingEnabled ||',
  '    currentWorkspace?.hasValidEnterpriseValidityToken === true;',
  '',
);

const CUSTOM_AI_PROVIDER_BANNER = lines(
  '          {!hasCustomAiProviderAccess && (',
  '            <InlineBanner',
  '              layout="compact"',
  '              status="error"',
  '              action={',
  '                <InlineBanner.Action',
  '                  href={getSettingsPath(SettingsPath.AdminPanelOrganization)}',
  '                  nativeButton={false}',
  '                  role="link"',
  '                  render={',
  '                    <Link',
  '                      to={getSettingsPath(SettingsPath.AdminPanelOrganization)}',
  '                    />',
  '                  }',
  '                >{t`Activate`}</InlineBanner.Action>',
  '              }',
  '            >',
  '              {customAiProviderGateDescription}',
  '            </InlineBanner>',
  '          )}',
  '',
);

const CUSTOM_AI_PROVIDER_PAGE_ADORNMENT = lines(
  '              actions={',
  '                <OrganizationAdornment',
  '                  tooltipContent={customAiProviderTooltipContent}',
  '                />',
  '              }',
  '',
);

// Unlicensed workspaces lose the paid section entirely instead of an upgrade prompt; licensed ones keep it unchanged.
export const LICENSE_UI_PATCHES = [
  {
    file: `${FRONT_MODULES}/settings/security/components/SettingsSecuritySettings.tsx`,
    replacements: [
      REMOVE_GATE_CARD_IMPORT,
      REMOVE_ORGANIZATION_ADORNMENT_IMPORT,
      {
        from: lines(
          '        <StyledSectionContainer>',
          '          <Section.Root>',
          '            <Section.Header',
          '              title={t`SSO`}',
          '',
        ),
        to: lines(
          '        {hasSsoEntitlement && (',
          '        <StyledSectionContainer>',
          '          <Section.Root>',
          '            <Section.Header',
          '              title={t`SSO`}',
          '',
        ),
      },
      {
        from: lines(
          '              actions={<OrganizationAdornment />}',
          '            />',
          '            {hasSsoEntitlement ? (',
          '              <SettingsSsoIdentitiesProvidersListCard />',
          '            ) : (',
          '              <SettingsEnterpriseFeatureGateCard',
          '                title={t`Organization feature`}',
          '                description={t`Upgrade to Organization to configure SSO.`}',
          '                buttonTitle={t`Activate`}',
          '              />',
          '            )}',
          '          </Section.Root>',
          '        </StyledSectionContainer>',
          '',
        ),
        to: lines(
          '            />',
          '            <SettingsSsoIdentitiesProvidersListCard />',
          '          </Section.Root>',
          '        </StyledSectionContainer>',
          '        )}',
          '',
        ),
      },
      {
        from: lines(
          '        <Section.Root>',
          '          <Section.Header',
          '            title={t`Audit Logs`}',
          '            description={t`Configure how long audit logs are retained`}',
          '            actions={<OrganizationAdornment />}',
          '          />',
          '          {hasAuditLogsEntitlement ? (',
          '',
        ),
        to: lines(
          '        {hasAuditLogsEntitlement && (',
          '        <Section.Root>',
          '          <Section.Header',
          '            title={t`Audit Logs`}',
          '            description={t`Configure how long audit logs are retained`}',
          '          />',
          '',
        ),
      },
      {
        from: lines(
          '          ) : (',
          '            <SettingsEnterpriseFeatureGateCard',
          '              title={t`Organization feature`}',
          '              description={t`Logs are kept ${proPlanEventLogRetentionInHours} hours on your plan. Upgrade to customize retention.`}',
          '              buttonTitle={t`Activate`}',
          '            />',
          '          )}',
          '        </Section.Root>',
          '',
        ),
        to: lines('        </Section.Root>', '        )}', ''),
      },
    ],
  },
  {
    file: `${FRONT_MODULES}/settings/data-model/object-details/components/tabs/ObjectSettings.tsx`,
    replacements: [
      REMOVE_GATE_CARD_IMPORT,
      REMOVE_ORGANIZATION_ADORNMENT_IMPORT,
      {
        from: lines(
          '      {isRecordCreationFormEnabled &&',
          '        !objectMetadataItem.isRemote &&',
          '',
        ),
        to: lines(
          '      {isRecordCreationFormEnabled &&',
          '        hasValidationRulesEntitlement &&',
          '        !objectMetadataItem.isRemote &&',
          '',
        ),
      },
      {
        from: lines(
          '              actions={<OrganizationAdornment />}',
          '            />',
          '            {hasValidationRulesEntitlement ? (',
          '              <SettingsObjectValidationRulesSection',
          '                objectMetadataItem={objectMetadataItem}',
          '                isReadOnly={isReadOnly}',
          '              />',
          '            ) : (',
          '              <SettingsEnterpriseFeatureGateCard',
          '                title={t`Organization feature`}',
          '                description={t`Upgrade to Organization to set validation rules.`}',
          '                buttonTitle={t`Activate`}',
          '              />',
          '            )}',
          '',
        ),
        to: lines(
          '            />',
          '            <SettingsObjectValidationRulesSection',
          '              objectMetadataItem={objectMetadataItem}',
          '              isReadOnly={isReadOnly}',
          '            />',
          '',
        ),
      },
      {
        // Related record paths are newer than the latest release.
        optional: true,
        from: lines(
          '      {isRelatedRecordPathsEnabled &&',
          '        hasRolesPermission &&',
          '        !objectMetadataItem.isRemote && (',
          '          <Section.Root>',
          '            <Section.Header',
          '              title={t`Related records`}',
          '              description={t`Records reached through these relations follow access to ${objectLabel}.`}',
          '              actions={',
          '                <OrganizationAdornment',
          '                  tooltipContent={',
          '                    hasRelatedRecordPathsEntitlement',
          '                      ? undefined',
          '                      : t`Upgrade to Organization to change related records`',
          '                  }',
          '                />',
          '              }',
          '            />',
          '            <SettingsObjectRelatedRecordPathsSection',
          '              objectMetadataItem={objectMetadataItem}',
          '              isReadOnly={isDDLLocked || !hasRelatedRecordPathsEntitlement}',
          '            />',
          '',
        ),
        to: lines(
          '      {isRelatedRecordPathsEnabled &&',
          '        hasRolesPermission &&',
          '        hasRelatedRecordPathsEntitlement &&',
          '        !objectMetadataItem.isRemote && (',
          '          <Section.Root>',
          '            <Section.Header',
          '              title={t`Related records`}',
          '              description={t`Records reached through these relations follow access to ${objectLabel}.`}',
          '            />',
          '            <SettingsObjectRelatedRecordPathsSection',
          '              objectMetadataItem={objectMetadataItem}',
          '              isReadOnly={isDDLLocked}',
          '            />',
          '',
        ),
      },
    ],
  },
  {
    file: `${FRONT_MODULES}/settings/roles/role-permissions/object-level-permissions/record-level-permissions/components/SettingsRolePermissionsObjectLevelRecordLevelSection.tsx`,
    replacements: [
      REMOVE_ORGANIZATION_ADORNMENT_IMPORT,
      {
        from: lines(
          '  if (!hasOrganizationPlan) {',
          '    return (',
          '      <Section.Root>',
          '        <Section.Header',
          '          title={t`Record-level`}',
          '          description={t`Ability to filter the records a user can interact with`}',
          '          actions={<OrganizationAdornment />}',
          '        />',
          '        <StyledCardContainer>',
          '          <Card.Root>',
          '            <SettingsOptionCardContentButton',
          '              Icon={IconLock}',
          '              title={t`Upgrade to access`}',
          '              description={t`This feature is part of the Organization plan`}',
          '              Button={',
          '                <Button',
          '                  size="sm"',
          '                  startIcon={<IconArrowUp />}',
          '                  onClick={() =>',
          '                    navigateSettings(',
          '                      isBillingEnabled',
          '                        ? SettingsPath.BillingPlans',
          '                        : SettingsPath.AdminPanelOrganization,',
          '                    )',
          '                  }',
          '                  variant="solid"',
          '                  color="accent"',
          '                >{t`Upgrade`}</Button>',
          '              }',
          '            />',
          '          </Card.Root>',
          '        </StyledCardContainer>',
          '      </Section.Root>',
          '    );',
          '  }',
          '',
        ),
        to: lines('  if (!hasOrganizationPlan) {', '    return null;', '  }', ''),
      },
    ],
  },
  {
    file: `${FRONT_MODULES}/settings/roles/components/SettingsRolesList.tsx`,
    replacements: [
      REMOVE_ORGANIZATION_ADORNMENT_IMPORT,
      {
        from: lines(
          '      <TableFooter>',
          '        <StyledCreateRoleContainer>',
          '          {!hasCustomRolesEntitlement && (',
          '            <OrganizationAdornment',
          '              tooltipContent={t`Upgrade to Organization to create custom roles`}',
          '            />',
          '          )}',
          '',
        ),
        to: lines(
          '      {hasCustomRolesEntitlement && (',
          '      <TableFooter>',
          '        <StyledCreateRoleContainer>',
          '',
        ),
      },
      {
        from: lines('        </StyledCreateRoleContainer>', '      </TableFooter>', ''),
        to: lines(
          '        </StyledCreateRoleContainer>',
          '      </TableFooter>',
          '      )}',
          '',
        ),
      },
    ],
  },
  {
    file: `${FRONT_MODULES}/settings/admin-panel/ai/components/SettingsAdminAI.tsx`,
    replacements: [
      REMOVE_GATE_CARD_IMPORT,
      REMOVE_ORGANIZATION_ADORNMENT_IMPORT,
      requireUnchanged(ENTERPRISE_ACCESS_RULE),
      requireUnchanged('  const customProviders = providerItems.filter(\n'),
      {
        from: lines(
          '      <Section.Root>',
          '        <Section.Header',
          '          title={t`Custom Providers`}',
          '',
        ),
        to: lines(
          '      {(hasCustomAiProviderAccess || customProviders.length > 0) && (',
          '      <Section.Root>',
          '        <Section.Header',
          '          title={t`Custom Providers`}',
          '',
        ),
      },
      {
        from: lines(
          '          actions={',
          '            <OrganizationAdornment',
          '              tooltipContent={customAiProviderTooltipContent}',
          '            />',
          '          }',
          '',
        ),
        to: '',
      },
      {
        from: lines(
          '        {!hasCustomAiProviderAccess && (',
          '          <SettingsEnterpriseFeatureGateCard',
          '            title={t`Organization feature`}',
          '            description={customAiProviderGateDescription}',
          '            buttonTitle={t`Activate`}',
          '          />',
          '        )}',
          '      </Section.Root>',
          '',
        ),
        to: lines('      </Section.Root>', '      )}', ''),
      },
      {
        from: lines(
          '      <Section.Root>',
          '        <Section.Header',
          '          title={t`AI Usage by Workspace`}',
          '',
        ),
        to: lines(
          '      {hasEnterpriseAccess && (',
          '      <Section.Root>',
          '        <Section.Header',
          '          title={t`AI Usage by Workspace`}',
          '',
        ),
      },
      {
        from: lines(
          '            ) : (',
          '              <OrganizationAdornment />',
          '            )',
          '',
        ),
        to: lines('            ) : undefined', ''),
      },
      {
        from: lines(
          '        ) : (',
          '          <SettingsEnterpriseFeatureGateCard',
          '            title={t`Organization feature`}',
          '            description={t`AI usage analytics across workspaces is available with an Organization key.`}',
          '            buttonTitle={t`Activate`}',
          '          />',
          '        )}',
          '      </Section.Root>',
          '',
        ),
        to: lines('        ) : null}', '      </Section.Root>', '      )}', ''),
      },
    ],
  },
  {
    file: `${FRONT_SOURCE}/pages/settings/admin-panel/SettingsAdminNewAiModel.tsx`,
    replacements: [
      REMOVE_ORGANIZATION_ADORNMENT_IMPORT,
      { from: CUSTOM_AI_PROVIDER_BANNER, to: '' },
      { from: CUSTOM_AI_PROVIDER_PAGE_ADORNMENT, to: '' },
    ],
  },
  {
    file: `${FRONT_SOURCE}/pages/settings/admin-panel/SettingsAdminNewAiProvider.tsx`,
    replacements: [
      REMOVE_ORGANIZATION_ADORNMENT_IMPORT,
      { from: CUSTOM_AI_PROVIDER_BANNER, to: '' },
      { from: CUSTOM_AI_PROVIDER_PAGE_ADORNMENT, to: '' },
    ],
  },
  {
    file: `${FRONT_SOURCE}/pages/settings/admin-panel/SettingsAdminAiProviderDetail.tsx`,
    replacements: [
      {
        from: "import { useClientConfig } from '@/client-config/hooks/useClientConfig';\n",
        to: lines(
          "import { useClientConfig } from '@/client-config/hooks/useClientConfig';",
          "import { useCustomAiProviderAccess } from '@/settings/admin-panel/ai/hooks/useCustomAiProviderAccess';",
          '',
        ),
      },
      {
        from: '  const isCustomProvider = provider?.source === AI_PROVIDER_SOURCE.CUSTOM;\n',
        to: lines(
          '  const isCustomProvider = provider?.source === AI_PROVIDER_SOURCE.CUSTOM;',
          '  const { hasAccess: hasCustomAiProviderAccess } = useCustomAiProviderAccess();',
          '',
        ),
      },
      {
        from: '          {isCustomProvider && newModelPath && (\n',
        to: '          {isCustomProvider && hasCustomAiProviderAccess && newModelPath && (\n',
      },
    ],
  },
  {
    file: `${FRONT_SOURCE}/pages/settings/ai/components/SettingsAiUsageTab.tsx`,
    replacements: [
      REMOVE_GATE_CARD_IMPORT,
      REMOVE_ORGANIZATION_ADORNMENT_IMPORT,
      requireUnchanged(ENTERPRISE_ACCESS_RULE),
      {
        from: lines(
          '  if (!hasEnterpriseAccess) {',
          '    return (',
          '      <Section.Root>',
          '        <Section.Header',
          '          title={t`AI Usage`}',
          '          description={t`Track AI consumption across your workspace.`}',
          '          actions={<OrganizationAdornment />}',
          '        />',
          '        <SettingsEnterpriseFeatureGateCard',
          '          title={t`Organization feature`}',
          '          description={t`AI usage analytics is available with an Organization key.`}',
          '          buttonTitle={t`Activate`}',
          '        />',
          '      </Section.Root>',
          '    );',
          '  }',
          '',
        ),
        to: lines('  if (!hasEnterpriseAccess) {', '    return null;', '  }', ''),
      },
    ],
  },
  {
    // Mirrors ENTERPRISE_ACCESS_RULE, pinned in SettingsAiUsageTab, so the Usage tab disappears instead of opening empty
    file: `${FRONT_SOURCE}/pages/settings/ai/SettingsAI.tsx`,
    replacements: [
      {
        from: "import { SettingsAiUsageTab } from '~/pages/settings/ai/components/SettingsAiUsageTab';\n",
        to: lines(
          "import { SettingsAiUsageTab } from '~/pages/settings/ai/components/SettingsAiUsageTab';",
          "import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';",
          "import { billingState } from '@/client-config/states/billingState';",
          "import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';",
          '',
        ),
      },
      {
        from: lines('  const tabs = [', ''),
        to: lines(
          '  const currentWorkspace = useAtomStateValue(currentWorkspaceState);',
          '  const billing = useAtomStateValue(billingState);',
          '  const hasEnterpriseAccess =',
          '    billing?.isBillingEnabled === true ||',
          '    currentWorkspace?.hasValidEnterpriseValidityToken === true;',
          '',
          '  const tabs = [',
          '',
        ),
      },
      {
        from: lines(
          '    {',
          '      id: SETTINGS_AI_TABS.TABS_IDS.USAGE,',
          '      title: t`Usage`,',
          '      Icon: IconChartBar,',
          '    },',
          '  ];',
          '',
        ),
        to: lines(
          '    ...(hasEnterpriseAccess',
          '      ? [',
          '          {',
          '            id: SETTINGS_AI_TABS.TABS_IDS.USAGE,',
          '            title: t`Usage`,',
          '            Icon: IconChartBar,',
          '          },',
          '        ]',
          '      : []),',
          '  ];',
          '',
        ),
      },
    ],
  },
  {
    file: `${FRONT_MODULES}/log-console/components/LogConsole.tsx`,
    replacements: [
      REMOVE_GATE_CARD_IMPORT,
      {
        from: lines(
          '  const sources = [',
          '    ...LOG_CONSOLE_SOURCES.filter((source) => !isSourceLocked(source)),',
          '    ...LOG_CONSOLE_SOURCES.filter(isSourceLocked),',
          '  ];',
          '',
        ),
        to: lines(
          '  const sources = LOG_CONSOLE_SOURCES.filter(',
          '    (source) => !isSourceLocked(source),',
          '  );',
          '',
        ),
      },
      {
        from: lines(
          '    if (isSourceLocked(activeSource)) {',
          '      return (',
          '        <StyledUpgradeCardContainer>',
          '          <SettingsEnterpriseFeatureGateCard',
          '            title={t`Upgrade to access audit logs`}',
          '            description={t`Record changes and app logs are available on your current plan. Other log types require an Organization subscription.`}',
          '            buttonTitle={t`Upgrade`}',
          '          />',
          '        </StyledUpgradeCardContainer>',
          '      );',
          '    }',
          '',
          '',
        ),
        to: '',
      },
    ],
  },
  {
    file: `${FRONT_MODULES}/settings/event-logs/components/SettingsLogs.tsx`,
    replacements: [
      requireUnchanged(
        '  const hasAuditLogsEntitlement = checkIfBillingEntitlementIsEnabledOnWorkspace(\n',
      ),
      {
        from: lines(
          '  const isAvailableOnEveryPlan =',
          '    selectedTable === EventLogTable.APPLICATION_LOG ||',
          '    selectedTable === EventLogTable.OBJECT_EVENT;',
          '',
        ),
        to: lines(
          '  const isTableAvailableOnEveryPlan = (table: EventLogTable) =>',
          '    table === EventLogTable.APPLICATION_LOG ||',
          '    table === EventLogTable.OBJECT_EVENT;',
          '  const isAvailableOnEveryPlan = isTableAvailableOnEveryPlan(selectedTable);',
          '',
        ),
      },
      {
        from: lines(
          '  const [selectedTable, setSelectedTable] = useState<EventLogTable>(',
          '    EventLogTable.PAGEVIEW,',
          '  );',
          '',
        ),
        to: lines(
          '  const [selectedTable, setSelectedTable] = useState<EventLogTable>(',
          '    hasAuditLogsEntitlement',
          '      ? EventLogTable.PAGEVIEW',
          '      : EventLogTable.OBJECT_EVENT,',
          '  );',
          '',
        ),
      },
      {
        from: lines(
          '  const renderUpgradeCard = () => (',
          '    <Card.Root backgroundColor={themeCssVariables.background.secondary}>',
          '      <SettingsOptionCardContentButton',
          '        Icon={IconLock}',
          '        title={t`Upgrade to access audit logs`}',
          '        description={t`Record changes and app logs are available on your current plan. Other log types require an Organization subscription.`}',
          '        Button={',
          '          <Button',
          '            size="sm"',
          '            startIcon={<IconArrowUp />}',
          '            onClick={() =>',
          '              navigateSettings(',
          '                isBillingEnabled',
          '                  ? SettingsPath.BillingPlans',
          '                  : SettingsPath.AdminPanelOrganization,',
          '              )',
          '            }',
          '            variant="solid"',
          '            color="accent"',
          '          >{t`Upgrade`}</Button>',
          '        }',
          '      />',
          '    </Card.Root>',
          '  );',
          '',
        ),
        to: lines('  const renderUpgradeCard = () => null;', ''),
      },
      {
        from: lines(
          '              <EventLogTableSelector',
          '                value={selectedTable}',
          '                onChange={handleTableChange}',
          '              />',
          '',
        ),
        to: lines(
          '              <EventLogTableSelector',
          '                value={selectedTable}',
          '                onChange={handleTableChange}',
          '                isTableAvailable={(table) =>',
          '                  hasAuditLogsEntitlement || isTableAvailableOnEveryPlan(table)',
          '                }',
          '              />',
          '',
        ),
      },
    ],
  },
  {
    file: `${FRONT_MODULES}/settings/event-logs/components/EventLogTableSelector.tsx`,
    replacements: [
      {
        from: lines('  onChange: (value: EventLogTable) => void;', '};', ''),
        to: lines(
          '  onChange: (value: EventLogTable) => void;',
          '  isTableAvailable?: (table: EventLogTable) => boolean;',
          '};',
          '',
        ),
      },
      {
        from: lines('  value,', '  onChange,', '}: EventLogTableSelectorProps) => {', ''),
        to: lines(
          '  value,',
          '  onChange,',
          '  isTableAvailable = () => true,',
          '}: EventLogTableSelectorProps) => {',
          '',
        ),
      },
      {
        from: lines('  ).map(([table, label]) => ({', ''),
        to: lines(
          '  )',
          '    .filter(([table]) => isTableAvailable(table))',
          '    .map(([table, label]) => ({',
          '',
        ),
      },
    ],
  },
];

const REMOVED_LICENSE_UI = 'license prompt with every caller patched out; any new caller must be reviewed';
const CLOUD_BILLING_ONLY = 'Twenty Cloud billing settings, not linked while billing is off';
const ORGANIZATION_TAB_REDIRECT = 'old /settings/enterprise link redirected to the hidden Organization tab';
const ORGANIZATION_TAB_PAGE = 'rendered only by the Organization tab, which the privacy patches remove';

// A Twenty sync that adds a new license prompt fails the build instead of shipping it
export const LICENSE_UI_CENSUS = [
  {
    needle: 'OrganizationAdornment',
    allowed: {
      [ORGANIZATION_ADORNMENT_FILE]: REMOVED_LICENSE_UI,
      [`${FRONT_MODULES}/settings/billing/components/SettingsBillingLimitSpenderSelect.tsx`]:
        CLOUD_BILLING_ONLY,
    },
  },
  {
    needle: 'SettingsEnterpriseFeatureGateCard',
    allowed: { [GATE_CARD_FILE]: REMOVED_LICENSE_UI },
  },
  {
    needle: 'SettingsPath.AdminPanelOrganization',
    allowed: {
      [GATE_CARD_FILE]: REMOVED_LICENSE_UI,
      [`${FRONT_MODULES}/app/components/SettingsRoutes.tsx`]: ORGANIZATION_TAB_REDIRECT,
      [`${FRONT_SOURCE}/pages/settings/enterprise/SettingsEnterprise.tsx`]: ORGANIZATION_TAB_PAGE,
    },
  },
  {
    needle: 'SettingsPath.Enterprise',
    allowed: {
      [`${FRONT_MODULES}/app/components/SettingsRoutes.tsx`]: ORGANIZATION_TAB_REDIRECT,
      [`${FRONT_SOURCE}/pages/settings/enterprise/SettingsEnterprise.tsx`]: ORGANIZATION_TAB_PAGE,
    },
  },
];
