#!/usr/bin/env node
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { runInNewContext } from 'node:vm';

const JSON_PARSE_PREFIX = 'JSON.parse(';
const JSON_PARSE_SUFFIX = ')as Messages;';
const TWENTY_BRAND_WORD = /(?<![\w@./-])Twenty(?!\w|\.[a-z])/g;

const [generatedDirectory, brandName] = process.argv.slice(2);

if (!generatedDirectory || !brandName) {
  console.error('Usage: brand-catalogs.mjs <generated-catalog-directory> <brand-name>');
  process.exit(1);
}

let replacementCount = 0;

const rebrand = (value) => {
  if (typeof value === 'string') {
    return value.replace(TWENTY_BRAND_WORD, () => {
      replacementCount += 1;

      return brandName;
    });
  }

  if (Array.isArray(value)) {
    return value.map(rebrand);
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, rebrand(nestedValue)]),
    );
  }

  return value;
};

const catalogFiles = readdirSync(generatedDirectory).filter((fileName) =>
  fileName.endsWith('.ts'),
);

if (catalogFiles.length === 0) {
  console.error(`No compiled catalogs found in ${generatedDirectory}`);
  process.exit(1);
}

for (const fileName of catalogFiles) {
  const filePath = path.join(generatedDirectory, fileName);
  const content = readFileSync(filePath, 'utf8');
  const literalStart = content.indexOf(JSON_PARSE_PREFIX);
  const literalEnd = content.lastIndexOf(JSON_PARSE_SUFFIX);

  if (literalStart === -1 || literalEnd === -1) {
    console.error(`Unexpected compiled catalog format in ${filePath}`);
    process.exit(1);
  }

  const literal = content.slice(literalStart + JSON_PARSE_PREFIX.length, literalEnd);

  if (!/^"(?:[^"\\]|\\.)*"$/s.test(literal)) {
    console.error(`Compiled catalog in ${filePath} is not a single string literal`);
    process.exit(1);
  }

  // Lingui emits JavaScript escapes such as \xA0 that JSON.parse rejects
  const messages = JSON.parse(runInNewContext(literal));
  const rebrandedMessages = Object.fromEntries(
    Object.entries(messages).map(([messageId, message]) => [messageId, rebrand(message)]),
  );

  writeFileSync(
    filePath,
    content.slice(0, literalStart + JSON_PARSE_PREFIX.length) +
      JSON.stringify(JSON.stringify(rebrandedMessages)) +
      content.slice(literalEnd),
  );
}

if (replacementCount === 0) {
  console.error(
    `No "Twenty" found in ${generatedDirectory}; the catalogs changed shape, review upshift/scripts/brand-catalogs.mjs`,
  );
  process.exit(1);
}

console.log(
  `Rebranded ${replacementCount} catalog strings across ${catalogFiles.length} locales in ${generatedDirectory}`,
);
