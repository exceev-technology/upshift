import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import {
  TWENTY_DOCS_ROOT,
  buildSite,
  parseArguments,
} from '../import-docs.mjs';

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
    assert.equal(french.versions[0].tabs.length, 2);
    assert.equal(english.language, 'en');
    assert.deepEqual(
      english.versions[0].tabs.map(({ tab }) => tab),
      ['Getting Started', 'User Guide'],
    );
    assert.ok(files.has('getting-started/introduction.mdx'));
    assert.ok(files.has('en/getting-started/introduction.mdx'));
  });

  it('labels the docs with the release version the checkout ships', () => {
    const [, appVersion] = readFileSync(
      path.join(
        TWENTY_DOCS_ROOT,
        '../twenty-server/src/engine/core-modules/upgrade/constants/twenty-current-version.constant.ts',
      ),
      'utf8',
    ).match(/TWENTY_CURRENT_VERSION = '(\d+\.\d+\.\d+)'/);

    for (const { versions } of docsConfig.navigation.languages) {
      assert.deepEqual(
        versions.map(({ version, default: isDefault }) => ({
          version,
          default: isDefault,
        })),
        [{ version: `v${appVersion}`, default: true }],
      );
    }
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

  it('presents Upshift as one platform for the whole business, not a CRM', () => {
    const french = files.get('getting-started/introduction.mdx');
    const english = files.get('en/getting-started/introduction.mdx');

    assert.match(french, /Toute votre entreprise, sur une seule plateforme simple/);
    assert.match(english, /Your whole business, on one simple platform/);
    assert.doesNotMatch(french + english, /Salesforce|vibe-coded/);
    assert.doesNotMatch(
      files.get('getting-started/key-features.mdx') +
        files.get('en/getting-started/key-features.mdx'),
      /plateforme CRM|CRM platform/,
    );
  });

  it('maps the processes of every industry, HR included, on both introductions', () => {
    const processMap = files.get('snippets/process-map.jsx');

    assert.match(files.get('getting-started/introduction.mdx'), /<ProcessMap lang="fr" \/>/);
    assert.match(files.get('en/getting-started/introduction.mdx'), /<ProcessMap lang="en" \/>/);
    assert.match(processMap, /\[\s*'RH',\s*'Recrutement/);
    assert.match(processMap, /\[\s*'HR',\s*'Recruitment/);
    assert.match(processMap, /name: 'Associations et secteur public'/);
    assert.match(processMap, /name: 'Non-profit and public sector'/);
    assert.match(processMap, /name: 'Équipement médical'/);
    assert.match(processMap, /name: 'Medical equipment'/);
    assert.match(processMap, /'Conformité réglementaire'/);
    assert.match(processMap, /'Regulatory compliance'/);
  });

  it('publishes the Upshift Community settings page, with Exceev links instead of Discord', () => {
    for (const filePath of [
      'user-guide/settings/capabilities/community-settings.mdx',
      'en/user-guide/settings/capabilities/community-settings.mdx',
    ]) {
      const page = String(files.get(filePath));

      assert.match(page, /linkedin\.com\/company\/exceev-consulting/);
      assert.match(page, /x\.com\/ExceevConseil/);
      assert.match(page, /Paramètres → Communauté|Settings → Community/);
    }

    assert.doesNotMatch([...files.values()].map(String).join('\n'), /discord\.gg/);
  });

  it('sends links built by the app for /fr/ and other languages to published pages', () => {
    assert.ok(
      docsConfig.redirects.some(
        ({ source, destination }) =>
          source === '/fr/:slug*' && destination === '/:slug*',
      ),
    );
    assert.ok(
      docsConfig.redirects.some(
        ({ source, destination }) =>
          source === '/de/:slug*' && destination === '/en/:slug*',
      ),
    );
  });

  it('gives the Delay action the same credit cost in French and English', () => {
    const french = files.get('user-guide/workflows/capabilities/workflow-credits.mdx');

    assert.match(french, /Le nœud Delay consomme \*\*0,0001 crédit/);
    assert.doesNotMatch(french, /\*\*1 crédit\*\*/);
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

  it('keeps the four footer columns from overlapping on tablets and small laptops', () => {
    assert.match(
      files.get('custom.css').toString(),
      /@media \(min-width: 768px\) and \(max-width: 1279px\) \{\n {2}footer \.sm\\:grid \{\n {4}grid-template-columns: repeat\(2, minmax\(0, 1fr\)\) !important;/,
    );
  });

  it('recolors the halftone illustrations to the Upshift accent in both themes', () => {
    const css = files.get('custom.css').toString();

    assert.match(css, /img\[src\*='\/images\/user-guide\/halftone\/'\] \{\n {2}filter:/);
    assert.match(css, /\.dark, \[data-theme='dark'\]\) img\[src\*='\/images\/user-guide\/halftone\/'\]/);
  });
});

describe('buildSite on the sources of an Upshift release', () => {
  const appRoot = mkdtempSync(path.join(tmpdir(), 'upshift-docs-release-'));
  const writeApp = (relativePath, content) => {
    mkdirSync(path.join(appRoot, path.dirname(relativePath)), {
      recursive: true,
    });
    writeFileSync(path.join(appRoot, relativePath), content);
  };

  writeApp(
    'packages/twenty-shared/src/constants/DocumentationSupportedLanguages.ts',
    "export const DOCUMENTATION_SUPPORTED_LANGUAGES = ['en', 'fr'] as const;\n",
  );
  writeApp(
    'packages/twenty-shared/src/constants/DocumentationDefaultLanguage.ts',
    "export const DOCUMENTATION_DEFAULT_LANGUAGE = 'en';\n",
  );
  writeApp(
    'packages/twenty-server/src/engine/core-modules/upgrade/constants/twenty-current-version.constant.ts',
    "export const TWENTY_CURRENT_VERSION = '9.9.9' as const;\n",
  );

  it('labels the docs with the version of the checkout it reads', () => {
    const { files, problems } = buildSite(TWENTY_DOCS_ROOT, { appRoot });
    const docsConfig = JSON.parse(files.get('docs.json'));

    assert.deepEqual(problems, []);
    assert.equal(
      docsConfig.navigation.languages[0].versions[0].version,
      'v9.9.9',
    );
  });

  it('refuses to label the docs with an Upshift release the sources do not carry', () => {
    const { problems } = buildSite(TWENTY_DOCS_ROOT, {
      appRoot,
      releaseVersion: '2.46.0',
    });

    assert.deepEqual(problems, [
      'the docs are built for Upshift v2.46.0 but the sources carry 9.9.9',
    ]);
  });
});

describe('parseArguments', () => {
  it('reads the Twenty checkout, the Upshift release and the check flag', () => {
    assert.deepEqual(
      parseArguments(['--root', 'twenty', '--version', '2.46.0', '--check']),
      { twentyRoot: 'twenty', releaseVersion: '2.46.0', check: true },
    );
  });

  it('defaults to this checkout, no release and a full write', () => {
    assert.deepEqual(parseArguments([]), {
      twentyRoot: undefined,
      releaseVersion: undefined,
      check: false,
    });
  });
});
