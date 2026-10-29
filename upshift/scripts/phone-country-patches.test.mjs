import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { applyReplacements } from './patch-replacements.mjs';
import {
  MOVE_WESTERN_SAHARA_PHONES_TO_MOROCCO_SQL,
  PHONE_COUNTRY_PATCHES,
} from './phone-country-patches.mjs';

const SOURCE_ROOT =
  process.env.UPSHIFT_PRIVACY_SOURCE_ROOT ??
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const MOROCCAN_528_NUMBERS = ['+212528812345', '+212528912345'];

const sourceOf = (file) => readFileSync(path.join(SOURCE_ROOT, file), 'utf8');

const patchedSource = (suffix) => {
  const patch = PHONE_COUNTRY_PATCHES.find(({ file }) => file.endsWith(suffix));
  const result = applyReplacements(sourceOf(patch.file), patch.replacements);
  assert.deepEqual(result.failures, [], patch.file);
  return result.content;
};

// Same realm as the test: libphonenumber-js rejects option objects created in a vm context
const loadModule = (source, context) => {
  const exportedNames = [...source.matchAll(/^export const (\w+)/gm)].map(
    ([, name]) => name,
  );
  const moduleBody = source
    .replace(/^import[\s\S]*?from ['"][^'"]+['"];\s*/gm, '')
    .replace(/^export const /gm, 'const ');

  return new Function(
    ...Object.keys(context),
    `${stripTypeScriptTypes(moduleBody)}\nreturn { ${exportedNames.join(', ')} };`,
  )(...Object.values(context));
};

// Behaves like libphonenumber-js 1.11.5, which the server pins: 528 8x and 528 9x parse as EH
const CALLING_CODES = { EH: '212', FR: '33', MA: '212' };

const parsePhoneNumber = (input, options = {}) => {
  const digits = input.replace(/\D/g, '');
  const isInternational = input.trim().startsWith('+');
  const countryCallingCode = isInternational
    ? ['212', '33'].find((callingCode) => digits.startsWith(callingCode))
    : (options.defaultCallingCode ?? CALLING_CODES[options.defaultCountry]);

  if (countryCallingCode === undefined) {
    throw new Error('INVALID_COUNTRY');
  }

  const nationalNumber = isInternational
    ? digits.slice(countryCallingCode.length)
    : digits.replace(/^0/, '');
  const country =
    countryCallingCode === '33'
      ? 'FR'
      : /^528[89]/.test(nationalNumber)
        ? 'EH'
        : 'MA';

  return {
    country,
    countryCallingCode,
    nationalNumber,
    isPossible: () => nationalNumber.length === 9,
    isValid: () => nationalNumber.length === 9,
  };
};

const libphonenumber = {
  getCountries: () => Object.keys(CALLING_CODES),
  getCountryCallingCode: (country) => CALLING_CODES[country],
  parsePhoneNumber,
  parsePhoneNumberWithError: parsePhoneNumber,
};

const isDefined = (value) => value !== null && value !== undefined;

const isNonEmptyString = (value) => typeof value === 'string' && value !== '';

const loadSharedUtils = () => {
  const countryCodeUtils = loadModule(
    patchedSource('/isValidCountryCode.ts'),
    libphonenumber,
  );
  const callingCodeUtils = loadModule(
    patchedSource('/getCountryCodesForCallingCode.ts'),
    { ...libphonenumber, ...countryCodeUtils },
  );
  return { ...countryCodeUtils, ...callingCodeUtils };
};

class RecordTransformerException extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

const loadTransformPhonesValue = () =>
  loadModule(patchedSource('/transform-phones-value.util.ts'), {
    ...libphonenumber,
    ...loadSharedUtils(),
    RecordTransformerException,
    RecordTransformerExceptionCode: new Proxy({}, { get: (_, code) => code }),
    msg: (strings, ...values) => String.raw({ raw: strings }, ...values),
    isArray: Array.isArray,
    isNonEmptyString,
    isEmpty: (value) => !isDefined(value) || value.length === 0,
    isDefined,
    parseJson: (value) => JSON.parse(value),
    removeUndefinedFields: (value) =>
      Object.fromEntries(
        Object.entries(value).filter(([, field]) => field !== undefined),
      ),
  }).transformPhonesValue;

