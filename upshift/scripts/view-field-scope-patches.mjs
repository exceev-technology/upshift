const SERVER = 'packages/twenty-server/src';

// Upstream scopes the parent view's object only one hop deep, so a view field whose field and
// view belong to other apps than its object fails validation. Optional: this fork's packages/ already carries the fix.
const PARENT_VIEW_OBJECT_APPLICATION_IDS = [
  '      applicationIds.add(targetRelationApplicationId);',
  '    }',
  '',
  '    const upshiftViewFieldOperations =',
  '      allFlatEntityOperationRecordByMetadataName.viewField;',
  '',
  '    for (const viewField of isDefined(upshiftViewFieldOperations)',
  '      ? [',
  '          ...Object.values(upshiftViewFieldOperations.flatEntityToCreate),',
  '          ...Object.values(upshiftViewFieldOperations.flatEntityToUpdate),',
  '          ...Object.values(upshiftViewFieldOperations.flatEntityToDelete),',
  '        ]',
  '      : []) {',
  '      const parentView = isDefined(viewField)',
  '        ? allRelatedFlatEntityMaps.flatViewMaps?.byUniversalIdentifier[',
  '            viewField.viewUniversalIdentifier',
  '          ]',
  '        : undefined;',
  '      const parentObject = isDefined(parentView)',
  '        ? allRelatedFlatEntityMaps.flatObjectMetadataMaps',
  '            ?.byUniversalIdentifier[parentView.objectMetadataUniversalIdentifier]',
  '        : undefined;',
  '',
  '      if (isDefined(parentObject)) {',
  '        applicationIds.add(parentObject.applicationId);',
  '      }',
  '    }',
  '',
  '    for (const metadataName of Object.keys(',
].join('\n');

export const VIEW_FIELD_SCOPE_PATCHES = [
  {
    file: `${SERVER}/engine/workspace-manager/workspace-migration/services/workspace-migration-flat-entity-maps.service.ts`,
    replacements: [
      {
        from: [
          '      applicationIds.add(targetRelationApplicationId);',
          '    }',
          '',
          '    for (const metadataName of Object.keys(',
        ].join('\n'),
        to: PARENT_VIEW_OBJECT_APPLICATION_IDS,
        optional: true,
      },
    ],
  },
];
