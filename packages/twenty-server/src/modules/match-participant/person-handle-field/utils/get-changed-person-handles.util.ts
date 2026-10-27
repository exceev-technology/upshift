import { isDefined } from 'twenty-shared/utils';

import { type PersonHandleField } from 'src/modules/match-participant/person-handle-field/types/person-handle-field.type';
import { getCanonicalPersonHandles } from 'src/modules/match-participant/person-handle-field/utils/get-canonical-person-handles.util';
import { getPersonFieldValue } from 'src/modules/match-participant/person-handle-field/utils/get-person-field-value.util';

const getHandles = ({
  personHandleField,
  person,
}: {
  personHandleField: PersonHandleField;
  person: object | null;
}): { primary: string[]; additional: string[] } => {
  if (!isDefined(person)) {
    return { primary: [], additional: [] };
  }

  return getCanonicalPersonHandles({
    type: personHandleField.type,
    value: getPersonFieldValue({ person, fieldName: personHandleField.name }),
  });
};

const haveSameHandles = (handlesBefore: string[], handlesAfter: string[]) => {
  const handleSetBefore = new Set(handlesBefore);
  const handleSetAfter = new Set(handlesAfter);

  return (
    handleSetBefore.size === handleSetAfter.size &&
    [...handleSetBefore].every((handle) => handleSetAfter.has(handle))
  );
};

type PersonChange = {
  personId: string;
  before: object | null;
  after: object | null;
};

export const getChangedPersonHandles = ({
  personHandleField,
  personChanges,
}: {
  personHandleField: PersonHandleField;
  personChanges: PersonChange[];
}): { handles: string[]; changedPersonIds: string[] } => {
  const handles = new Set<string>();
  const changedPersonIds = new Set<string>();

  for (const { personId, before, after } of personChanges) {
    const handlesBefore = getHandles({ personHandleField, person: before });
    const handlesAfter = getHandles({ personHandleField, person: after });

    // a primary value wins over an additional one when matching, so moving a value between them is a change
    const isUnchanged =
      haveSameHandles(handlesBefore.primary, handlesAfter.primary) &&
      haveSameHandles(handlesBefore.additional, handlesAfter.additional);

    if (isUnchanged) {
      continue;
    }

    changedPersonIds.add(personId);

    for (const handle of [
      ...handlesBefore.primary,
      ...handlesBefore.additional,
      ...handlesAfter.primary,
      ...handlesAfter.additional,
    ]) {
      handles.add(handle);
    }
  }

  return { handles: [...handles], changedPersonIds: [...changedPersonIds] };
};
