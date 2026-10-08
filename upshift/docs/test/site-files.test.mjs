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
  const frenchTabs = [
    {
      tab: 'Prise en main',
      groups: [{ group: 'Bienvenue', pages: ['getting-started/introduction'] }],
    },
    {
      tab: "Guide de l'utilisateur",
      groups: [{ group: "Vue d'ensemble", pages: ['user-guide/introduction'] }],
    },
  ];
  const englishTabs = [
    {
      tab: 'Getting Started',
      groups: [{ group: 'Welcome', pages: ['en/getting-started/introduction'] }],
    },
    {
      tab: 'User Guide',
      groups: [{ group: 'Overview', pages: ['en/user-guide/introduction'] }],
    },
  ];
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

  it('uses the upshiftcloud.com accent and the Upshift wordmark', () => {
    assert.deepEqual(config.colors, {
      primary: '#1A1BB5',
      light: '#9192F0',
      dark: '#1A1BB5',
    });
    assert.deepEqual(config.logo, {
      light: '/logo-light.svg',
      dark: '/logo-dark.svg',
    });
  });

  it('organizes the footer in product, documentation, company and legal columns', () => {
    const [french, english] = config.navigation.languages;

    assert.deepEqual(
      french.footer.links.map(({ header }) => header),
      ['Produit', 'Documentation', 'Entreprise', 'Légal'],
    );
    assert.deepEqual(
      english.footer.links.map(({ header }) => header),
      ['Product', 'Documentation', 'Company', 'Legal'],
    );
    assert.deepEqual(french.footer.socials, {
      website: 'https://upshiftcloud.com',
      linkedin: 'https://linkedin.com/company/exceev-consulting',
    });
    assert.deepEqual(config.footer, french.footer);
  });

  it('links the footer to each published tab in its own language', () => {
    const [french, english] = config.navigation.languages;

    assert.deepEqual(french.footer.links[1].items, [
      { label: 'Prise en main', href: '/getting-started/introduction' },
      { label: 'Guide utilisateur', href: '/user-guide/introduction' },
    ]);
    assert.deepEqual(english.footer.links[1].items, [
      { label: 'Getting started', href: '/en/getting-started/introduction' },
      { label: 'User guide', href: '/en/user-guide/introduction' },
    ]);
  });

  it('keeps Twenty only in the legal credit, in each language', () => {
    const [french, english] = config.navigation.languages;

    assert.deepEqual(french.footer.links.at(-1).items.at(-1), {
      label: 'Basé sur Twenty',
      href: 'https://github.com/twentyhq/twenty',
    });
    assert.deepEqual(english.footer.links.at(-1).items.at(-1), {
      label: 'Built on Twenty',
      href: 'https://github.com/twentyhq/twenty',
    });
  });

  it('keeps footer labels short enough for Mintlify not to truncate them', () => {
    const labels = config.navigation.languages.flatMap(({ footer }) =>
      footer.links.flatMap(({ items }) => items.map(({ label }) => label)),
    );

    assert.deepEqual(
      labels.filter((label) => label.length > 20),
      [],
    );
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
