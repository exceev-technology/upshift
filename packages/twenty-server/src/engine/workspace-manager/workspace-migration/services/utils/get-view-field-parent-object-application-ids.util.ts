import { isDefined } from 'twenty-shared/utils';

import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';
import { type FlatViewField } from 'src/engine/metadata-modules/flat-view-field/types/flat-view-field.type';
import { type FlatView } from 'src/engine/metadata-modules/flat-view/types/flat-view.type';

type ViewFieldParentView = Pick<FlatViewField, 'viewUniversalIdentifier'>;

type ViewFieldOperations = {
  flatEntityToCreate: Partial<Record<string, ViewFieldParentView>>;
  flatEntityToUpdate: Partial<Record<string, ViewFieldParentView>>;
  flatEntityToDelete: Partial<Record<string, ViewFieldParentView>>;
};

// The parent view's object is two hops from a view field, so its app is missed by the direct-relation scan.
export const getViewFieldParentObjectApplicationIds = ({
  flatViewMaps,
  flatObjectMetadataMaps,
  viewFieldOperations,
}: {
  flatViewMaps:
    | {
        byUniversalIdentifier: Partial<
          Record<string, Pick<FlatView, 'objectMetadataUniversalIdentifier'>>
        >;
      }
    | undefined;
  flatObjectMetadataMaps:
    | {
        byUniversalIdentifier: Partial<
          Record<string, Pick<FlatObjectMetadata, 'applicationId'>>
        >;
      }
    | undefined;
  viewFieldOperations: ViewFieldOperations | undefined;
}): string[] => {
  if (
    !isDefined(flatViewMaps) ||
    !isDefined(flatObjectMetadataMaps) ||
    !isDefined(viewFieldOperations)
  ) {
    return [];
  }

  const applicationIds = new Set<string>();

  for (const viewField of [
    ...Object.values(viewFieldOperations.flatEntityToCreate),
    ...Object.values(viewFieldOperations.flatEntityToUpdate),
    ...Object.values(viewFieldOperations.flatEntityToDelete),
  ]) {
    if (!isDefined(viewField)) {
      continue;
    }

    const parentView =
      flatViewMaps.byUniversalIdentifier[viewField.viewUniversalIdentifier];

    if (!isDefined(parentView)) {
      continue;
    }

    const parentObject =
      flatObjectMetadataMaps.byUniversalIdentifier[
        parentView.objectMetadataUniversalIdentifier
      ];

    if (isDefined(parentObject)) {
      applicationIds.add(parentObject.applicationId);
    }
  }

  return [...applicationIds];
};
