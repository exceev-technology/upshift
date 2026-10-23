import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { relocateVersion } from '../transform.mjs';
import {
  MAX_DOCS_VERSIONS,
  selectDocsVersions,
  versionPath,
} from '../versions.mjs';

describe('selectDocsVersions', () => {
  it('keeps the latest patch of each minor, newest first', () => {
    assert.deepEqual(
      selectDocsVersions([
        'upshift/v2.49.0',
        'upshift/v2.50.0',
        'upshift/v2.50.1',
        'upshift/v2.45.6',
        'upshift/v2.48.0',
      ]),
      ['2.50.1', '2.49.0', '2.48.0', '2.45.6'],
    );
  });

  it('compares versions as numbers and ignores tags that are not Upshift releases', () => {
    assert.deepEqual(
      selectDocsVersions(['upshift/v2.9.3', 'upshift/v2.10.0', 'twenty/v2.11.0', 'v2.12.0']),
      ['2.10.0', '2.9.3'],
    );
  });

  it(`stops at the ${MAX_DOCS_VERSIONS} newest minors`, () => {
    const tags = Array.from(
      { length: MAX_DOCS_VERSIONS + 2 },
      (_, index) => `upshift/v3.${index}.0`,
    );

    assert.equal(selectDocsVersions(tags).length, MAX_DOCS_VERSIONS);
    assert.equal(selectDocsVersions(tags)[0], `3.${MAX_DOCS_VERSIONS + 1}.0`);
  });
});

describe('versionPath', () => {
  it('names the folder of a version after its minor', () => {
    assert.equal(versionPath('2.49.0'), 'v2.49');
    assert.equal(versionPath('2.45.6'), 'v2.45');
  });
});

describe('relocateVersion', () => {
  const page = (body) => `---\ntitle: Page\npublic: true\n---\n\n${body}\n`;
  const latestFiles = new Map([
    ['docs.json', '{}'],
    ['images/same.png', Buffer.from('same')],
    ['images/changed.png', Buffer.from('new')],
    ['snippets/same.mdx', 'same snippet'],
    ['snippets/changed.mdx', 'new snippet'],
  ]);
  const version = {
    files: new Map([
      ['docs.json', '{}'],
      ['custom.css', 'body {}'],
      ['images/same.png', Buffer.from('same')],
      ['images/changed.png', Buffer.from('old')],
      ['images/only-old.png', Buffer.from('only old')],
      ['snippets/same.mdx', 'same snippet'],
      ['snippets/changed.mdx', 'old snippet'],
      [
        'getting-started/introduction.mdx',
        page(
          [
            "import { Same } from '/snippets/same.mdx';",
            "import { Changed } from '/snippets/changed.mdx';",
            '[Next](/user-guide/start#first-steps)',
            '<Card href="/en/getting-started/introduction" />',
            '[Website](https://upshiftcloud.com/user-guide/start)',
            '![Same](/images/same.png)',
            '![Changed](/images/changed.png)',
            '<img src="/images/only-old.png" />',
          ].join('\n'),
        ),
      ],
      ['user-guide/start.mdx', page('# First steps')],
      ['en/getting-started/introduction.mdx', '---\ntitle: Private\n---\n\nHello\n'],
    ]),
    sitePages: [
      'getting-started/introduction',
      'user-guide/start',
      'en/getting-started/introduction',
    ],
    privatePages: ['en/getting-started/introduction'],
    tabsByLanguage: new Map([
      [
        'fr',
        [
          {
            tab: 'Prise en main',
            groups: [
              {
                group: 'Bienvenue',
                public: true,
                pages: [
                  'getting-started/introduction',
                  { group: 'Guide', pages: ['user-guide/start'] },
                ],
              },
            ],
          },
        ],
      ],
    ]),
  };
  const relocated = relocateVersion(version, 'v2.49', latestFiles);
  const introduction = relocated.files
    .get('v2.49/getting-started/introduction.mdx')
    .toString();

  it('moves the pages and their navigation under the version folder', () => {
    assert.deepEqual(relocated.sitePages, [
      'v2.49/getting-started/introduction',
      'v2.49/user-guide/start',
      'v2.49/en/getting-started/introduction',
    ]);
    assert.deepEqual(relocated.privatePages, [
      'v2.49/en/getting-started/introduction',
    ]);
    assert.deepEqual(relocated.tabsByLanguage.get('fr')[0].groups[0], {
      group: 'Bienvenue',
      public: true,
      pages: [
        'v2.49/getting-started/introduction',
        { group: 'Guide', pages: ['v2.49/user-guide/start'] },
      ],
    });
  });

  it('points links to its own pages at the version folder and leaves other links alone', () => {
    assert.match(introduction, /\[Next\]\(\/v2\.49\/user-guide\/start#first-steps\)/);
    assert.match(introduction, /<Card href="\/v2\.49\/en\/getting-started\/introduction" \/>/);
    assert.match(
      introduction,
      /\[Website\]\(https:\/\/upshiftcloud\.com\/user-guide\/start\)/,
    );
  });

  it('shares the assets the latest version has unchanged and keeps its own copy of the others', () => {
    assert.deepEqual(
      [...relocated.files.keys()].filter((filePath) => !filePath.endsWith('.mdx') || filePath.startsWith('snippets/')).sort(),
      [
        'snippets/v2.49/changed.mdx',
        'v2.49/images/changed.png',
        'v2.49/images/only-old.png',
      ],
    );
    assert.match(introduction, /from '\/snippets\/same\.mdx'/);
    assert.match(introduction, /from '\/snippets\/v2\.49\/changed\.mdx'/);
    assert.match(introduction, /\(\/images\/same\.png\)/);
    assert.match(introduction, /\(\/v2\.49\/images\/changed\.png\)/);
    assert.match(introduction, /src="\/v2\.49\/images\/only-old\.png"/);
  });

  it('asks search engines to index only the latest version', () => {
    assert.match(introduction, /^---\nnoindex: true\ntitle: Page\npublic: true\n---\n/);
    assert.match(
      relocated.files.get('v2.49/en/getting-started/introduction.mdx').toString(),
      /^---\nnoindex: true\ntitle: Private\n---\n/,
    );
  });
});
