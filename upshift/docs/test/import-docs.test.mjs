import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import {
  TWENTY_DOCS_ROOT,
  buildSite,
  mergeVersions,
  parseArguments,
  readOverrides,
} from '../import-docs.mjs';
import {
  BRAND_COLORS,
  DEMO_URL,
  EXCLUDED_PAGE_PREFIXES,
  PHRASE_REPLACEMENTS,
  UNPUBLISHED_STYLE_ASSETS,
} from '../rules.mjs';
import { collectStyleAssets } from '../transform.mjs';

const splitSelectors = (selectors) => {
  const parts = [''];
  let depth = 0;

  for (const character of selectors) {
    depth += character === '(' ? 1 : character === ')' ? -1 : 0;

    if (character === ',' && depth === 0) {
      parts.push('');
    } else {
      parts[parts.length - 1] += character;
    }
  }

  return parts.map((part) => part.trim().replace(/\s+/g, ' '));
};

// The values a property gets in the rules that list this exact selector.
const declarationsOf = (css, selector, property) =>
  [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selectors]) => splitSelectors(selectors).includes(selector))
    .flatMap(([, , body]) =>
      [...body.matchAll(new RegExp(`(?:^|;)\\s*${property}: ([^;]+);`, 'g'))].map(
        ([, value]) => value.trim(),
      ),
    );

