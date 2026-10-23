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
  repairAnchors,
  replaceTerms,
  sitePath,
} from './transform.mjs';

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

export const buildSite = (
  twentyDocsRoot,
  { appRoot = LAYER_REPOSITORY_ROOT, releaseVersion, publicOnly = false } = {},
) => {
  const readTwenty = (relativePath) =>
    readFileSync(path.join(twentyDocsRoot, relativePath));
  const twentyDocsConfig = JSON.parse(readTwenty('docs.json').toString());
  const navigation = LANGUAGES.map((language) => ({
    language,
    ...filterNavigation(twentyDocsConfig, language),
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

      if (isExcluded(linked.page)) {
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
  const problems = findUnmatchedExclusions(excludedPages);
  const outputs = new Map();

  for (const { language } of navigation) {
    const { outputs: languageOutputs, problems: phraseProblems } =
      applyPhraseReplacements(
        sources.get(language.language),
        PHRASE_REPLACEMENTS[language.language],
      );

    problems.push(
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
  const overrides = new Map(
    listSiteFiles(OVERRIDES_ROOT).map((relativePath) => [
      relativePath,
      readFileSync(path.join(OVERRIDES_ROOT, relativePath)).toString(),
    ]),
  );

  problems.push(...applyOverrides(files, overrides, sitePages));

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
  const readApp = (relativePath) =>
    readFileSync(path.join(appRoot, relativePath), 'utf8');
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

  const [, sourceVersion] =
    readApp(APP_RELEASE_VERSION).match(
      /TWENTY_CURRENT_VERSION = '(\d+\.\d+\.\d+)'/,
    ) ?? [];

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
    `${JSON.stringify(buildDocsConfig(twentyDocsConfig, publishedNavigation, redirects, releaseVersion ?? sourceVersion), null, 2)}\n`,
  );

  problems.push(...auditSite(files, sitePages, privatePages));

  return {
    files,
    problems,
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

  return {
    twentyRoot: valueOf('--root'),
    releaseVersion: valueOf('--version'),
    check: argv.includes('--check'),
    publicOnly: argv.includes('--public-only'),
  };
};

const main = () => {
  const { twentyRoot, releaseVersion, check, publicOnly } = parseArguments(
    process.argv.slice(2),
  );
  const appRoot =
    twentyRoot === undefined ? LAYER_REPOSITORY_ROOT : path.resolve(twentyRoot);
  const { files, problems, summary } = buildSite(
    path.join(appRoot, 'packages/twenty-docs'),
    { appRoot, releaseVersion, publicOnly: publicOnly || !PUBLISH_PRIVATE_SECTIONS },
  );

  if (problems.length > 0) {
    console.error(
      `The docs import failed:\n${problems.map((problem) => `- ${problem}`).join('\n')}\nSee upshift/README.md, "Documentation".`,
    );
    process.exit(1);
  }

  const built = `${summary.pages} pages (${summary.privatePages} behind the docs login), ${summary.images} images, ${summary.snippets} snippets, ${summary.redirects} redirects`;

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
