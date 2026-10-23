import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  EXCLUDED_PAGE_PREFIXES,
  LANGUAGES,
  PHRASE_REPLACEMENTS,
  PUBLISH_PRIVATE_SECTIONS,
  TERM_REPLACEMENTS,
} from './rules.mjs';
import {
  adaptCustomCss,
  applyOverrides,
  applyPhraseReplacements,
  auditSite,
  buildDocsConfig,
  buildLocaleRedirects,
  collectAssets,
  filterNavigation,
  filterRedirects,
  findUnmatchedExclusions,
  isExcluded,
  isPrivate,
  listLinkedPages,
  markPublic,
  publicTabs,
  rebrandPage,
  relocateVersion,
  repairAnchors,
  replaceTerms,
  sitePath,
  unlinkMissingPages,
} from './transform.mjs';
import { isRuleForVersion, versionPath } from './versions.mjs';

const DOCS_ROOT = path.dirname(fileURLToPath(import.meta.url));
const LAYER_REPOSITORY_ROOT = path.resolve(DOCS_ROOT, '..', '..');
const BRANDING_ROOT = path.join(LAYER_REPOSITORY_ROOT, 'upshift/branding');
const SITE_ROOT = path.join(DOCS_ROOT, 'site');
const OVERRIDES_ROOT = path.join(DOCS_ROOT, 'overrides');
const APP_DOCUMENTATION_LANGUAGES =
  'packages/twenty-shared/src/constants/DocumentationSupportedLanguages.ts';
const APP_DOCUMENTATION_DEFAULT_LANGUAGE =
  'packages/twenty-shared/src/constants/DocumentationDefaultLanguage.ts';
const APP_RELEASE_VERSION =
  'packages/twenty-server/src/engine/core-modules/upgrade/constants/twenty-current-version.constant.ts';

export const TWENTY_DOCS_ROOT = path.join(
  LAYER_REPOSITORY_ROOT,
  'packages/twenty-docs',
);

export const readOverrides = () =>
  new Map(
    listSiteFiles(OVERRIDES_ROOT).map((relativePath) => [
      relativePath,
      readFileSync(path.join(OVERRIDES_ROOT, relativePath)).toString(),
    ]),
  );