describe('buildSite on packages/twenty-docs', () => {
  const { files, problems } = buildSite(TWENTY_DOCS_ROOT);
  const docsConfig = JSON.parse(files.get('docs.json'));

  it('builds without problems', () => {
    assert.deepEqual(problems, []);
  });

  it('publishes French by default and English under /en/, three tabs each', () => {
    const [french, english] = docsConfig.navigation.languages;

    assert.equal(french.language, 'fr');
    assert.equal(french.default, true);
    assert.equal(french.versions[0].tabs.length, 3);
    assert.equal(english.language, 'en');
    assert.deepEqual(
      english.versions[0].tabs.map(({ tab }) => tab),
      ['Getting Started', 'User Guide', 'Developers'],
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

  it('publishes no self-hosting, contributing, UI library, billing or legal page in any language', () => {
    const unwanted = [...files.keys()].filter(
      (filePath) =>
        /^(en\/)?(developers\/self-host|developers\/contribute|ui|user-guide\/billing|user-guide\/legal)\//.test(
          filePath,
        ) || filePath.startsWith('fr/'),
    );

    assert.deepEqual(unwanted, []);
  });

  it('puts the Developers pages behind the docs login and every other page in front of it', () => {
    const pages = [...files.keys()].filter(
      (filePath) => filePath.endsWith('.mdx') && !filePath.startsWith('snippets/'),
    );
    const isMarkedPublic = (filePath) =>
      /^---\n(?:.*\n)*?public: true\n/.test(files.get(filePath));
    const developerPages = pages.filter((filePath) =>
      /^(en\/)?developers\//.test(filePath),
    );

    assert.ok(files.has('developers/introduction.mdx'));
    assert.ok(files.has('en/developers/extend/apps/getting-started/quick-start.mdx'));
    assert.deepEqual(developerPages.filter(isMarkedPublic), []);
    assert.deepEqual(
      pages.filter(
        (filePath) => !developerPages.includes(filePath) && !isMarkedPublic(filePath),
      ),
      [],
    );
  });

  it('shows signed-out readers the navigation of every tab but Developers', () => {
    for (const { versions } of docsConfig.navigation.languages) {
      const [gettingStarted, userGuide, developers] = versions[0].tabs;

      for (const { groups } of [gettingStarted, userGuide]) {
        assert.ok(groups.length > 0);
        assert.ok(groups.every((group) => group.public === true));
      }

      assert.ok(developers.groups.every((group) => group.public === undefined));
    }
  });

  it('keeps the Developers tab out of the footer', () => {
    for (const { footer } of docsConfig.navigation.languages) {
      assert.doesNotMatch(JSON.stringify(footer), /developers/);
    }
  });

  it('never names Twenty in a page, code samples included, except the webhook headers', () => {
    const mentions = [...files]
      .filter(([filePath]) => /\.(mdx|jsx?)$/.test(filePath))
      .flatMap(([filePath, content]) =>
        [
          ...content
            .toString()
            .matchAll(/.{0,40}((?<!X-)\bTwenty\b|\bVingt\b|\bvingt-).{0,40}/g),
        ].map(([mention]) => `${filePath}: ${mention}`),
      );

    assert.deepEqual(mentions, []);
  });

  it('points the tutorial app manifest at a published page, in each language', () => {
    for (const filePath of [
      'developers/extend/apps/tutorials/document-generator/publishing.mdx',
      'en/developers/extend/apps/tutorials/document-generator/publishing.mdx',
    ]) {
      const [, page] = files
        .get(filePath)
        .match(/websiteUrl: 'https:\/\/docs\.upshiftcloud\.com\/([^']+)'/);

      assert.ok(files.has(`${page}.mdx`), `${filePath} -> ${page}`);
    }
  });

  it('serves the app links to the developer docs', () => {
    assert.ok(
      docsConfig.redirects.some(
        ({ source, destination }) =>
          source === '/developers/extend/apps/getting-started' &&
          destination === '/developers/extend/apps/getting-started/quick-start',
      ),
    );
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

  it('opens the intro booking in a Cal.com pop-up with the Upshift colors', () => {
    const script = files.get('booking.js').toString();
    const [, origin] = script.match(/var ORIGIN = '([^']+)'/);
    const [, calLink] = script.match(/var CAL_LINK = '([^']+)'/);

    assert.equal(`${origin}/${calLink}`, DEMO_URL);
    assert.equal(docsConfig.navbar.primary.href, DEMO_URL);
    // Mintlify's light color is the accent of the dark theme.
    assert.match(script, new RegExp(`light: '${BRAND_COLORS.primary}'`));
    assert.match(script, new RegExp(`dark: '${BRAND_COLORS.light}'`));
  });

  it('uses the rounded Upshift icon as favicon, like upshiftcloud.com', () => {
    assert.match(files.get('favicon.svg').toString(), /rx="16"/);
  });

  it('publishes the fonts and images the styles load, except Twenty\'s logo', () => {
    const assets = collectStyleAssets(files.get('custom.css').toString());

    assert.ok(assets.some((asset) => asset.startsWith('fonts/')));
    assert.ok(assets.some((asset) => asset.startsWith('images/documentation/banners/')));
    assert.deepEqual(
      assets.filter(
        (asset) => !files.has(asset) && !UNPUBLISHED_STYLE_ASSETS.includes(asset),
      ),
      [],
    );
    assert.equal(files.has('images/documentation/banners/meet-twenty.png'), false);
  });

  it('puts the four footer columns on one row below the logo', () => {
    const css = files.get('custom.css').toString();

    assert.match(
      css,
      /#footer \.sm\\:grid \{\n {4}grid-template-columns: repeat\(4, minmax\(0, 1fr\)\) !important;/,
    );
    assert.match(
      css,
      /#footer div:has\(> div > a > \.nav-logo\) \{\n {4}display: flex;\n {4}flex-direction: column;/,
    );
  });

  it('keeps the navbar tabs centered and apart from the Contact us button', () => {
    assert.match(
      files.get('custom.css').toString(),
      /#navbar nav:has\(> ul > #topbar-cta-button\) \{\n {4}display: flex;\n {4}flex: 1 1 0;/,
    );
  });

  const DARK = ":is(.dark, [data-theme='dark'])";
  const BANNER_LAYER = '#header > div:has(#page-title)::before';

  it('recolors Twenty\'s illustrations to the Upshift accent in both themes', () => {
    const css = files.get('custom.css').toString();
    const illustrations = [
      "img[src*='/images/user-guide/halftone/']",
      ".documentation-card-group img[src*='/images/documentation/']",
      `#content-area:has([data-page-banner]) ${BANNER_LAYER}`,
    ];

    for (const illustration of illustrations) {
      assert.deepEqual(declarationsOf(css, illustration, 'filter'), [
        'brightness(0.51) saturate(1.62) hue-rotate(-4deg)',
      ]);
      assert.deepEqual(declarationsOf(css, `${DARK} ${illustration}`, 'filter'), [
        'saturate(0.24) brightness(2.09) hue-rotate(-5deg)',
      ]);
    }
  });

  it('gives the two banners drawn in a deeper blue filters of their own', () => {
    const css = files.get('custom.css').toString();
    const banners = `#content-area:has([data-page-banner='user-guide'], [data-page-banner='developers']) ${BANNER_LAYER}`;

    assert.deepEqual(declarationsOf(css, banners, 'filter'), [
      'brightness(1.82) saturate(0.66) hue-rotate(-3deg)',
    ]);
    assert.deepEqual(declarationsOf(css, `${DARK} ${banners}`, 'filter'), [
      'saturate(0.08) brightness(5.48) hue-rotate(-1deg)',
    ]);
  });

  it('keeps the filters off the card panels and banner patterns', () => {
    const css = files.get('custom.css').toString();

    assert.deepEqual(
      declarationsOf(css, '.documentation-card-group .card img', 'background'),
      ['none'],
    );
    assert.deepEqual(
      declarationsOf(css, '.documentation-card-group .card::before', 'background-image'),
      ['var(--card-pattern)'],
    );
    assert.deepEqual(
      declarationsOf(css, `#content-area:has([data-page-banner]) ${BANNER_LAYER}`, 'background-image'),
      ['var(--page-banner-illustration)'],
    );
  });
});

describe('buildSite for a docs site without the login', () => {
  const { files, problems } = buildSite(TWENTY_DOCS_ROOT, { publicOnly: true });
  const docsConfig = JSON.parse(files.get('docs.json'));

  it('leaves the Developers tab and its pages out, and still checks their rules', () => {
    assert.deepEqual(problems, []);
    assert.deepEqual(
      [...files.keys()].filter((filePath) => /^(en\/)?developers\//.test(filePath)),
      [],
    );

    for (const { versions } of docsConfig.navigation.languages) {
      assert.equal(versions[0].tabs.length, 2);
    }
  });

  it('turns links to developer pages back into text', () => {
    assert.doesNotMatch(
      [...files.values()].map(String).join('\n'),
      /\]\(\/(en\/)?developers\/|href="\/(en\/)?developers\//,
    );
  });
});

const writeReleaseSources = (currentVersion) => {
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
    `export const TWENTY_CURRENT_VERSION = '${currentVersion}' as const;\n`,
  );

  return appRoot;
};

describe('buildSite on the sources of an Upshift release', () => {
  const appRoot = writeReleaseSources('9.9.9');

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
      releaseVersion: '9.8.0',
    });

    assert.deepEqual(problems, [
      'the docs are built for Upshift v9.8.0 but the sources carry 9.9.9',
    ]);
  });
});

