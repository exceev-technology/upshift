import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LANGUAGES } from '../rules.mjs';
import {
  filterNavigation,
  filterRedirects,
  findUnmatchedExclusions,
  listLinkedPages,
  renamePage,
} from '../transform.mjs';

const [FRENCH, ENGLISH] = LANGUAGES;

const twentyDocsConfig = {
  navigation: {
    languages: [
      {
        language: 'en',
        tabs: [
          {
            tab: 'Getting Started',
            groups: [{ group: 'Welcome', pages: ['getting-started/introduction'] }],
          },
          {
            tab: 'User Guide',
            groups: [
              { group: 'Billing', pages: ['user-guide/billing/overview'] },
              {
                group: 'Workflows',
                pages: [
                  'user-guide/workflows/overview',
                  {
                    group: 'How-Tos',
                    pages: ['user-guide/workflows/how-tos/generate-pdf-from-twenty'],
                  },
                ],
              },
            ],
          },
          {
            tab: 'Developers',
            groups: [{ group: 'Overview', pages: ['developers/introduction'] }],
          },
        ],
      },
      {
        language: 'fr',
        tabs: [
          {
            tab: 'Prise en main',
            groups: [{ group: 'Bienvenue', pages: ['fr/getting-started/introduction'] }],
          },
          {
            tab: "Guide de l'utilisateur",
            groups: [
              {
                group: 'Flux de travail',
                pages: ['fr/user-guide/workflows/overview'],
              },
            ],
          },
        ],
      },
    ],
  },
};

describe('filterNavigation', () => {
  it('keeps the Getting Started and User Guide tabs without excluded pages', () => {
    const { tabs, pages } = filterNavigation(twentyDocsConfig, ENGLISH);

    assert.deepEqual(tabs, [
      {
        tab: 'Getting Started',
        groups: [{ group: 'Welcome', pages: ['en/getting-started/introduction'] }],
      },
      {
        tab: 'User Guide',
        groups: [
          {
            group: 'Workflows',
            pages: [
              'en/user-guide/workflows/overview',
              {
                group: 'How-Tos',
                pages: ['en/user-guide/workflows/how-tos/generate-pdf-from-upshift'],
              },
            ],
          },
        ],
      },
    ]);
    assert.deepEqual(pages, [
      'getting-started/introduction',
      'user-guide/workflows/overview',
      'user-guide/workflows/how-tos/generate-pdf-from-twenty',
    ]);
  });

  it('serves French pages at the site root under their French tab names', () => {
    const { tabs, pages } = filterNavigation(twentyDocsConfig, FRENCH);

    assert.deepEqual(
      tabs.map(({ tab }) => tab),
      ['Prise en main', "Guide de l'utilisateur"],
    );
    assert.deepEqual(tabs[1].groups[0].pages, ['user-guide/workflows/overview']);
    assert.deepEqual(pages, [
      'getting-started/introduction',
      'user-guide/workflows/overview',
    ]);
  });

  it('reports the navigation pages it excludes', () => {
    const { excludedPages } = filterNavigation(twentyDocsConfig, ENGLISH);

    assert.deepEqual(excludedPages, ['user-guide/billing/overview']);
  });

  it('fails when Twenty no longer has a tab for a kept section', () => {
    const withoutUserGuide = structuredClone(twentyDocsConfig);

    withoutUserGuide.navigation.languages[0].tabs.splice(1, 1);

    assert.throws(
      () => filterNavigation(withoutUserGuide, ENGLISH),
      /en docs have no tab for user-guide\/ pages/,
    );
  });
});

describe('filterRedirects', () => {
  const publishedPages = new Map([
    ['fr', new Set(['user-guide/workflows/overview'])],
    [
      'en',
      new Set([
        'user-guide/workflows/overview',
        'user-guide/workflows/how-tos/generate-pdf-from-twenty',
      ]),
    ],
  ]);

  it('repeats redirects for each language and falls back to English pages', () => {
    const redirects = filterRedirects(
      [
        { source: '/user-guide/workflows', destination: '/user-guide/workflows/overview' },
        {
          source: '/pdf',
          destination: '/user-guide/workflows/how-tos/generate-pdf-from-twenty#setup',
        },
        { source: '/developers/api', destination: '/developers/extend/api' },
      ],
      publishedPages,
    );

    assert.deepEqual(redirects, [
      { source: '/user-guide/workflows', destination: '/user-guide/workflows/overview' },
      { source: '/en/user-guide/workflows', destination: '/en/user-guide/workflows/overview' },
      {
        source: '/pdf',
        destination: '/en/user-guide/workflows/how-tos/generate-pdf-from-upshift#setup',
      },
      {
        source: '/en/pdf',
        destination: '/en/user-guide/workflows/how-tos/generate-pdf-from-upshift#setup',
      },
      {
        source: '/en/user-guide/workflows/how-tos/generate-pdf-from-twenty',
        destination: '/en/user-guide/workflows/how-tos/generate-pdf-from-upshift',
      },
    ]);
  });

  it('keeps one redirect per source', () => {
    const redirects = filterRedirects(
      [
        { source: '/flows', destination: '/user-guide/workflows/overview' },
        { source: '/fr/flows', destination: '/fr/user-guide/workflows/overview' },
      ],
      publishedPages,
    );

    assert.deepEqual(
      redirects
        .filter(({ source }) => source.endsWith('/flows'))
        .map(({ source }) => source),
      ['/flows', '/en/flows'],
    );
  });
});

describe('listLinkedPages', () => {
  it('lists the Getting Started and User Guide pages a page links to, by language', () => {
    const source = [
      '[Vues](/fr/user-guide/views-pipelines/overview#filtres)',
      '<Card href="/user-guide/layout/overview" />',
      '[API](/developers/extend/api) ![x](/images/a.png) [site](https://example.com)',
    ].join('\n');

    assert.deepEqual(listLinkedPages(source), [
      { language: FRENCH, page: 'user-guide/views-pipelines/overview' },
      { language: ENGLISH, page: 'user-guide/layout/overview' },
    ]);
  });
});

describe('findUnmatchedExclusions', () => {
  it('reports excluded prefixes that no Twenty page matches any more', () => {
    assert.deepEqual(
      findUnmatchedExclusions(
        ['user-guide/billing/overview', 'user-guide/billing/overview'],
        ['user-guide/billing/', 'user-guide/legal/'],
      ),
      [
        'rules.mjs excludes user-guide/legal/, but no Twenty page matches it any more; check where those pages moved',
      ],
    );
  });
});

describe('renamePage', () => {
  it('replaces twenty in page slugs', () => {
    assert.equal(
      renamePage('user-guide/calendar-emails/how-tos/can-i-send-emails-from-twenty'),
      'user-guide/calendar-emails/how-tos/can-i-send-emails-from-upshift',
    );
  });
});
