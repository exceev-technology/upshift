import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  cpSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import { LICENSE_MESSAGE_REWRITES, toLinguiMessageId } from './license-message-wording.mjs';

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot =
  process.env.UPSHIFT_PRIVACY_SOURCE_ROOT ?? path.resolve(scriptsDirectory, '../..');
const serverCatalogs = path.join(
  sourceRoot,
  'packages/twenty-server/src/engine/core-modules/i18n/locales/generated',
);

const JSON_PARSE_PREFIX = 'JSON.parse(';
const JSON_PARSE_SUFFIX = ')as Messages;';

const readCatalog = (filePath) => {
  const content = readFileSync(filePath, 'utf8');
  return JSON.parse(
    vm.runInNewContext(
      content.slice(
        content.indexOf(JSON_PARSE_PREFIX) + JSON_PARSE_PREFIX.length,
        content.lastIndexOf(JSON_PARSE_SUFFIX),
      ),
    ),
  );
};

const writeCatalog = (filePath, messages) =>
  writeFileSync(
    filePath,
    `/*eslint-disable*/import type{Messages}from"@lingui/core";export const messages=${JSON_PARSE_PREFIX}${JSON.stringify(JSON.stringify(messages))}${JSON_PARSE_SUFFIX}`,
  );

const readCatalogs = (directory) =>
  Object.fromEntries(
    readdirSync(directory)
      .filter((fileName) => fileName.endsWith('.ts'))
      .map((fileName) => [fileName, readCatalog(path.join(directory, fileName))]),
  );

// Runs the real translation hook on a copy of the catalogs, as the build does after lingui compile
const runHook = (catalogDirectory, messageRewrites) => {
  const hookDirectory = mkdtempSync(path.join(tmpdir(), 'upshift-catalog-hook-'));
  try {
    copyFileSync(
      path.join(scriptsDirectory, 'brand-catalogs.mjs'),
      path.join(hookDirectory, 'upshift-brand-catalogs.mjs'),
    );
    writeFileSync(
      path.join(hookDirectory, 'upshift-brand-catalogs.json'),
      JSON.stringify({ brandName: 'Upshift', textReplacements: [], messageRewrites }),
    );
    const workingCatalogs = path.join(hookDirectory, 'generated');
    cpSync(catalogDirectory, workingCatalogs, { recursive: true });
    const { status, stderr } = spawnSync(
      process.execPath,
      ['upshift-brand-catalogs.mjs', workingCatalogs],
      { cwd: hookDirectory, encoding: 'utf8' },
    );
    return { status, stderr, catalogs: readCatalogs(workingCatalogs) };
  } finally {
    rmSync(hookDirectory, { recursive: true, force: true });
  }
};

const runHookOnMessages = (messages, messageRewrites) => {
  const catalogDirectory = mkdtempSync(path.join(tmpdir(), 'upshift-catalogs-'));
  try {
    writeCatalog(path.join(catalogDirectory, 'en.ts'), { brand: ['Twenty'], ...messages });
    return runHook(catalogDirectory, messageRewrites);
  } finally {
    rmSync(catalogDirectory, { recursive: true, force: true });
  }
};

const toText = (message) =>
  (typeof message === 'string' ? [message] : message)
    .map((part) => (typeof part === 'string' ? part : `{${part[0]}}`))
    .join('');

const idOf = (message) =>
  LICENSE_MESSAGE_REWRITES.find((rewrite) => rewrite.message === message).id;

test('license messages are reworded in every server locale', () => {
  const originalCatalogs = readCatalogs(serverCatalogs);
  const { status, stderr, catalogs } = runHook(serverCatalogs, LICENSE_MESSAGE_REWRITES);
  assert.equal(status, 0, stderr);

  for (const [fileName, original] of Object.entries(originalCatalogs)) {
    for (const { id, keepFirstSentence, replaceWith } of LICENSE_MESSAGE_REWRITES) {
      const rewritten = catalogs[fileName][id];
      if (!keepFirstSentence) {
        assert.deepEqual(rewritten, original[replaceWith], `${fileName} ${id}`);
        continue;
      }
      const originalText = toText(original[id]);
      const keptText = toText(rewritten).trimEnd();
      assert.ok(originalText.startsWith(keptText), `${fileName} ${id}: ${keptText}`);
      assert.ok(originalText.trimEnd().length > keptText.length, `${fileName} ${id} kept everything`);
    }
  }

  const english = catalogs['en.ts'];
  assert.equal(
    toText(
      english[
        idOf('Workspace limit reached. A valid Organization key is required to create more workspaces.')
      ],
    ),
    'Workspace limit reached.',
  );
  assert.equal(
    toText(
      english[
        idOf(
          'This feature is complimentary up to {MAX_SEATS_WITHOUT_ENTERPRISE_KEY} seats. Your instance is above that, so an Organization key is required.',
        )
      ],
    ).trimEnd(),
    'This feature is complimentary up to {MAX_SEATS_WITHOUT_ENTERPRISE_KEY} seats.',
  );
  assert.equal(
    toText(english[idOf('Audit logs require an Organization subscription.')]),
    'This feature is not enabled.',
  );
});

test('the hook fails the build when Twenty rewords a license message', () => {
  const rewordedMessage = 'Workspace limit reached. Organization keys are sold separately.';
  const { status, stderr } = runHook(serverCatalogs, [
    { id: toLinguiMessageId(rewordedMessage), message: rewordedMessage, keepFirstSentence: true },
  ]);
  assert.notEqual(status, 0);
  assert.match(stderr, /message not found, Twenty reworded or removed it/);
});

test('the hook fails the build when a translation cannot be cut after its first sentence', () => {
  const rewrite = { id: 'limit', message: 'Limit reached. Key required.', keepFirstSentence: true };

  const oneSentence = runHookOnMessages({ limit: ['Limit reached, a key is required'] }, [rewrite]);
  assert.notEqual(oneSentence.status, 0);
  assert.match(oneSentence.stderr, /no second sentence to remove/);

  const trailingPlaceholder = runHookOnMessages(
    { limit: ['Limit reached. A key is required for ', ['seatCount'], ' seats.'] },
    [rewrite],
  );
  assert.notEqual(trailingPlaceholder.status, 0);
  assert.match(trailingPlaceholder.stderr, /a placeholder follows the first sentence/);

  const twoSentences = runHookOnMessages({ limit: ['Limit reached. A key is required.'] }, [rewrite]);
  assert.equal(twoSentences.status, 0, twoSentences.stderr);
  assert.deepEqual(twoSentences.catalogs['en.ts'].limit, ['Limit reached.']);
});
