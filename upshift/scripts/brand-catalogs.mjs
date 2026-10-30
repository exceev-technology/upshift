#!/usr/bin/env node
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const JSON_PARSE_PREFIX = 'JSON.parse(';
const JSON_PARSE_SUFFIX = ')as Messages;';
const TWENTY_BRAND_WORD = /(?<![\w@./-])Twenty(?!\w|\.[a-z])/g;
const CONFIGURATION_FILE_NAME = 'upshift-brand-catalogs.json';
const PRESERVED_TOKENS = ['create-twenty-app', 'twenty-sdk', 'yarn twenty ', 'X-Twenty-'];

const [generatedDirectory] = process.argv.slice(2);

if (!generatedDirectory) {
  console.error('Usage: brand-catalogs.mjs <generated-catalog-directory>');
  process.exit(1);
}

const { brandName, textReplacements, messageRewrites = [] } = JSON.parse(
  readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), CONFIGURATION_FILE_NAME),
    'utf8',
  ),
);

let replacementCount = 0;
const failures = [];

const rebrandText = (text) => {
  let rebrandedText = text.replace(TWENTY_BRAND_WORD, () => {
    replacementCount += 1;

    return brandName;
  });

  for (const [from, to] of textReplacements) {
    const occurrenceCount = rebrandedText.split(from).length - 1;

    if (occurrenceCount > 0) {
      replacementCount += occurrenceCount;
      rebrandedText = rebrandedText.split(from).join(to);
    }
  }

  return rebrandedText;
};

// A compiled message is a string or a list of parts; a part is literal text or a
// placeholder [name, type?, options?] whose option values are messages again
const mapMessage = (message, mapText) => {
  if (typeof message === 'string') {
    return mapText(message);
  }

  if (!Array.isArray(message)) {
    return message;
  }

  return message.map((part) => {
    if (typeof part === 'string') {
      return mapText(part);
    }

    if (!Array.isArray(part)) {
      return part;
    }

    const [name, type, options, ...rest] = part;
    const mappedOptions =
      options !== null && typeof options === 'object' && !Array.isArray(options)
        ? Object.fromEntries(
            Object.entries(options).map(([key, value]) => [
              key,
              mapMessage(value, mapText),
            ]),
          )
        : options;

    return part.length > 2 ? [name, type, mappedOptions, ...rest] : part;
  });
};

const toSkeleton = (message) => JSON.stringify(mapMessage(message, () => ''));

const collectText = (message) => {
  const texts = [];

  mapMessage(message, (text) => {
    texts.push(text);

    return text;
  });

  return texts.join('\n');
};

const countToken = (text, token) => text.split(token).length - 1;

const SENTENCE_END = /[.!?։](?=\s)|[。！？]/u;

// Blanks the parts after the first sentence instead of dropping them, so the structure check below still applies
const toFirstSentence = (message, describe) => {
  const parts = typeof message === 'string' ? [message] : message;
  let droppedText = '';
  let isCut = false;

  const keptParts = parts.map((part) => {
    if (typeof part !== 'string') {
      if (isCut) {
        failures.push(`${describe}: a placeholder follows the first sentence`);
      }

      return part;
    }

    if (isCut) {
      droppedText += part;

      return '';
    }

    const sentenceEnd = SENTENCE_END.exec(part);

    if (!sentenceEnd) {
      return part;
    }

    isCut = true;
    const cutIndex = sentenceEnd.index + sentenceEnd[0].length;
    droppedText += part.slice(cutIndex);

    return part.slice(0, cutIndex);
  });

  if (droppedText.trim() === '') {
    failures.push(`${describe}: no second sentence to remove`);
  }

  return typeof message === 'string' ? keptParts[0] : keptParts;
};

let rewrittenMessageCount = 0;

const rewriteMessages = (messages, fileName) => {
  const rewrittenMessages = { ...messages };

  for (const { id, message, keepFirstSentence, replaceWith } of messageRewrites) {
    const describe = `${fileName} ${id} "${message}"`;

    if (!(id in messages)) {
      failures.push(
        `${describe}: message not found, Twenty reworded or removed it; update upshift/scripts/license-message-wording.mjs`,
      );
      continue;
    }

    if (keepFirstSentence) {
      rewrittenMessages[id] = toFirstSentence(messages[id], describe);
    } else if (replaceWith in messages) {
      rewrittenMessages[id] = messages[replaceWith];
    } else {
      failures.push(`${describe}: replacement message ${replaceWith} not found`);
      continue;
    }

    rewrittenMessageCount += 1;
  }

  return rewrittenMessages;
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
    Object.entries(rewriteMessages(messages, fileName)).map(([messageId, message]) => [
      messageId,
      mapMessage(message, rebrandText),
    ]),
  );

  for (const [messageId, message] of Object.entries(messages)) {
    const rebrandedMessage = rebrandedMessages[messageId];

    if (toSkeleton(message) !== toSkeleton(rebrandedMessage)) {
      failures.push(`${fileName} ${messageId}: placeholder or plural structure changed`);
    }

    const originalText = collectText(message);
    const rebrandedText = collectText(rebrandedMessage);

    for (const token of PRESERVED_TOKENS) {
      if (countToken(originalText, token) !== countToken(rebrandedText, token)) {
        failures.push(`${fileName} ${messageId}: "${token}" must not be rewritten`);
      }
    }

    if (TWENTY_BRAND_WORD.test(rebrandedText)) {
      failures.push(`${fileName} ${messageId}: still mentions Twenty`);
    }

    TWENTY_BRAND_WORD.lastIndex = 0;
  }

  writeFileSync(
    filePath,
    content.slice(0, literalStart + JSON_PARSE_PREFIX.length) +
      JSON.stringify(JSON.stringify(rebrandedMessages)) +
      content.slice(literalEnd),
  );
}

if (failures.length > 0) {
  console.error(`Catalog rebranding broke ${failures.length} message(s):`);
  failures.slice(0, 20).forEach((failure) => console.error(`  - ${failure}`));
  process.exit(1);
}

if (replacementCount === 0) {
  console.error(
    `No "Twenty" found in ${generatedDirectory}; the catalogs changed shape, review upshift/scripts/brand-catalogs.mjs`,
  );
  process.exit(1);
}

console.log(
  `Rebranded ${replacementCount} catalog strings${rewrittenMessageCount > 0 ? ` and reworded ${rewrittenMessageCount} messages` : ''} across ${catalogFiles.length} locales in ${generatedDirectory}; ids, placeholders and SDK commands verified`,
);