const loadUseCountries = () =>
  loadModule(patchedSource('/useCountries.ts'), {
    ...libphonenumber,
    ...loadSharedUtils(),
    useMemo: (factory) => factory(),
    hasFlag: () => true,
    Flags: new Proxy({}, { get: (_, countryCode) => countryCode }),
  }).useCountries;

test('every phone country patch matches upstream exactly', () => {
  for (const { file } of PHONE_COUNTRY_PATCHES) patchedSource(file);
});

test('Western Sahara is no longer a country code', () => {
  const { getCountryCodes, isValidCountryCode } = loadSharedUtils();

  assert.deepEqual(getCountryCodes(), ['FR', 'MA']);
  assert.equal(isValidCountryCode('EH'), false);
  assert.equal(isValidCountryCode('MA'), true);
});

test('+212 only resolves to Morocco', () => {
  const { getCountryCodesForCallingCode } = loadSharedUtils();

  assert.deepEqual(getCountryCodesForCallingCode('+212'), ['MA']);
  assert.deepEqual(getCountryCodesForCallingCode('33'), ['FR']);
});

test('528 8x and 528 9x numbers save as Moroccan on the server', () => {
  const transformPhonesValue = loadTransformPhonesValue();

  for (const number of MOROCCAN_528_NUMBERS) {
    const withCountry = transformPhonesValue({
      input: {
        primaryPhoneNumber: number,
        primaryPhoneCountryCode: 'MA',
        primaryPhoneCallingCode: '+212',
      },
    });
    assert.equal(withCountry.primaryPhoneCountryCode, 'MA', number);
    assert.equal(withCountry.primaryPhoneNumber, number.slice(4), number);

    const inferred = transformPhonesValue({
      input: {
        primaryPhoneNumber: number,
        additionalPhones: [{ number }],
      },
    });
    assert.equal(inferred.primaryPhoneCountryCode, 'MA', number);
    assert.equal(JSON.parse(inferred.additionalPhones)[0].countryCode, 'MA');
  }
});

test('the API rejects EH and still reports real country conflicts', () => {
  const transformPhonesValue = loadTransformPhonesValue();

  assert.throws(
    () =>
      transformPhonesValue({
        input: {
          primaryPhoneNumber: '+212528812345',
          primaryPhoneCountryCode: 'EH',
        },
      }),
    { message: 'Invalid country code EH' },
  );
  assert.throws(
    () =>
      transformPhonesValue({
        input: {
          primaryPhoneNumber: '+33612345678',
          primaryPhoneCountryCode: 'MA',
        },
      }),
    { message: 'Provided and inferred country code are conflicting' },
  );
});

test('typing a 528 8x number in the app sends MA', () => {
  const { formatPhoneInput } = loadModule(patchedSource('/formatPhoneInput.ts'), {
    ...libphonenumber,
    ...loadSharedUtils(),
    isDefined,
  });

  assert.equal(formatPhoneInput({ input: '+212528812345' }).countryCode, 'MA');
  assert.equal(formatPhoneInput({ input: '+33612345678' }).countryCode, 'FR');
});

test('editing a record that still stores EH sends MA back', () => {
  const { createPhonesFromFieldValue } = loadModule(
    patchedSource('/phonesUtils.ts'),
    { ...loadSharedUtils(), isDefined, isNonEmptyString },
  );

  const phones = createPhonesFromFieldValue({
    primaryPhoneNumber: '528812345',
    primaryPhoneCountryCode: 'EH',
    primaryPhoneCallingCode: '+212',
    additionalPhones: [
      { number: '528912345', callingCode: '+212', countryCode: 'EH' },
      { number: '612345678', callingCode: '+33', countryCode: 'FR' },
    ],
  });

  assert.deepEqual(
    phones.map(({ countryCode }) => countryCode),
    ['MA', 'MA', 'FR'],
  );
});