describe('buildSite on the sources of an Upshift patch release', () => {
  const appRoot = writeReleaseSources('9.9.0');

  it('labels the docs with the patch release, whose sources carry the version of its minor', () => {
    const { files, problems } = buildSite(TWENTY_DOCS_ROOT, {
      appRoot,
      releaseVersion: '9.9.3',
    });
    const docsConfig = JSON.parse(files.get('docs.json'));

    assert.deepEqual(problems, []);
    assert.equal(
      docsConfig.navigation.languages[0].versions[0].version,
      'v9.9.3',
    );
  });

  it('refuses a release from another minor', () => {
    const { problems } = buildSite(TWENTY_DOCS_ROOT, {
      appRoot,
      releaseVersion: '9.8.0',
    });

    assert.deepEqual(problems, [
      'the docs are built for Upshift v9.8.0 but the sources carry 9.9.0',
    ]);
  });
});

describe('buildSite of an older version', () => {
  const appRoot = writeReleaseSources('9.8.0');
  const staleRule = {
    from: 'A sentence Twenty no longer writes.',
    to: 'Anything.',
    count: 1,
  };
  const withRule = (rule) => ({
    ...PHRASE_REPLACEMENTS,
    fr: [...PHRASE_REPLACEMENTS.fr, rule],
  });

  it('fails the latest version on a phrase rule that no longer matches', () => {
    const { problems } = buildSite(TWENTY_DOCS_ROOT, {
      appRoot,
      releaseVersion: '9.8.0',
      phraseReplacements: withRule(staleRule),
    });

    assert.equal(problems.length, 1);
    assert.match(problems[0], /^fr: rules\.mjs expects 1 matches of "A sentence Twenty no longer writes\." .* found 0$/);
  });

  it('leaves the files the styles load to the latest version, whose styles the site uses', () => {
    const { files, problems } = buildSite(TWENTY_DOCS_ROOT, {
      appRoot,
      releaseVersion: '9.8.0',
      historical: true,
    });

    assert.deepEqual(problems, []);
    assert.equal(files.has('fonts/azeret-mono-latin-variable.woff2'), false);
  });

  it('only warns about it on an older version, whose sources never change', () => {
    const { problems, warnings } = buildSite(TWENTY_DOCS_ROOT, {
      appRoot,
      releaseVersion: '9.8.0',
      historical: true,
      phraseReplacements: withRule(staleRule),
    });

    assert.deepEqual(problems, []);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /^fr: rules\.mjs expects 1 matches/);
  });

  it('still fails an older version on an exclusion that matches no page, so excluded pages cannot slip through', () => {
    const { problems } = buildSite(TWENTY_DOCS_ROOT, {
      appRoot,
      releaseVersion: '9.8.0',
      historical: true,
      excludedPagePrefixes: [...EXCLUDED_PAGE_PREFIXES, 'user-guide/no-such-section/'],
    });

    assert.deepEqual(problems, [
      'rules.mjs excludes user-guide/no-such-section/, but no Twenty page matches it any more; check where those pages moved',
    ]);
  });

  it('requires an exclusion bound to versions only in the versions it covers', () => {
    const { problems } = buildSite(TWENTY_DOCS_ROOT, {
      appRoot,
      releaseVersion: '9.8.0',
      historical: true,
      excludedPagePrefixes: [
        ...EXCLUDED_PAGE_PREFIXES,
        { prefix: 'user-guide/no-such-section/', since: '9.9' },
      ],
    });

    assert.deepEqual(problems, []);
  });

  it('removes the pages of an exclusion only in the versions it covers', () => {
    const build = (exclusion) =>
      buildSite(TWENTY_DOCS_ROOT, {
        appRoot,
        releaseVersion: '9.8.0',
        historical: true,
        excludedPagePrefixes: [...EXCLUDED_PAGE_PREFIXES, exclusion],
      });
    const covered = build({ prefix: 'user-guide/data-model/', since: '9.8' });
    const notCovered = build({ prefix: 'user-guide/data-model/', until: '9.7' });
    const dataModelPage = 'en/user-guide/data-model/capabilities/fields.mdx';

    assert.deepEqual(covered.problems, []);
    assert.equal(covered.files.has(dataModelPage), false);
    assert.deepEqual(notCovered.problems, []);
    assert.equal(notCovered.files.has(dataModelPage), true);
  });

  it('skips a rule whose `until` minor is older than the version it builds', () => {
    const { problems, warnings } = buildSite(TWENTY_DOCS_ROOT, {
      appRoot,
      releaseVersion: '9.8.0',
      phraseReplacements: withRule({ ...staleRule, until: '9.7' }),
    });

    assert.deepEqual(problems, []);
    assert.deepEqual(warnings, []);
  });
});

