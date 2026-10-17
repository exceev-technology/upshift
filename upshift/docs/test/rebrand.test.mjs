import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LANGUAGES, TERM_REPLACEMENTS } from '../rules.mjs';
import {
  applyPhraseReplacements,
  rebrandPage,
  repairAnchors,
  replaceTerms,
} from '../transform.mjs';

const [FRENCH, ENGLISH] = LANGUAGES;

const publishedPages = new Map([
  ['fr', new Set(['user-guide/workflows/overview'])],
  [
    'en',
    new Set([
      'user-guide/workflows/overview',
      'user-guide/email-campaigns/overview',
      'user-guide/calendar-emails/how-tos/can-i-send-emails-from-twenty',
    ]),
  ],
]);

describe('rebrandPage', () => {
  it('renames Twenty in prose and code samples, and leaves identifiers, file names and webhook headers alone', () => {
    const source = [
      "Twenty keeps your data. Twenty's views are fast.",
      '![Twenty inbox](/images/user-guide/emails/03-twenty-add-email-channel.png)',
      'Check `user.isTwenty` before calling Twenty, then verify `X-Twenty-Webhook-Signature`.',
      '```json',
      '{ "twenty": { "name": "Twenty" }, "TWENTY_API_URL": "x" }',
      '```',
    ].join('\n');

    assert.equal(
      rebrandPage(source, publishedPages, ENGLISH.brandWord),
      [
        "Upshift keeps your data. Upshift's views are fast.",
        '![Upshift inbox](/images/user-guide/emails/03-twenty-add-email-channel.png)',
        'Check `user.isTwenty` before calling Upshift, then verify `X-Twenty-Webhook-Signature`.',
        '```json',
        '{ "twenty": { "name": "Upshift" }, "TWENTY_API_URL": "x" }',
        '```',
      ].join('\n'),
    );
  });

  it('points links to Twenty source code at the Upshift repository, and issues at the Upshift team', () => {
    const source = [
      '[example](https://github.com/twentyhq/twenty/blob/main/packages/twenty-apps/examples/hello-world/src/a.ts)',
      '[app](https://github.com/twentyhq/twenty/tree/main/packages/twenty-apps/public/call-recorder)',
      "issueReportUrl: 'https://github.com/twentyhq/twenty/issues',",
    ].join('\n');

    assert.equal(
      rebrandPage(source, publishedPages, ENGLISH.brandWord),
      [
        '[example](https://github.com/exceev-technology/upshift/blob/main/packages/twenty-apps/examples/hello-world/src/a.ts)',
        '[app](https://github.com/exceev-technology/upshift/tree/main/packages/twenty-apps/public/call-recorder)',
        "issueReportUrl: 'mailto:contact@exceev.com',",
      ].join('\n'),
    );
  });

  it('also renames the literal French translation of the brand in French pages', () => {
    assert.equal(
      rebrandPage(
        'Vingt génère un identifiant. Twenty aussi.',
        publishedPages,
        FRENCH.brandWord,
      ),
      'Upshift génère un identifiant. Upshift aussi.',
    );
  });

  it('points Twenty hosts and addresses at Upshift ones', () => {
    const source = [
      'Write to [contact@twenty.com](mailto:contact@twenty.com).',
      'Go to [app.twenty.com](https://app.twenty.com/welcome).',
      'curl https://api.twenty.com/graphql',
      'Forward to ch_1@inbound.twenty.com or https://mycompany.twenty.com/mcp, as jane@twenty.com.',
      '[Partners](https://twenty.com/partners/list?ref=docs) and `https://twenty.com`.',
    ].join('\n');

    assert.equal(
      rebrandPage(source, publishedPages, ENGLISH.brandWord),
      [
        'Write to [contact@exceev.com](mailto:contact@exceev.com).',
        'Go to [upshiftcloud.com](https://upshiftcloud.com).',
        'curl https://crm.yourcompany.com/graphql',
        'Forward to ch_1@inbound.yourcompany.com or https://crm.yourcompany.com/mcp, as jane@example.com.',
        '[Partners](mailto:contact@exceev.com) and `https://example.com`.',
      ].join('\n'),
    );
  });

  it('moves English links under /en/, unwraps unpublished ones and renames twenty slugs', () => {
    const source =
      'See the [API](/developers/extend/api#create-an-api-key), [workflows](/user-guide/workflows/overview/) and [emails](/user-guide/calendar-emails/how-tos/can-i-send-emails-from-twenty#roadmap).';

    assert.equal(
      rebrandPage(source, publishedPages, ENGLISH.brandWord),
      'See the API, [workflows](/en/user-guide/workflows/overview) and [emails](/en/user-guide/calendar-emails/how-tos/can-i-send-emails-from-upshift#roadmap).',
    );
  });

  it('serves French links from the root and falls back to English pages Twenty has not translated', () => {
    const source =
      'Voir [flux](/fr/user-guide/workflows/overview), [campagnes](/fr/user-guide/email-campaigns/overview) et [API](/fr/developers/extend/api).';

    assert.equal(
      rebrandPage(source, publishedPages, FRENCH.brandWord),
      'Voir [flux](/user-guide/workflows/overview), [campagnes](/en/user-guide/email-campaigns/overview) et API.',
    );
  });

  it('drops cards that lead to unpublished pages and the groups they leave empty', () => {
    const source = [
      '<CardGroup cols={2}>',
      '  <Card title="Explore the API" icon="plug" href="/developers/extend/api">',
      '    Build integrations.',
      '  </Card>',
      '  <Card title="Billing" href="/user-guide/billing/overview" />',
      '</CardGroup>',
      '<CardGroup cols={2}>',
      '  <Card title="Workflows" href="/user-guide/workflows/overview">Automate.</Card>',
      '</CardGroup>',
    ].join('\n');

    assert.equal(
      rebrandPage(source, publishedPages, ENGLISH.brandWord),
      [
        '<CardGroup cols={2}>',
        '  <Card title="Workflows" href="/en/user-guide/workflows/overview">Automate.</Card>',
        '</CardGroup>',
      ].join('\n'),
    );
  });
});

