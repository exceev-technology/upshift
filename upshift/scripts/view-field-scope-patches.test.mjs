import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { applyReplacements } from './patch-replacements.mjs';
import { VIEW_FIELD_SCOPE_PATCHES } from './view-field-scope-patches.mjs';

const SOURCE_ROOT =
  process.env.UPSHIFT_PRIVACY_SOURCE_ROOT ??
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// Either the patch inlines the fix, or the source already carries it (this fork's packages/)
const PARENT_OBJECT_SCOPE_FIX =
  /upshiftViewFieldOperations|getViewFieldParentObjectApplicationIds/;

const patchedSourceOf = (patch) =>
  applyReplacements(
    readFileSync(path.join(SOURCE_ROOT, patch.file), 'utf8'),
    patch.replacements,
  );

test('view field updates keep the parent view object app in the migration scope', () => {
  assert.equal(VIEW_FIELD_SCOPE_PATCHES.length, 1);

  const [patch] = VIEW_FIELD_SCOPE_PATCHES;
  const result = patchedSourceOf(patch);

  assert.deepEqual(result.failures, [], patch.file);
  assert.match(result.content, PARENT_OBJECT_SCOPE_FIX);
});

test('applying the view field scope patch twice changes nothing', () => {
  const [patch] = VIEW_FIELD_SCOPE_PATCHES;
  const once = patchedSourceOf(patch).content;
  const twice = applyReplacements(once, patch.replacements);

  assert.deepEqual(twice.failures, []);
  assert.equal(twice.content, once);
});