describe('buildSite with an override that links to a page a version lacks', () => {
  const appRoot = writeReleaseSources('9.8.0');
  const overrides = readOverrides();
  const communitySettings = 'user-guide/settings/capabilities/community-settings.mdx';

  overrides.set(
    communitySettings,
    `${overrides.get(communitySettings)}\n[Plus tard](/user-guide/not-yet) et [Démarrage](/getting-started/introduction).\n`,
  );

  it('fails the latest version on the broken link', () => {
    const { problems } = buildSite(TWENTY_DOCS_ROOT, {
      appRoot,
      releaseVersion: '9.8.0',
      overrides,
    });

    assert.deepEqual(problems, [
      `${communitySettings} links to /user-guide/not-yet, which is not published`,
    ]);
  });

  it('publishes the link as plain text in an older version, with a warning', () => {
    const { files, problems, warnings } = buildSite(TWENTY_DOCS_ROOT, {
      appRoot,
      releaseVersion: '9.8.0',
      historical: true,
      overrides,
    });

    assert.deepEqual(problems, []);
    assert.deepEqual(warnings, [
      `overrides/${communitySettings} links to pages this version does not publish; they are plain text`,
    ]);
    assert.match(
      files.get(communitySettings).toString(),
      /Plus tard et \[Démarrage\]\(\/getting-started\/introduction\)\./,
    );
  });
});