describe('repairAnchors', () => {
  it('points links at the anchors of renamed headings, and keeps anchors that still match', () => {
    const files = new Map([
      [
        'en/a.mdx',
        [
          '### Calling the Upshift REST API',
          'See [the API](#calling-the-twenty-rest-api) and <a href="#missing-twenty">x</a>.',
        ].join('\n'),
      ],
      [
        'en/b.mdx',
        [
          '## Typed API clients (`twenty-client-sdk`)',
          '[Clients](/en/b#typed-api-clients-twenty-client-sdk), [API](/en/a#calling-the-twenty-rest-api)',
        ].join('\n'),
      ],
    ]);

    repairAnchors(files);

    assert.equal(
      files.get('en/a.mdx').split('\n')[1],
      'See [the API](#calling-the-upshift-rest-api) and <a href="#missing-twenty">x</a>.',
    );
    assert.equal(
      files.get('en/b.mdx').split('\n')[1],
      '[Clients](/en/b#typed-api-clients-twenty-client-sdk), [API](/en/a#calling-the-upshift-rest-api)',
    );
  });

  it('drops anchors a translated page does not have, and keeps accordion, id and accented ones', () => {
    const files = new Map([
      [
        'a.mdx',
        [
          '## Limitations actuelles',
          '<Accordion title="Configuration GitHub auto-hébergée">x</Accordion>',
          '<a id="exemple" />',
          'Voir les [limitations](#current-limitations) et les [limites](#limitations-actuelles).',
          '[Config](#configuration-github-auto-h%C3%A9berg%C3%A9e), [exemple](#exemple), [API](/b#calling-the-api).',
        ].join('\n'),
      ],
      ['b.mdx', '## Appeler l’API'],
    ]);

    repairAnchors(files);

    assert.deepEqual(files.get('a.mdx').split('\n').slice(3), [
      'Voir les limitations et les [limites](#limitations-actuelles).',
      '[Config](#configuration-github-auto-h%C3%A9berg%C3%A9e), [exemple](#exemple), [API](/b).',
    ]);
  });
});

describe('rebrandPage on French cards', () => {
  it('keeps French card links on the French site', () => {
    assert.equal(
      rebrandPage(
        '<Card title="Flux" href="/fr/user-guide/workflows/overview">Automatiser.</Card>',
        publishedPages,
        FRENCH.brandWord,
      ),
      '<Card title="Flux" href="/user-guide/workflows/overview">Automatiser.</Card>',
    );
  });
});

describe('replaceTerms', () => {
  it('stops calling Upshift a CRM in French, outside migrations and code', () => {
    assert.equal(
      replaceTerms(
        "Importez vos données CRM, liées aux enregistrements CRM concernés, dans votre CRM. Un enregistrement CRM remplit le modèle. Migration depuis d'autres CRM. `données CRM`",
        TERM_REPLACEMENTS.fr,
      ),
      "Importez vos données, liées aux enregistrements concernés, dans Upshift. Un enregistrement remplit le modèle. Migration depuis d'autres CRM. `données CRM`",
    );
  });

  it('stops calling Upshift a CRM in English, outside migrations and code', () => {
    assert.equal(
      replaceTerms(
        'Visualize your CRM data, linked to relevant CRM records in your CRM. A CRM record fills the template. Migrate from other CRMs. `CRM data`',
        TERM_REPLACEMENTS.en,
      ),
      'Visualize your data, linked to relevant records in Upshift. A record fills the template. Migrate from other CRMs. `CRM data`',
    );
  });
});

describe('applyPhraseReplacements', () => {
  const rules = [
    { from: 'Find a certified Twenty partner', to: 'Contact the Upshift team', count: 2 },
  ];

  it('replaces a phrase across pages', () => {
    const { outputs, problems } = applyPhraseReplacements(
      new Map([
        ['a', 'Find a certified Twenty partner.'],
        ['b', 'Or Find a certified Twenty partner.'],
      ]),
      rules,
    );

    assert.deepEqual(problems, []);
    assert.deepEqual([...outputs.values()], [
      'Contact the Upshift team.',
      'Or Contact the Upshift team.',
    ]);
  });

  it('reports a phrase Twenty reworded', () => {
    const { problems } = applyPhraseReplacements(
      new Map([['a', 'Find a Twenty partner.']]),
      rules,
    );

    assert.equal(problems.length, 1);
    assert.match(problems[0], /expects 2 matches .* found 0/);
  });
});
