import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LANGUAGES } from '../rules.mjs';
import {
  buildLocaleRedirects,
  buildUntranslatedRedirects,
  filterNavigation,
  filterRedirects,
  findUnmatchedExclusions,
  isExcluded,
  listLinkedPages,
  publicTabs,
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
          {
            tab: 'Développeurs',
            groups: [
              { group: "Vue d'ensemble", pages: ['fr/developers/introduction'] },
              {
                group: 'Auto-hébergement',
                pages: ['fr/developers/self-host/capabilities/docker-compose'],
              },
            ],
          },
        ],
      },
    ],
  },
};

describe('filterNavigation', () => {
  it('keeps the Getting Started, User Guide and Developers tabs without excluded pages', () => {
    const { tabs, pages } = filterNavigation(twentyDocsConfig, ENGLISH);

    assert.deepEqual(tabs, [
      {
        tab: 'Getting Started',
        groups: [
          {
            group: 'Welcome',
            pages: ['en/getting-started/introduction'],
            public: true,
          },
        ],
      },
      {
        tab: 'User Guide',
        groups: [
          {
            group: 'Workflows',
            public: true,
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
      {
        tab: 'Developers',
        groups: [{ group: 'Overview', pages: ['en/developers/introduction'] }],
      },
    ]);
    assert.deepEqual(pages, [
      'getting-started/introduction',
      'user-guide/workflows/overview',
      'user-guide/workflows/how-tos/generate-pdf-from-twenty',
      'developers/introduction',
    ]);
  });

  it('serves French pages at the site root under their French tab names', () => {
    const { tabs, pages } = filterNavigation(twentyDocsConfig, FRENCH);

    assert.deepEqual(
      tabs.map(({ tab }) => tab),
      ['Prise en main', "Guide de l'utilisateur", 'Développeurs'],
    );
    assert.deepEqual(tabs[1].groups[0], {
      group: 'Flux de travail',
      pages: ['user-guide/workflows/overview'],
      public: true,
    });
    assert.deepEqual(tabs[2].groups, [
      { group: "Vue d'ensemble", pages: ['developers/introduction'] },
    ]);
    assert.deepEqual(pages, [
      'getting-started/introduction',
      'user-guide/workflows/overview',
      'developers/introduction',
    ]);
  });

  it('reports the navigation pages it excludes', () => {
    assert.deepEqual(filterNavigation(twentyDocsConfig, ENGLISH).excludedPages, [
      'user-guide/billing/overview',
    ]);
    assert.deepEqual(filterNavigation(twentyDocsConfig, FRENCH).excludedPages, [
      'developers/self-host/capabilities/docker-compose',
    ]);
  });

  it('publishes the root page of a group, unless it is excluded', () => {
    const withRoots = {
      navigation: {
        languages: [
          {
            language: 'en',
            tabs: [
              {
                tab: 'Getting Started',
                groups: [
                  {
                    group: 'Welcome',
                    root: 'getting-started/introduction',
                    pages: ['getting-started/key-features'],
                  },
                ],
              },
              {
                tab: 'User Guide',
                groups: [
                  {
                    group: 'Billing',
                    root: 'user-guide/billing/overview',
                    pages: ['user-guide/workflows/overview'],
                  },
                ],
              },
              {
                tab: 'Developers',
                groups: [{ group: 'Overview', root: 'developers/introduction', pages: [] }],
              },
            ],
          },
        ],
      },
    };
    const { tabs, pages, excludedPages } = filterNavigation(withRoots, ENGLISH);

    assert.deepEqual(
      tabs.map(({ groups }) => groups),
      [
        [
          {
            group: 'Welcome',
            root: 'en/getting-started/introduction',
            pages: ['en/getting-started/key-features'],
            public: true,
          },
        ],
        [{ group: 'Billing', pages: ['en/user-guide/workflows/overview'], public: true }],
        [{ group: 'Overview', root: 'en/developers/introduction', pages: [] }],
      ],
    );
    assert.deepEqual(pages, [
      'getting-started/introduction',
      'getting-started/key-features',
      'user-guide/workflows/overview',
      'developers/introduction',
    ]);
    assert.deepEqual(excludedPages, ['user-guide/billing/overview']);
  });
});

describe('publicTabs', () => {
  it('leaves out the tabs of sections behind the docs login, in each language', () => {
    const { tabs: englishTabs } = filterNavigation(twentyDocsConfig, ENGLISH);
    const { tabs: frenchTabs } = filterNavigation(twentyDocsConfig, FRENCH);

    assert.deepEqual(
      publicTabs(ENGLISH, englishTabs).map(({ tab }) => tab),
      ['Getting Started', 'User Guide'],
    );
    assert.deepEqual(
      publicTabs(FRENCH, frenchTabs).map(({ tab }) => tab),
      ['Prise en main', "Guide de l'utilisateur"],
    );
  });

  it('fails when Twenty no longer has a tab for a kept section', () => {
    const withoutUserGuide = structuredClone(twentyDocsConfig);

    withoutUserGuide.navigation.languages[0].tabs.splice(1, 1);

    assert.throws(
      () => filterNavigation(withoutUserGuide, ENGLISH),
      /en docs have no tab for user-guide\/ pages/,
    );
  });

  it('leaves the section out of an older version that does not have it', () => {
    const withoutUserGuide = structuredClone(twentyDocsConfig);

    withoutUserGuide.navigation.languages[0].tabs.splice(1, 1);

    const { tabs, missingSections } = filterNavigation(withoutUserGuide, ENGLISH, {
      historical: true,
    });

    assert.deepEqual(tabs.map(({ tab }) => tab), ['Getting Started', 'Developers']);
    assert.deepEqual(missingSections, ['user-guide']);
  });

  it('excludes pages with the exclusions it is given', () => {
    const { pages, excludedPages } = filterNavigation(twentyDocsConfig, ENGLISH, {
      exclusions: ['user-guide/'],
    });

    assert.ok(pages.every((page) => !page.startsWith('user-guide/')));
    assert.ok(excludedPages.some((page) => page.startsWith('user-guide/')));
    assert.ok(pages.some((page) => page.startsWith('getting-started/')));
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

describe('buildUntranslatedRedirects', () => {
  it('sends the French address of a page Twenty has not translated to its English version', () => {
    const publishedPages = new Map([
      ['fr', new Set(['user-guide/calendar-emails/overview'])],
      [
        'en',
        new Set([
          'user-guide/calendar-emails/overview',
          'user-guide/calendar-emails/capabilities/email-channels',
          'user-guide/workflows/how-tos/generate-pdf-from-twenty',
        ]),
      ],
    ]);

    assert.deepEqual(buildUntranslatedRedirects(publishedPages), [
      {
        source: '/user-guide/calendar-emails/capabilities/email-channels',
        destination: '/en/user-guide/calendar-emails/capabilities/email-channels',
      },
      {
        source: '/user-guide/workflows/how-tos/generate-pdf-from-twenty',
        destination: '/en/user-guide/workflows/how-tos/generate-pdf-from-upshift',
      },
      {
        source: '/user-guide/workflows/how-tos/generate-pdf-from-upshift',
        destination: '/en/user-guide/workflows/how-tos/generate-pdf-from-upshift',
      },
    ]);
  });
});

describe('listLinkedPages', () => {
  it('lists the pages of published sections a page links to, by language', () => {
    const source = [
      '[Vues](/fr/user-guide/views-pipelines/overview#filtres)',
      '<Card href="/user-guide/layout/overview" />',
      '[API](/developers/extend/api) ![x](/images/a.png) [site](https://example.com)',
      '[Button](/ui/primitives/input/button)',
    ].join('\n');

    assert.deepEqual(listLinkedPages(source), [
      { language: FRENCH, page: 'user-guide/views-pipelines/overview' },
      { language: ENGLISH, page: 'developers/extend/api' },
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

  it('reads the prefix of an exclusion bound to versions', () => {
    assert.deepEqual(
      findUnmatchedExclusions(
        ['user-guide/billing/overview'],
        [
          { prefix: 'user-guide/billing/', until: '2.50' },
          { prefix: 'user-guide/plans/', since: '2.51' },
        ],
      ),
      [
        'rules.mjs excludes user-guide/plans/, but no Twenty page matches it any more; check where those pages moved',
      ],
    );
  });
});

describe('isExcluded', () => {
  it('excludes a page under any prefix, whatever versions the prefix is bound to', () => {
    const exclusions = [
      'user-guide/old-plans/',
      { prefix: 'user-guide/new-plans/', since: '2.51' },
    ];

    assert.equal(isExcluded('user-guide/old-plans/terms', exclusions), true);
    assert.equal(isExcluded('user-guide/new-plans/overview', exclusions), true);
    assert.equal(isExcluded('user-guide/billing/overview', exclusions), false);
  });
});

describe('buildLocaleRedirects', () => {
  it('maps the language prefixes the app adds to the pages this site publishes', () => {
    assert.deepEqual(buildLocaleRedirects(['fr', 'ar', 'de'], 'en'), [
      { source: '/fr/:slug*', destination: '/:slug*' },
      { source: '/ar/:slug*', destination: '/en/:slug*' },
      { source: '/de/:slug*', destination: '/en/:slug*' },
    ]);
  });

  it('adds nothing for the language the app serves without a prefix', () => {
    assert.deepEqual(buildLocaleRedirects(['en'], 'en'), []);
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
