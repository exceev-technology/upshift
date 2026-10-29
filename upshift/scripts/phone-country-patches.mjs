const SHARED_PHONES_VALUE =
  'packages/twenty-shared/src/utils/validation/phones-value';
const FRONT_MODULES = 'packages/twenty-front/src/modules';

// Runs on every start: idempotent, and covers phones saved by images built before the fold
export const MOVE_WESTERN_SAHARA_PHONES_TO_MOROCCO_SQL = `DO $$
DECLARE
  phones_field record;
  western_sahara_row record;
BEGIN
  FOR phones_field IN
    SELECT
      country_code_column.table_schema,
      country_code_column.table_name,
      country_code_column.column_name AS country_code_column_name,
      additional_phones_column.column_name AS additional_phones_column_name
    FROM information_schema.columns AS country_code_column
    LEFT JOIN information_schema.columns AS additional_phones_column
      ON additional_phones_column.table_schema = country_code_column.table_schema
      AND additional_phones_column.table_name = country_code_column.table_name
      AND additional_phones_column.data_type = 'jsonb'
      AND additional_phones_column.column_name =
        left(country_code_column.column_name, -length('PrimaryPhoneCountryCode')) || 'AdditionalPhones'
    WHERE country_code_column.table_schema LIKE 'workspace\\_%'
      AND country_code_column.column_name LIKE '%PrimaryPhoneCountryCode'
  LOOP
    FOR western_sahara_row IN EXECUTE format(
      'SELECT ctid FROM %1$I.%2$I WHERE %3$I = ''EH''',
      phones_field.table_schema,
      phones_field.table_name,
      phones_field.country_code_column_name
    ) LOOP
      BEGIN
        EXECUTE format(
          'UPDATE %1$I.%2$I SET %3$I = ''MA'' WHERE ctid = $1',
          phones_field.table_schema,
          phones_field.table_name,
          phones_field.country_code_column_name
        ) USING western_sahara_row.ctid;
      EXCEPTION WHEN unique_violation THEN
        RAISE WARNING '%.%.% keeps EH on a row whose number is already stored as MA',
          phones_field.table_schema,
          phones_field.table_name,
          phones_field.country_code_column_name;
      END;
    END LOOP;

    IF phones_field.additional_phones_column_name IS NOT NULL THEN
      EXECUTE format(
        $update$
          UPDATE %1$I.%2$I SET %3$I = (
            SELECT jsonb_agg(
              CASE WHEN phone ->> 'countryCode' = 'EH'
                THEN jsonb_set(phone, '{countryCode}', '"MA"')
                ELSE phone
              END ORDER BY position
            )
            FROM jsonb_array_elements(%3$I) WITH ORDINALITY AS phones (phone, position)
          )
          WHERE jsonb_typeof(%3$I) = 'array' AND %3$I @> '[{"countryCode": "EH"}]'
        $update$,
        phones_field.table_schema,
        phones_field.table_name,
        phones_field.additional_phones_column_name
      );
    END IF;
  END LOOP;
END
$$;`;