describe('mergeVersions', () => {
  const latest = buildSite(TWENTY_DOCS_ROOT);
  const older = {
    version: '9.8.0',
    ...buildSite(TWENTY_DOCS_ROOT, {
      appRoot: writeReleaseSources('9.8.0'),
      releaseVersion: '9.8.0',
    }),
  };
  const { files, problems } = mergeVersions(latest, [older]);
  const docsConfig = JSON.parse(files.get('docs.json'));
  const latestConfig = JSON.parse(latest.files.get('docs.json'));

  it('builds without problems', () => {
    assert.deepEqual(problems, []);
  });

  it('lists the latest version first and as the default, then the older one, in every language', () => {
    for (const { versions } of docsConfig.navigation.languages) {
      assert.deepEqual(
        versions.map(({ version, default: isDefault }) => ({
          version,
          default: isDefault,
        })),
        [
          { version: latestConfig.navigation.languages[0].versions[0].version, default: true },
          { version: 'v9.8.0', default: undefined },
        ],
      );
    }
  });

  it('serves the latest version at the root and the older one under its folder', () => {
    const [french, english] = docsConfig.navigation.languages;

    assert.ok(files.has('getting-started/introduction.mdx'));
    assert.ok(files.has('v9.8/getting-started/introduction.mdx'));
    assert.ok(files.has('v9.8/en/getting-started/introduction.mdx'));
    assert.equal(french.versions[1].tabs[0].groups[0].pages[0], 'v9.8/getting-started/introduction');
    assert.match(
      JSON.stringify(english.versions[1].tabs),
      /"v9\.8\/en\/getting-started\//,
    );
    assert.doesNotMatch(
      files.get('getting-started/introduction.mdx').toString(),
      /noindex/,
    );
    assert.match(
      files.get('v9.8/getting-started/introduction.mdx').toString(),
      /^---\nnoindex: true\n/,
    );
  });

  it('keeps the redirects, navbar, footer and assets of the latest version only', () => {
    assert.deepEqual(docsConfig.redirects, latestConfig.redirects);
    assert.deepEqual(docsConfig.footer, latestConfig.footer);
    assert.deepEqual(docsConfig.navbar, latestConfig.navbar);
    assert.deepEqual(
      [...files.keys()].filter(
        (filePath) => filePath.startsWith('v9.8/images/') || filePath.startsWith('snippets/v9.8/'),
      ),
      [],
    );
  });
});

describe('parseArguments', () => {
  it('reads the Twenty checkout, the Upshift release and the check and public-only flags', () => {
    assert.deepEqual(
      parseArguments([
        '--root',
        'twenty',
        '--version',
        '2.46.0',
        '--check',
        '--public-only',
      ]),
      {
        twentyRoot: 'twenty',
        releaseVersion: '2.46.0',
        check: true,
        publicOnly: true,
        older: [],
      },
    );
  });

  it('reads each older version and the Twenty checkout it is built from', () => {
    assert.deepEqual(
      parseArguments([
        '--root',
        'twenty',
        '--version',
        '2.50.1',
        '--older',
        '2.49.0=twenty-2.49.0',
        '--older',
        '2.48.0=twenty-2.48.0',
      ]).older,
      [
        { version: '2.49.0', twentyRoot: 'twenty-2.49.0' },
        { version: '2.48.0', twentyRoot: 'twenty-2.48.0' },
      ],
    );
  });

  it('defaults to this checkout, no release and a full write with the developer pages', () => {
    assert.deepEqual(parseArguments([]), {
      twentyRoot: undefined,
      releaseVersion: undefined,
      check: false,
      publicOnly: false,
      older: [],
    });
  });
});
