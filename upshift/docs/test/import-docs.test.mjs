import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { TWENTY_DOCS_ROOT, buildSite, findDrift } from '../import-docs.mjs';

describe('buildSite on packages/twenty-docs', () => {
  const { files, problems } = buildSite(TWENTY_DOCS_ROOT);
  const docsConfig = JSON.parse(files.get('docs.json'));

  it('builds without problems', () => {
    assert.deepEqual(problems, []);
  });

  it('publishes French by default and English under /en/, two tabs each', () => {
    const [french, english] = docsConfig.navigation.languages;

    assert.equal(french.language, 'fr');
    assert.equal(french.default, true);
    assert.equal(french.tabs.length, 2);
    assert.equal(english.language, 'en');
    assert.deepEqual(
      english.tabs.map(({ tab }) => tab),
      ['Getting Started', 'User Guide'],
    );
    assert.ok(files.has('getting-started/introduction.mdx'));
    assert.ok(files.has('en/getting-started/introduction.mdx'));
  });

  it('publishes no Developers, UI library, billing or legal page in any language', () => {
    const unwanted = [...files.keys()].filter(
      (filePath) =>
        /^(en\/)?(developers|ui|user-guide\/billing|user-guide\/legal)\//.test(
          filePath,
        ) || filePath.startsWith('fr/'),
    );

    assert.deepEqual(unwanted, []);
  });

  it('never sends a French reader to an English page that exists in French', () => {
    const englishLinksWithFrenchPages = [...files]
      .filter(
        ([filePath]) => filePath.endsWith('.mdx') && !filePath.startsWith('en/'),
      )
      .flatMap(([filePath, content]) =>
        [...content.toString().matchAll(/["(]\/en\/([^"#)?\s]+)/g)]
          .filter(([, page]) => files.has(`${page}.mdx`))
          .map(([, page]) => `${filePath} -> /en/${page}`),
      );

    assert.deepEqual(englishLinksWithFrenchPages, []);
  });

  it('publishes pages Twenty links to but keeps out of its navigation', () => {
    assert.ok(files.has('user-guide/views-pipelines/overview.mdx'));
    assert.ok(files.has('en/user-guide/views-pipelines/overview.mdx'));
    assert.match(
      files.get('getting-started/key-features.mdx'),
      /href="\/user-guide\/views-pipelines\/overview"/,
    );
  });

  it('ships the files Mintlify needs at the site root', () => {
    for (const filePath of [
      'docs.json',
      'custom.css',
      'logo-light.svg',
      'logo-dark.svg',
      'favicon.svg',
    ]) {
      assert.ok(files.has(filePath), filePath);
    }
  });

  it('uses the rounded Upshift icon as favicon, like upshiftcloud.com', () => {
    assert.match(files.get('favicon.svg').toString(), /rx="16"/);
  });

  it('recolors the halftone illustrations to the Upshift accent in both themes', () => {
    const css = files.get('custom.css').toString();

    assert.match(css, /img\[src\*='\/images\/user-guide\/halftone\/'\] \{\n {2}filter:/);
    assert.match(css, /\.dark, \[data-theme='dark'\]\) img\[src\*='\/images\/user-guide\/halftone\/'\]/);
  });
});

describe('findDrift', () => {
  it('reports edited, missing and extra files and ignores dotfiles', () => {
    const siteRoot = mkdtempSync(path.join(tmpdir(), 'upshift-docs-'));

    mkdirSync(path.join(siteRoot, 'user-guide'));
    writeFileSync(path.join(siteRoot, 'user-guide/a.mdx'), 'edited in the Mintlify editor');
    writeFileSync(path.join(siteRoot, 'extra.mdx'), 'not generated');
    writeFileSync(path.join(siteRoot, '.DS_Store'), '');

    const files = new Map([
      ['user-guide/a.mdx', 'generated'],
      ['user-guide/b.mdx', 'generated'],
    ]);

    assert.deepEqual(findDrift(files, siteRoot), {
      changed: ['user-guide/a.mdx', 'user-guide/b.mdx'],
      extra: ['extra.mdx'],
    });
  });
});