// libphonenumber-js lists Western Sahara (EH) under Morocco's +212 and, in the metadata the server
// pins, infers it for Moroccan fixed lines starting 528 8 and 528 9. Upshift folds EH into MA.
export const PHONE_COUNTRY_PATCHES = [
  {
    file: `${SHARED_PHONES_VALUE}/isValidCountryCode.ts`,
    replacements: [
      {
        from: 'const ALL_COUNTRIES_CODE_SET = new Set<string>(getCountries());',
        to: [
          'export const normalizeCountryCode = <TCountryCode extends string | undefined>(',
          '  countryCode: TCountryCode,',
          "): TCountryCode | 'MA' => (countryCode === 'EH' ? 'MA' : countryCode);",
          '',
          'export const getCountryCodes = (): CountryCode[] =>',
          '  getCountries().filter(',
          '    (countryCode) => normalizeCountryCode(countryCode) === countryCode,',
          '  );',
          '',
          'const ALL_COUNTRIES_CODE_SET = new Set<string>(getCountryCodes());',
        ].join('\n'),
      },
    ],
  },
  {
    file: `${SHARED_PHONES_VALUE}/getCountryCodesForCallingCode.ts`,
    replacements: [
      {
        from: [
          'import {',
          '  type CountryCode,',
          '  getCountries,',
          '  getCountryCallingCode,',
          "} from 'libphonenumber-js';",
        ].join('\n'),
        to: [
          "import { type CountryCode, getCountryCallingCode } from 'libphonenumber-js';",
          '',
          "import { getCountryCodes } from './isValidCountryCode';",
        ].join('\n'),
      },
      {
        from: 'for (const country of getCountries()) {',
        to: 'for (const country of getCountryCodes()) {',
      },
    ],
  },
  {
    file: 'packages/twenty-shared/src/utils/index.ts',
    replacements: [
      {
        from: "export { isValidCountryCode } from './validation/phones-value/isValidCountryCode';",
        to: [
          'export {',
          '  getCountryCodes,',
          '  isValidCountryCode,',
          '  normalizeCountryCode,',
          "} from './validation/phones-value/isValidCountryCode';",
        ].join('\n'),
      },
    ],
  },
  {
    file: 'packages/twenty-server/src/engine/core-modules/record-transformer/utils/transform-phones-value.util.ts',
    replacements: [
      {
        from: '  isValidCountryCode,\n  parseJson,\n',
        to: '  isValidCountryCode,\n  normalizeCountryCode,\n  parseJson,\n',
      },
      {
        from: [
          '  if (',
          '    isNonEmptyString(phone.country) &&',
          '    isNonEmptyString(countryCode) &&',
          '    phone.country !== countryCode',
          '  ) {',
        ].join('\n'),
        to: [
          '  const inferredCountryCode = normalizeCountryCode(phone.country);',
          '',
          '  if (',
          '    isNonEmptyString(inferredCountryCode) &&',
          '    isNonEmptyString(countryCode) &&',
          '    inferredCountryCode !== countryCode',
          '  ) {',
        ].join('\n'),
      },
      {
        from: 'const finalPrimaryPhoneCountryCode = countryCode ?? phone.country;',
        to: 'const finalPrimaryPhoneCountryCode = countryCode ?? inferredCountryCode;',
      },
    ],
  },
  {
    file: `${FRONT_MODULES}/ui/input/components/internal/hooks/useCountries.ts`,
    replacements: [
      {
        from: "import { getCountries, getCountryCallingCode } from 'libphonenumber-js';",
        to: [
          "import { getCountryCallingCode } from 'libphonenumber-js';",
          "import { getCountryCodes } from 'twenty-shared/utils';",
        ].join('\n'),
      },
      {
        from: 'const countryCodes = getCountries();',
        to: 'const countryCodes = getCountryCodes();',
      },
    ],
  },
  {
    file: `${FRONT_MODULES}/ui/field/input/hooks/useCountryUtils.ts`,
    replacements: [
      {
        from: "import { isDefined } from 'twenty-shared/utils';",
        to: "import { isDefined, normalizeCountryCode } from 'twenty-shared/utils';",
      },
      {
        from: '(country) => country.countryCode === countryCode,',
        to: '(country) => country.countryCode === normalizeCountryCode(countryCode),',
      },
    ],
  },
  {
    file: `${FRONT_MODULES}/ui/input/components/internal/phone/components/PhoneCountryPickerDropdownButton.tsx`,
    replacements: [
      {
        from: "import { PhoneCountryPicker } from 'twenty-ui/components/input';",
        to: [
          "import { normalizeCountryCode } from 'twenty-shared/utils';",
          "import { PhoneCountryPicker } from 'twenty-ui/components/input';",
        ].join('\n'),
      },
      {
        from: 'value={value ?? null}',
        to: 'value={normalizeCountryCode(value) ?? null}',
      },
    ],
  },
  {
    file: `${FRONT_MODULES}/object-record/record-field/ui/meta-types/input/utils/formatPhoneInput.ts`,
    replacements: [
      {
        from: "import { isDefined } from 'twenty-shared/utils';",
        to: "import { isDefined, normalizeCountryCode } from 'twenty-shared/utils';",
      },
      {
        from: "countryCode: phone.country ?? '',",
        to: "countryCode: normalizeCountryCode(phone.country) ?? '',",
      },
    ],
  },
  {
    file: `${FRONT_MODULES}/settings/data-model/fields/preview/utils/getPhonesFieldPreviewValue.ts`,
    replacements: [
      {
        from: "import { isDefined } from 'twenty-shared/utils';",
        to: "import { isDefined, isValidCountryCode } from 'twenty-shared/utils';",
      },
      {
        from: 'import {\n  getCountries,\n  getCountryCallingCode,',
        to: 'import {\n  getCountryCallingCode,',
      },
      {
        from: 'return getCountries().includes(str as CountryCode);',
        to: 'return isValidCountryCode(str);',
      },
    ],
  },
  {
    file: 'packages/twenty-docker/twenty/entrypoint.sh',
    replacements: [
      {
        from: [
          '    if ! yarn command:prod upgrade; then',
          '        echo "Warning: Upgrade completed with errors. Some workspaces may not be fully migrated. Check logs for details."',
          '    fi',
          '',
        ].join('\n'),
        to: [
          '    if ! yarn command:prod upgrade; then',
          '        echo "Warning: Upgrade completed with errors. Some workspaces may not be fully migrated. Check logs for details."',
          '    fi',
          '',
          "    if ! psql -q -v ON_ERROR_STOP=1 ${PG_DATABASE_URL} <<'SQL'",
          MOVE_WESTERN_SAHARA_PHONES_TO_MOROCCO_SQL,
          'SQL',
          '    then',
          '        echo "Warning: Failed to move phones stored as Western Sahara (EH) to Morocco (MA), but continuing startup..."',
          '    fi',
          '',
        ].join('\n'),
      },
    ],
  },
];
