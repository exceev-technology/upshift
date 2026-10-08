import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LANGUAGES } from '../rules.mjs';
import { applyPhraseReplacements, rebrandPage } from '../transform.mjs';

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
  it('renames Twenty in prose and leaves code, identifiers and file names alone', () => {
    const source = [
      "Twenty keeps your data. Twenty's views are fast.",
      '![Twenty inbox](/images/user-guide/emails/03-twenty-add-email-channel.png)',
      'Check `user.isTwenty` before calling Twenty.',
      '```json',
      '{ "twenty": { "name": "Twenty" } }',
      '```',
    ].join('\n');

    assert.equal(
      rebrandPage(source, publishedPages, ENGLISH.brandWord),
      [
        "Upshift keeps your data. Upshift's views are fast.",
        '![Upshift inbox](/images/user-guide/emails/03-twenty-add-email-channel.png)',
        'Check `user.isTwenty` before calling Upshift.',
        '```json',
        '{ "twenty": { "name": "Twenty" } }',
        '```',
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
