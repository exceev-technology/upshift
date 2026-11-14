import { DEFAULT_VIEW_GROUP_LOAD_LIMIT } from 'twenty-shared/constants';
import {
  FieldMetadataType,
  ViewOpenRecordIn,
  ViewType,
  ViewVisibility,
} from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

import { type FlatApplicationCacheMaps } from 'src/engine/core-modules/application/types/flat-application-cache-maps.type';
import { createEmptyFlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/constant/create-empty-flat-entity-maps.constant';
import { type SyncableFlatEntity } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-from.type';
import { type FlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { addFlatEntityToFlatEntityMapsOrThrow } from 'src/engine/metadata-modules/flat-entity/utils/add-flat-entity-to-flat-entity-maps-or-throw.util';
import { getFlatFieldMetadataMock } from 'src/engine/metadata-modules/flat-field-metadata/__mocks__/get-flat-field-metadata.mock';
import { getFlatObjectMetadataMock } from 'src/engine/metadata-modules/flat-object-metadata/__mocks__/get-flat-object-metadata.mock';
import { type FlatViewField } from 'src/engine/metadata-modules/flat-view-field/types/flat-view-field.type';
import { type FlatView } from 'src/engine/metadata-modules/flat-view/types/flat-view.type';
import { type MetadataSideEffectEngineService } from 'src/engine/metadata-modules/metadata-side-effect/services/metadata-side-effect-engine.service';
import { type WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { TWENTY_STANDARD_APPLICATION } from 'src/engine/workspace-manager/twenty-standard-application/constants/twenty-standard-applications';
import {
  WorkspaceMigrationFlatEntityMapsService,
  type WorkspaceMigrationRelatedFlatEntityMaps,
} from 'src/engine/workspace-manager/workspace-migration/services/workspace-migration-flat-entity-maps.service';
import { type FlatEntityUpdateValidationArgs } from 'src/engine/workspace-manager/workspace-migration/workspace-migration-builder/types/universal-flat-entity-update-validation-args.type';
import { FlatViewFieldValidatorService } from 'src/engine/workspace-manager/workspace-migration/workspace-migration-builder/validators/services/flat-view-field-validator.service';

const WORKSPACE_ID = 'workspace-id';
const TIMESTAMP = '2026-11-14T00:00:00.000Z';

const STANDARD_APPLICATION = {
  id: 'standard-application-id',
  universalIdentifier: TWENTY_STANDARD_APPLICATION.universalIdentifier,
};
const CUSTOM_APPLICATION = {
  id: 'custom-application-id',
  universalIdentifier: 'custom-application',
};
const INVENTORY_APPLICATION = {
  id: 'inventory-application-id',
  universalIdentifier: 'inventory-application',
};
const MEDICAL_DEVICES_APPLICATION = {
  id: 'medical-devices-application-id',
  universalIdentifier: 'medical-devices-application',
};

const ALL_APPLICATIONS = [
  STANDARD_APPLICATION,
  CUSTOM_APPLICATION,
  INVENTORY_APPLICATION,
  MEDICAL_DEVICES_APPLICATION,
];

const OBJECT_UNIVERSAL_IDENTIFIER = 'product-model';
const VIEW_UNIVERSAL_IDENTIFIER = 'product-model-all-view';

const buildFlatEntityMaps = <TFlatEntity extends SyncableFlatEntity>(
  flatEntities: TFlatEntity[],
): FlatEntityMaps<TFlatEntity> =>
  flatEntities.reduce<FlatEntityMaps<TFlatEntity>>(
    (flatEntityMaps, flatEntity) =>
      addFlatEntityToFlatEntityMapsOrThrow({ flatEntity, flatEntityMaps }),
    createEmptyFlatEntityMaps(),
  );

const flatObjectMetadata = getFlatObjectMetadataMock({
  id: 'product-model-id',
  universalIdentifier: OBJECT_UNIVERSAL_IDENTIFIER,
  applicationId: INVENTORY_APPLICATION.id,
  applicationUniversalIdentifier: INVENTORY_APPLICATION.universalIdentifier,
  labelIdentifierFieldMetadataId: 'name-id',
  labelIdentifierFieldMetadataUniversalIdentifier: 'name',
});

const buildField = ({
  universalIdentifier,
  type,
  application,
}: {
  universalIdentifier: string;
  type: FieldMetadataType;
  application: { id: string; universalIdentifier: string };
}) =>
  getFlatFieldMetadataMock({
    id: `${universalIdentifier}-id`,
    universalIdentifier,
    type,
    objectMetadataId: flatObjectMetadata.id,
    objectMetadataUniversalIdentifier: OBJECT_UNIVERSAL_IDENTIFIER,
    applicationId: application.id,
    applicationUniversalIdentifier: application.universalIdentifier,
  });

const FIELDS = {
  crossAppRelation: buildField({
    universalIdentifier: 'modality',
    type: FieldMetadataType.RELATION,
    application: MEDICAL_DEVICES_APPLICATION,
  }),
  sameAppRelation: buildField({
    universalIdentifier: 'manufacturer',
    type: FieldMetadataType.RELATION,
    application: INVENTORY_APPLICATION,
  }),
  nonRelation: buildField({
    universalIdentifier: 'reference',
    type: FieldMetadataType.TEXT,
    application: INVENTORY_APPLICATION,
  }),
};

const buildViewField = (
  field: (typeof FIELDS)[keyof typeof FIELDS],
  position: number,
): FlatViewField => ({
  id: `${field.universalIdentifier}-view-field-id`,
  universalIdentifier: `${field.universalIdentifier}-view-field`,
  workspaceId: WORKSPACE_ID,
  applicationId: field.applicationId,
  applicationUniversalIdentifier: field.applicationUniversalIdentifier,
  fieldMetadataId: field.id,
  viewId: 'product-model-all-view-id',
  viewFieldGroupId: null,
  isVisible: true,
  size: 150,
  position,
  aggregateOperation: null,
  isActive: true,
  isSystemSideEffect: false,
  isCanonical: true,
  overrides: null,
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
  deletedAt: null,
  fieldMetadataUniversalIdentifier: field.universalIdentifier,
  viewUniversalIdentifier: VIEW_UNIVERSAL_IDENTIFIER,
  viewFieldGroupUniversalIdentifier: null,
  universalOverrides: null,
});

const VIEW_FIELDS = {
  crossAppRelation: buildViewField(FIELDS.crossAppRelation, 1),
  sameAppRelation: buildViewField(FIELDS.sameAppRelation, 2),
  nonRelation: buildViewField(FIELDS.nonRelation, 3),
};

const flatView: FlatView = {
  id: 'product-model-all-view-id',
  universalIdentifier: VIEW_UNIVERSAL_IDENTIFIER,
  workspaceId: WORKSPACE_ID,
  applicationId: CUSTOM_APPLICATION.id,
  applicationUniversalIdentifier: CUSTOM_APPLICATION.universalIdentifier,
  objectMetadataId: flatObjectMetadata.id,
  name: 'All product models',
  icon: 'IconList',
  type: ViewType.TABLE,
  key: null,
  position: 0,
  isCompact: false,
  openRecordIn: ViewOpenRecordIn.SIDE_PANEL,
  kanbanAggregateOperation: null,
  kanbanAggregateOperationFieldMetadataId: null,
  calendarLayout: null,
  calendarFieldMetadataId: null,
  calendarEndFieldMetadataId: null,
  mainGroupByFieldMetadataId: null,
  shouldHideEmptyGroups: false,
  shouldDisplayGroupsAsTabs: false,
  kanbanColumnWidth: null,
  groupLoadLimit: DEFAULT_VIEW_GROUP_LOAD_LIMIT,
  anyFieldFilterValue: null,
  visibility: ViewVisibility.WORKSPACE,
  isActive: true,
  isSystemSideEffect: false,
  createdByUserWorkspaceId: null,
  overrides: null,
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
  deletedAt: null,
  viewFieldIds: Object.values(VIEW_FIELDS).map(({ id }) => id),
  viewFieldGroupIds: [],
  viewFilterIds: [],
  viewFilterGroupIds: [],
  viewSortIds: [],
  viewGroupIds: [],
  navigationMenuItemIds: [],
  viewFieldUniversalIdentifiers: Object.values(VIEW_FIELDS).map(
    ({ universalIdentifier }) => universalIdentifier,
  ),
  viewFieldGroupUniversalIdentifiers: [],
  viewFilterUniversalIdentifiers: [],
  viewFilterGroupUniversalIdentifiers: [],
  viewSortUniversalIdentifiers: [],
  viewGroupUniversalIdentifiers: [],
  navigationMenuItemUniversalIdentifiers: [],
  objectMetadataUniversalIdentifier: OBJECT_UNIVERSAL_IDENTIFIER,
  kanbanAggregateOperationFieldMetadataUniversalIdentifier: null,
  calendarFieldMetadataUniversalIdentifier: null,
  calendarEndFieldMetadataUniversalIdentifier: null,
  mainGroupByFieldMetadataUniversalIdentifier: null,
  universalOverrides: null,
};

const flatApplicationMaps: FlatApplicationCacheMaps = {
  byId: {},
  idByUniversalIdentifier: Object.fromEntries(
    ALL_APPLICATIONS.map(({ id, universalIdentifier }) => [
      universalIdentifier,
      id,
    ]),
  ),
};

const allRelatedFlatEntityMaps = {
  flatViewFieldMaps: buildFlatEntityMaps(Object.values(VIEW_FIELDS)),
  flatViewMaps: buildFlatEntityMaps([flatView]),
  flatFieldMetadataMaps: buildFlatEntityMaps(Object.values(FIELDS)),
  flatObjectMetadataMaps: buildFlatEntityMaps([flatObjectMetadata]),
  flatViewFieldGroupMaps: createEmptyFlatEntityMaps(),
} as WorkspaceMigrationRelatedFlatEntityMaps;

const validateViewFieldUpdate = ({
  flatViewField,
  update,
}: {
  flatViewField: FlatViewField;
  update: Partial<Pick<FlatViewField, 'position' | 'isVisible'>>;
}) => {
  const flatEntityMapsService = new WorkspaceMigrationFlatEntityMapsService(
    {} as WorkspaceCacheService,
    {} as MetadataSideEffectEngineService,
  );

  const flatViewFieldToUpdate = { ...flatViewField, ...update };

  const {
    fromToAllFlatEntityMaps,
    dependencyAllFlatEntityMaps,
    additionalCacheDataMaps,
    inferDeletionFromMissingEntities,
  } = flatEntityMapsService.computeFromToAllFlatEntityMapsAndBuildOptions({
    allFlatEntityOperationRecordByMetadataName: {
      viewField: {
        flatEntityToCreate: {},
        flatEntityToDelete: {},
        flatEntityToUpdate: {
          [flatViewFieldToUpdate.universalIdentifier]: flatViewFieldToUpdate,
        },
      },
    },
    applicationUniversalIdentifier: CUSTOM_APPLICATION.universalIdentifier,
    flatApplicationMaps,
    allRelatedFlatEntityMaps,
    allMetadataNameCacheToCompute: [
      'viewField',
      'view',
      'fieldMetadata',
      'objectMetadata',
      'viewFieldGroup',
    ],
  });

  const optimisticFlatViewFieldMaps =
    fromToAllFlatEntityMaps.flatViewFieldMaps?.to;

  if (!isDefined(optimisticFlatViewFieldMaps)) {
    throw new Error('Expected optimistic view field maps');
  }

  const validationArgs: FlatEntityUpdateValidationArgs<'viewField'> = {
    universalIdentifier: flatViewField.universalIdentifier,
    flatEntityUpdate: update,
    finalFlatEntityMaps: optimisticFlatViewFieldMaps,
    workspaceId: WORKSPACE_ID,
    additionalCacheDataMaps,
    buildOptions: {
      isSystemBuild: false,
      inferDeletionFromMissingEntities,
      applicationUniversalIdentifier: CUSTOM_APPLICATION.universalIdentifier,
      workspaceCustomApplicationUniversalIdentifier:
        CUSTOM_APPLICATION.universalIdentifier,
      flatApplicationMaps,
    },
    optimisticFlatEntityMapsAndRelatedFlatEntityMaps: {
      ...dependencyAllFlatEntityMaps,
      flatViewFieldMaps: optimisticFlatViewFieldMaps,
    } as FlatEntityUpdateValidationArgs<'viewField'>['optimisticFlatEntityMapsAndRelatedFlatEntityMaps'],
  };

  return new FlatViewFieldValidatorService().validateFlatViewFieldUpdate(
    validationArgs,
  );
};

describe('WorkspaceMigrationFlatEntityMapsService view field update scope', () => {
  it.each([
    ['position', { position: 4 }],
    ['visibility', { isVisible: false }],
  ])(
    'validates a %s update of a relation column owned by another app than the view object',
    (_, update) => {
      const validationResult = validateViewFieldUpdate({
        flatViewField: VIEW_FIELDS.crossAppRelation,
        update,
      });

      expect(validationResult.errors).toEqual([]);
    },
  );

  it.each([
    ['same-app relation', VIEW_FIELDS.sameAppRelation],
    ['non-relation', VIEW_FIELDS.nonRelation],
  ])('validates a position update of a %s column', (_, flatViewField) => {
    const validationResult = validateViewFieldUpdate({
      flatViewField,
      update: { position: 4 },
    });

    expect(validationResult.errors).toEqual([]);
  });
});