export const buildSite = (
  twentyDocsRoot,
  {
    appRoot = LAYER_REPOSITORY_ROOT,
    releaseVersion,
    publicOnly = false,
    historical = false,
    phraseReplacements = PHRASE_REPLACEMENTS,
    excludedPagePrefixes = EXCLUDED_PAGE_PREFIXES,
    overrides = readOverrides(),
  } = {},
) => {
  const readTwenty = (relativePath) =>
    readFileSync(path.join(twentyDocsRoot, relativePath));
  const readApp = (relativePath) =>
    readFileSync(path.join(appRoot, relativePath), 'utf8');
  const [, sourceVersion] =
    readApp(APP_RELEASE_VERSION).match(
      /TWENTY_CURRENT_VERSION = '(\d+\.\d+\.\d+)'/,
    ) ?? [];
  const documentedVersion = releaseVersion ?? sourceVersion;
  const isForThisVersion = (rule) =>
    documentedVersion === undefined || isRuleForVersion(rule, documentedVersion);
  const exclusions = excludedPagePrefixes.filter(isForThisVersion);
  const twentyDocsConfig = JSON.parse(readTwenty('docs.json').toString());
  const navigation = LANGUAGES.map((language) => ({
    language,
    ...filterNavigation(twentyDocsConfig, language, { exclusions, historical }),
  }));
  const publishedPages = new Map(
    navigation.map(({ language, pages }) => [language.language, new Set(pages)]),
  );
  const excludedPages = navigation.flatMap(
    ({ excludedPages: excluded }) => excluded,
  );
  const sources = new Map(LANGUAGES.map(({ language }) => [language, new Map()]));
  const queue = navigation.flatMap(({ language, pages }) =>
    pages.map((page) => ({ language, page })),
  );

  // Twenty links to some pages it keeps out of its navigation. They are
  // published too, without a navigation entry, so those links keep working.
  while (queue.length > 0) {
    const { language, page } = queue.shift();
    const source = readTwenty(`${language.twentyPrefix}${page}.mdx`).toString();

    sources.get(language.language).set(page, source);

    for (const linked of listLinkedPages(source)) {
      const known = publishedPages.get(linked.language.language);

      if (known.has(linked.page)) {
        continue;
      }

      if (isExcluded(linked.page, exclusions)) {
        excludedPages.push(linked.page);
        continue;
      }

      if (
        existsSync(
          path.join(
            twentyDocsRoot,
            `${linked.language.twentyPrefix}${linked.page}.mdx`,
          ),
        )
      ) {
        known.add(linked.page);
        queue.push(linked);
      }
    }
  }

  const files = new Map();
  const problems = [];
  const warnings = [];
  // An older version's sources never change, so a phrase or override that
  // stopped matching them only warns. Exclusions always fail: an unmatched one
  // may mean a renamed billing or legal page is being published.
  const ruleProblems = historical ? warnings : problems;
  const outputs = new Map();

  problems.push(...findUnmatchedExclusions(excludedPages, exclusions));
  warnings.push(
    ...navigation.flatMap(({ language, missingSections }) =>
      missingSections.map(
        (section) => `${language.language}: no ${section}/ tab, published without it`,
      ),
    ),
  );

  for (const { language } of navigation) {
    const { outputs: languageOutputs, problems: phraseProblems } =
      applyPhraseReplacements(
        sources.get(language.language),
        phraseReplacements[language.language].filter(isForThisVersion),
      );

    ruleProblems.push(
      ...phraseProblems.map((problem) => `${language.language}: ${problem}`),
    );
    outputs.set(language.language, languageOutputs);
  }

  // The developer pages still go through the rules, so a Twenty change that
  // breaks one fails this build too.
  if (publicOnly) {
    for (const { language } of navigation) {
      for (const page of publishedPages.get(language.language)) {
        if (isPrivate(page)) {
          publishedPages.get(language.language).delete(page);
          outputs.get(language.language).delete(page);
        }
      }
    }
  }

  for (const { language } of navigation) {
    for (const [page, source] of outputs.get(language.language)) {
      files.set(
        `${sitePath(language, page)}.mdx`,
        replaceTerms(
          rebrandPage(source, publishedPages, language.brandWord),
          TERM_REPLACEMENTS[language.language],
        ),
      );
    }
  }

  const sitePages = LANGUAGES.flatMap((language) =>
    [...publishedPages.get(language.language)].map((page) =>
      sitePath(language, page),
    ),
  );
  const privatePages = new Set(
    LANGUAGES.flatMap((language) =>
      [...publishedPages.get(language.language)]
        .filter(isPrivate)
        .map((page) => sitePath(language, page)),
    ),
  );
  ruleProblems.push(...applyOverrides(files, overrides, sitePages));

  if (historical) {
    for (const filePath of overrides.keys()) {
      const source = files.get(filePath)?.toString();
      const unlinked = source && unlinkMissingPages(source, sitePages);

      if (unlinked !== source) {
        files.set(filePath, unlinked);
        warnings.push(
          `overrides/${filePath} links to pages this version does not publish; they are plain text`,
        );
      }
    }
  }

  for (const page of sitePages) {
    if (!privatePages.has(page) && files.has(`${page}.mdx`)) {
      files.set(`${page}.mdx`, markPublic(files.get(`${page}.mdx`)));
    }
  }

  repairAnchors(files);

  const { snippets } = collectAssets([...files.values()]);

  for (const snippet of snippets) {
    if (!files.has(snippet)) {
      files.set(snippet, readTwenty(snippet).toString());
    }
  }

  const { images } = collectAssets([...files.values()]);

  for (const image of images) {
    if (existsSync(path.join(twentyDocsRoot, image))) {
      files.set(image, readTwenty(image));
    } else {
      problems.push(`${image} is referenced but missing from packages/twenty-docs`);
    }
  }

  const readBranding = (fileName) =>
    readFileSync(path.join(BRANDING_ROOT, fileName));
  const appLanguages = [
    ...readApp(APP_DOCUMENTATION_LANGUAGES).matchAll(/'([a-z]{2})'/g),
  ].map(([, code]) => code);
  const [, appDefaultLanguage] =
    readApp(APP_DOCUMENTATION_DEFAULT_LANGUAGE).match(/'([a-z]{2})'/) ?? [];

  if (appLanguages.length === 0 || appDefaultLanguage === undefined) {
    problems.push(
      `cannot read the app's documentation languages from ${APP_DOCUMENTATION_LANGUAGES}`,
    );
  }

  // Twenty bumps this constant only for minor releases, so twenty/v2.50.1 still carries 2.50.0
  const releaseMinorVersion = releaseVersion?.replace(/\.\d+$/, '.0');

  if (sourceVersion === undefined) {
    problems.push(
      `cannot read the release version from ${APP_RELEASE_VERSION}`,
    );
  } else if (
    releaseVersion !== undefined &&
    sourceVersion !== releaseVersion &&
    sourceVersion !== releaseMinorVersion
  ) {
    problems.push(
      `the docs are built for Upshift v${releaseVersion} but the sources carry ${sourceVersion}`,
    );
  }

  const publishedNavigation = publicOnly
    ? navigation.map((entry) => ({
        ...entry,
        tabs: publicTabs(entry.language, entry.tabs),
      }))
    : navigation;
  const redirects = [
    ...filterRedirects(twentyDocsConfig.redirects, publishedPages),
    ...buildLocaleRedirects(appLanguages, appDefaultLanguage),
  ];

  files.set(
    'custom.css',
    `${adaptCustomCss(readTwenty('custom.css').toString())}\n${readFileSync(path.join(DOCS_ROOT, 'upshift.css'))}`,
  );
  files.set('logo-light.svg', readBranding('wordmark.svg'));
  files.set('logo-dark.svg', readBranding('wordmark-dark.svg'));
  files.set('favicon.svg', readBranding('logo.svg'));
  files.set('booking.js', readFileSync(path.join(DOCS_ROOT, 'booking.js')));
  files.set(
    'docs.json',
    `${JSON.stringify(buildDocsConfig(twentyDocsConfig, publishedNavigation, redirects, documentedVersion), null, 2)}\n`,
  );

  problems.push(...auditSite(files, sitePages, privatePages));

  return {
    files,
    problems,
    warnings,
    sitePages,
    privatePages,
    summary: {
      pages: LANGUAGES.map(
        ({ language }) => `${publishedPages.get(language).size} ${language}`,
      ).join(' + '),
      images: images.length,
      snippets: snippets.length,
      redirects: redirects.length,
      privatePages: privatePages.size,
    },
  };
};

