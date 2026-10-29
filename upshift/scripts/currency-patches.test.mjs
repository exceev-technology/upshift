import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import { CURRENCY_PATCHES } from './currency-patches.mjs';
import { applyReplacements } from './patch-replacements.mjs';

const SOURCE_ROOT =
  process.env.UPSHIFT_PRIVACY_SOURCE_ROOT ??
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const patchedSource = (suffix) => {
  const patch = CURRENCY_PATCHES.find(({ file }) => file.endsWith(suffix));
  const result = applyReplacements(
    readFileSync(path.join(SOURCE_ROOT, patch.file), 'utf8'),
    patch.replacements,
  );
  assert.deepEqual(result.failures, [], patch.file);
  return result.content;
};

const loadCurrencyCodeIcons = () => {
  const source = patchedSource('/CurrencyCodeIcons.ts');
  const iconImports = source.match(/import \{([^}]*)\} from 'twenty-ui\/icon';/);
  const iconStubs = Object.fromEntries(
    iconImports[1]
      .split(',')
      .map((name) => name.trim())
      .filter((name) => name !== '' && !name.startsWith('type '))
      .map((name) => [name, name]),
  );
  const moduleBody = source
    .replace(/^import[\s\S]*?from ['"][^'"]+['"];\s*/gm, '')
    .replace('export const ', 'const ');

  return vm.runInNewContext(
    stripTypeScriptTypes(`${moduleBody}\nCURRENCY_CODE_ICONS;`),
    {
      ...iconStubs,
      createElement: (type, props, ...children) => ({ type, props, children }),
    },
  );
};

test('every currency patch matches upstream exactly', () => {
  for (const { file } of CURRENCY_PATCHES) patchedSource(file);
});

test('Moroccan dirham shows its MAD code instead of the UAE dirham sign', () => {
  const { MAD } = loadCurrencyCodeIcons();
  const rendered = MAD({
    className: 'leading-icon',
    style: { opacity: 0.5 },
    color: 'gray',
    size: 16,
    stroke: 1.6,
  });

  assert.equal(rendered.type, 'span');
  assert.deepEqual(rendered.children, ['MAD']);
  assert.deepEqual(Object.keys(rendered.props).sort(), ['className', 'style']);
  assert.equal(rendered.props.className, 'leading-icon');
  assert.equal(rendered.props.style.opacity, 0.5);
  assert.equal(rendered.props.style.color, 'gray');
});

test('the MAD code keeps the caller style color when no color is passed', () => {
  const { MAD } = loadCurrencyCodeIcons();

  assert.equal(MAD({ style: { color: 'red' } }).props.style.color, 'red');
});

test('UAE dirham keeps the Tabler dirham icon', () => {
  assert.equal(loadCurrencyCodeIcons().AED, 'IconCurrencyDirham');
});
