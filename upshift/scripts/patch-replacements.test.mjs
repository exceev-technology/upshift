import assert from 'node:assert/strict';
import test from 'node:test';

import { applyReplacements } from './patch-replacements.mjs';

test('literal replacements enforce counts and expand templates without interpreting dollar syntax', () => {
  const result = applyReplacements('old old', [{ from: 'old', to: '{{name}} $&', count: 2 }],
    (value) => value.replace('{{name}}', 'Upshift'));
  assert.deepEqual(result, {
    content: 'Upshift $& Upshift $&', replacementCount: 2, failures: [],
  });
});

test('pattern replacements preserve capture expansion and template rendering', () => {
  const result = applyReplacements('version1 version2', [{ pattern: /version(\d)/g, to: '{{name}}-$1' }],
    (value) => value.replace('{{name}}', 'Upshift'));
  assert.deepEqual(result, {
    content: 'Upshift-1 Upshift-2', replacementCount: 2, failures: [],
  });
});

test('optional literals skip missing anchors but still reject unexpected occurrence counts', () => {
  const result = applyReplacements('keep keep', [
    { from: 'absent', to: 'unused', optional: true },
    { from: 'keep', to: 'changed', optional: true },
  ]);
  assert.equal(result.content, 'keep keep');
  assert.equal(result.replacementCount, 0);
  assert.equal(result.failures.length, 1);
  assert.match(result.failures[0], /expected 1 occurrence.*found 2/);
});

test('branding only replaces product words and honors the configured minimum', () => {
  const content = 'Twenty TwentyClient https://Twenty.com';
  const result = applyReplacements(content, [{ brandWord: true }], undefined, 'OurPlatform');
  assert.equal(result.content, 'OurPlatform TwentyClient https://Twenty.com');
  assert.equal(result.replacementCount, 1);
  assert.deepEqual(result.failures, []);
  const rejected = applyReplacements(content, [{ brandWord: true, minimum: 2 }]);
  assert.equal(rejected.content, content);
  assert.match(rejected.failures[0], /expected at least 2/);
});

test('missing mandatory literal and pattern anchors retain preparation diagnostics', () => {
  const result = applyReplacements('unchanged', [
    { from: 'missing', to: 'replacement' },
    { pattern: /missing/g, to: 'replacement' },
  ]);
  assert.equal(result.content, 'unchanged');
  assert.equal(result.replacementCount, 0);
  assert.equal(result.failures.length, 2);
  assert.match(result.failures[0], /expected 1 occurrence/);
  assert.match(result.failures[1], /pattern .* not found/);
});