const tabsByLanguage = (files) =>
  new Map(
    JSON.parse(files.get('docs.json')).navigation.languages.map(
      ({ language, versions }) => [language, versions[0].tabs],
    ),
  );

// The latest version keeps the root, so links from the app and from search
// engines keep working; each older version moves under /vX.Y/.
export const mergeVersions = (latest, olderBuilds) => {
  const files = new Map(latest.files);
  const sitePages = [...latest.sitePages];
  const privatePages = new Set(latest.privatePages);
  const olderVersions = olderBuilds.map((build) => {
    const relocated = relocateVersion(
      { ...build, tabsByLanguage: tabsByLanguage(build.files) },
      versionPath(build.version),
      latest.files,
    );

    for (const [filePath, content] of relocated.files) {
      files.set(filePath, content);
    }

    sitePages.push(...relocated.sitePages);
    relocated.privatePages.forEach((page) => privatePages.add(page));

    return {
      version: `v${build.version}`,
      tabsByLanguage: relocated.tabsByLanguage,
    };
  });
  const docsConfig = JSON.parse(latest.files.get('docs.json'));

  files.set(
    'docs.json',
    `${JSON.stringify(
      {
        ...docsConfig,
        navigation: {
          ...docsConfig.navigation,
          languages: docsConfig.navigation.languages.map((entry) => ({
            ...entry,
            versions: [
              ...entry.versions,
              ...olderVersions.map(({ version, tabsByLanguage: tabs }) => ({
                version,
                tabs: tabs.get(entry.language),
              })),
            ],
          })),
        },
      },
      null,
      2,
    )}\n`,
  );

  return { files, problems: auditSite(files, sitePages, privatePages) };
};