test('the front phone schema does not reject numbers the library attributes to EH', () => {
  const { phoneSchema } = loadModule(
    sourceOf(
      'packages/twenty-front/src/modules/object-record/record-field/ui/validation-schemas/phoneSchema.ts',
    ),
    {
      ...libphonenumber,
      z: {
        string: () => ({
          refine: (isValid) => ({
            safeParse: (value) => ({ success: isValid(value) }),
          }),
        }),
      },
    },
  );

  for (const number of MOROCCAN_528_NUMBERS) {
    assert.equal(parsePhoneNumber(number).country, 'EH', number);
    assert.equal(phoneSchema.safeParse(number).success, true, number);
  }
});

test('country pickers list Morocco under +212 and no Western Sahara', () => {
  const countries = loadUseCountries()();

  assert.deepEqual(
    countries.map(({ countryCode, callingCode }) => [countryCode, callingCode]),
    [
      ['FR', '33'],
      ['MA', '212'],
    ],
  );
});

test('an address autocompleted in Western Sahara gets Morocco as its country', () => {
  const { useCountryUtils } = loadModule(patchedSource('/useCountryUtils.ts'), {
    useCallback: (callback) => callback,
    useCountries: loadUseCountries(),
    isDefined,
    ...loadSharedUtils(),
  });

  assert.equal(useCountryUtils().findCountryNameByCountryCode('EH'), 'Morocco');
});

test('the phone field preview gives no calling code for EH', () => {
  const { countryCodeToCallingCode } = loadModule(
    patchedSource('/getPhonesFieldPreviewValue.ts'),
    { ...libphonenumber, ...loadSharedUtils(), isDefined },
  );

  assert.equal(countryCodeToCallingCode('EH'), '');
  assert.equal(countryCodeToCallingCode('MA'), '+212');
});

const runEntrypoint = (context, { psqlExitCode = 0 } = {}) => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'upshift-phones-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const log = path.join(directory, 'commands.log');
  const writeExecutable = (name, script) => {
    writeFileSync(path.join(directory, name), script);
    chmodSync(path.join(directory, name), 0o755);
  };
  writeExecutable('yarn', `#!/bin/sh\necho "yarn $*" >> "${log}"\n`);
  writeExecutable(
    'psql',
    [
      '#!/bin/sh',
      'if [ "$1" = "-tAc" ]; then echo t; exit 0; fi',
      `echo "psql $*" >> "${log}"`,
      `cat >> "${log}"`,
      `exit ${psqlExitCode}`,
    ].join('\n'),
  );
  writeFileSync(
    path.join(directory, 'entrypoint.sh'),
    patchedSource('packages/twenty-docker/twenty/entrypoint.sh'),
  );

  const result = spawnSync(
    'sh',
    [path.join(directory, 'entrypoint.sh'), 'echo', 'server started'],
    {
      encoding: 'utf8',
      env: {
        PATH: `${directory}:${process.env.PATH}`,
        PG_DATABASE_URL: 'postgres://upshift@db/upshift',
        DISABLE_CRON_JOBS_REGISTRATION: 'true',
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  return { output: result.stdout, commands: readFileSync(log, 'utf8') };
};

test('the server moves stored EH phones to MA after the upgrade, before serving', (context) => {
  const { output, commands } = runEntrypoint(context);

  assert.equal(
    commands,
    [
      'yarn command:prod cache:flush',
      'yarn command:prod upgrade',
      'psql -q -v ON_ERROR_STOP=1 postgres://upshift@db/upshift',
      MOVE_WESTERN_SAHARA_PHONES_TO_MOROCCO_SQL,
      'yarn command:prod cache:flush',
      '',
    ].join('\n'),
  );
  assert.match(output, /server started\n$/);
});

test('a failed EH to MA move does not stop the server', (context) => {
  const { output } = runEntrypoint(context, { psqlExitCode: 3 });

  assert.match(output, /Warning: Failed to move phones stored as Western Sahara/);
  assert.match(output, /server started\n$/);
});
