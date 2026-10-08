import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LANGUAGES } from '../rules.mjs';
import {
  adaptCustomCss,
  auditSite,
  buildDocsConfig,
  collectAssets,
} from '../transform.mjs';

const [FRENCH, ENGLISH] = LANGUAGES;

describe('collectAssets', () => {
  it('finds images in markdown, attributes and frontmatter, and imported snippets', () => {
    const page = [
      '---',
      'image: /images/docs/cover.png',
      '---',
      "import { VimeoEmbed } from '/snippets/vimeo-embed.mdx';",
      '![Inbox](/images/user-guide/inbox.png)',
      '<Card img="/images/user-guide/halftone/billing.png" />',
      '<img src="/images/user-guide/inbox.png" />',
    ].join('\n');

    assert.deepEqual(collectAssets([page]), {
      images: [
        'images/docs/cover.png',
        'images/user-guide/halftone/billing.png',
        'images/user-guide/inbox.png',
      ],
      snippets: ['snippets/vimeo-embed.mdx'],
    });
  });
});

describe('buildDocsConfig', () => {
  const frenchTabs = [{ tab: 'Prise en main', groups: [] }];
  const englishTabs = [{ tab: 'Getting Started', groups: [] }];
  const redirects = [{ source: '/a', destination: '/b' }];

  const config = buildDocsConfig(
    {
      $schema: 'https://mintlify.com/schema.json',
      theme: 'almond',
      interaction: { drilldown: false },
      styling: { eyebrows: 'breadcrumbs' },
    },
    [
      { language: FRENCH, tabs: frenchTabs },
      { language: ENGLISH, tabs: englishTabs },
    ],
    redirects,
  );

  it('brands the Mintlify config and points it at docs.upshiftcloud.com', () => {
    assert.equal(config.name, 'Upshift Documentation');
    assert.equal(config.$schema, 'https://mintlify.com/schema.json');
    assert.equal(config.seo.metatags.canonical, 'https://docs.upshiftcloud.com');
    assert.deepEqual(config.redirects, redirects);
    assert.equal(JSON.stringify(config).includes('twenty.com'), false);
  });

  it('makes French the default language with French labels, and English its own', () => {
    const [french, english] = config.navigation.languages;

    assert.equal(french.language, 'fr');
    assert.equal(french.default, true);
    assert.deepEqual(french.tabs, frenchTabs);
    assert.equal(french.navbar.primary.label, 'Nous contacter');
    assert.equal(config.navbar.primary.label, 'Nous contacter');

    assert.equal(english.language, 'en');
    assert.equal(english.default, undefined);
    assert.deepEqual(english.tabs, englishTabs);
    assert.equal(english.navbar.primary.label, 'Contact us');
  });

  it('keeps Twenty only in the credits, in each language', () => {
    const [french, english] = config.navigation.languages;

    assert.deepEqual(french.footer.links.at(-1).items, [
      {
        label: 'Basé sur la documentation de Twenty (AGPL-3.0)',
        href: 'https://github.com/twentyhq/twenty',
      },
    ]);
    assert.deepEqual(english.footer.links.at(-1).items, [
      {
        label: 'Based on the Twenty documentation (AGPL-3.0)',
        href: 'https://github.com/twentyhq/twenty',
      },
    ]);
  });
});

describe('adaptCustomCss', () => {
  it('drops Developers selectors and matches User Guide links in every language', () => {
    const css = [
      "div:has(> .sidebar-group a[href='/developers/introduction']),",
      "div:has(> .sidebar-group a[href='/user-guide/introduction']) {",
      '  display: none;',
      '}',
    ].join('\n');

    assert.equal(
      adaptCustomCss(css),
      [
        "div:has(> .sidebar-group a[href$='/user-guide/introduction']) {",
        '  display: none;',
        '}',
      ].join('\n'),
    );
  });
});

describe('auditSite', () => {
  it('reports missing pages, Twenty hosts and links to unpublished pages', () => {
    const files = new Map([
      [
        'en/user-guide/a.mdx',
        'Mail [us](mailto:contact@twenty.com), read [b](/en/user-guide/b) and see ![x](/images/missing.png).',
      ],
      ['docs.json', '{"canonical":"https://docs.twenty.com"}'],
    ]);

    assert.deepEqual(auditSite(files, ['en/user-guide/a', 'user-guide/a']), [
      'user-guide/a is in the navigation but has no page',
      'en/user-guide/a.mdx still references twenty.com',
      'en/user-guide/a.mdx links to /en/user-guide/b, which is not published',
      'en/user-guide/a.mdx links to /images/missing.png, which is not published',
      'docs.json still references twenty.com',
    ]);
  });
});