const listSiteFiles = (directory, prefix = '') =>
  existsSync(directory)
    ? readdirSync(directory)
        .filter((entry) => !entry.startsWith('.'))
        .flatMap((entry) => {
          const entryPath = path.join(directory, entry);
          const relativePath = prefix === '' ? entry : `${prefix}/${entry}`;

          return statSync(entryPath).isDirectory()
            ? listSiteFiles(entryPath, relativePath)
            : [relativePath];
        })
    : [];

const writeSite = (files, siteRoot) => {
  rmSync(siteRoot, { recursive: true, force: true });

  for (const [relativePath, content] of files) {
    const target = path.join(siteRoot, relativePath);

    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
};

export const parseArguments = (argv) => {
  const valueOf = (flag) => {
    const index = argv.indexOf(flag);

    return index === -1 ? undefined : argv[index + 1];
  };

  const valuesOf = (flag) =>
    argv.flatMap((argument, index) => (argument === flag ? [argv[index + 1]] : []));

  return {
    twentyRoot: valueOf('--root'),
    releaseVersion: valueOf('--version'),
    check: argv.includes('--check'),
    publicOnly: argv.includes('--public-only'),
    older: valuesOf('--older').map((value) => {
      const [version, ...rootParts] = value.split('=');

      return { version, twentyRoot: rootParts.join('=') };
    }),
  };
};

const exitOnProblems = (problems) => {
  if (problems.length > 0) {
    console.error(
      `The docs import failed:\n${problems.map((problem) => `- ${problem}`).join('\n')}\nSee upshift/README.md, "Documentation".`,
    );
    process.exit(1);
  }
};

const main = () => {
  const { twentyRoot, releaseVersion, check, publicOnly, older } =
    parseArguments(process.argv.slice(2));
  const build = (root, version, historical) => {
    const appRoot =
      root === undefined ? LAYER_REPOSITORY_ROOT : path.resolve(root);

    return buildSite(path.join(appRoot, 'packages/twenty-docs'), {
      appRoot,
      releaseVersion: version,
      publicOnly: publicOnly || !PUBLISH_PRIVATE_SECTIONS,
      historical,
    });
  };
  const latest = build(twentyRoot, releaseVersion, false);
  const olderBuilds = older.map(({ version, twentyRoot: olderRoot }) => ({
    version,
    ...build(olderRoot, version, true),
  }));
  const warnings = olderBuilds.flatMap(({ version, warnings: olderWarnings }) =>
    olderWarnings.map((warning) => `v${version}: ${warning}`),
  );

  if (warnings.length > 0) {
    console.warn(
      `Rules that no longer match an older version (its pages are published without them):\n${warnings.map((warning) => `- ${warning}`).join('\n')}`,
    );
  }

  exitOnProblems([
    ...latest.problems,
    ...olderBuilds.flatMap(({ version, problems }) =>
      problems.map((problem) => `v${version}: ${problem}`),
    ),
  ]);

  const { files, problems } =
    olderBuilds.length === 0 ? latest : mergeVersions(latest, olderBuilds);

  exitOnProblems(problems);

  const { summary } = latest;
  const versions =
    olderBuilds.length === 0
      ? ''
      : `, plus ${olderBuilds.length} older versions (${olderBuilds.map(({ version }) => `v${version}`).join(', ')})`;
  const built = `${summary.pages} pages (${summary.privatePages} behind the docs login), ${summary.images} images, ${summary.snippets} snippets, ${summary.redirects} redirects${versions}`;

  if (check) {
    console.log(`The docs import works: ${built}.`);

    return;
  }

  writeSite(files, SITE_ROOT);
  console.log(`Wrote upshift/docs/site: ${built}.`);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
