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

import { LANGUAGES, PHRASE_REPLACEMENTS } from './rules.mjs';
import {
  adaptCustomCss,
  applyPhraseReplacements,
  auditSite,
  buildDocsConfig,
  collectAssets,
  filterNavigation,
  filterRedirects,
  findUnmatchedExclusions,
  isExcluded,
  listLinkedPages,
  rebrandPage,
  sitePath,
} from './transform.mjs';

const DOCS_ROOT = path.dirname(fileURLToPath(import.meta.url));
const LAYER_REPOSITORY_ROOT = path.resolve(DOCS_ROOT, '..', '..');
const BRANDING_ROOT = path.join(LAYER_REPOSITORY_ROOT, 'upshift/branding');
const SITE_ROOT = path.join(DOCS_ROOT, 'site');

export const TWENTY_DOCS_ROOT = path.join(
  LAYER_REPOSITORY_ROOT,
  'packages/twenty-docs',
);

export const buildSite = (twentyDocsRoot) => {
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

  for (const { language } of navigation) {
    const { outputs, problems: phraseProblems } = applyPhraseReplacements(
      sources.get(language.language),
      PHRASE_REPLACEMENTS[language.language],
    );

    problems.push(
      ...phraseProblems.map((problem) => `${language.language}: ${problem}`),
    );

    for (const [page, source] of outputs) {
      files.set(
        `${sitePath(language, page)}.mdx`,
        rebrandPage(source, publishedPages, language.brandWord),
      );
    }
  }

  const { snippets } = collectAssets([...files.values()]);

  for (const snippet of snippets) {
    files.set(snippet, readTwenty(snippet).toString());
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
  const redirects = filterRedirects(twentyDocsConfig.redirects, publishedPages);

  files.set(
    'custom.css',
    `${adaptCustomCss(readTwenty('custom.css').toString())}\n${readFileSync(path.join(DOCS_ROOT, 'upshift.css'))}`,
  );
  files.set('logo-light.svg', readBranding('wordmark.svg'));
  files.set('logo-dark.svg', readBranding('wordmark-dark.svg'));
  files.set('favicon.svg', readBranding('logo.svg'));
  files.set(
    'docs.json',
    `${JSON.stringify(buildDocsConfig(twentyDocsConfig, navigation, redirects), null, 2)}\n`,
  );

  problems.push(
    ...auditSite(
      files,
      LANGUAGES.flatMap((language) =>
        [...publishedPages.get(language.language)].map((page) =>
          sitePath(language, page),
        ),
      ),
    ),
  );

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

export const findDrift = (files, siteRoot) => {
  const existing = new Set(listSiteFiles(siteRoot));

  const changed = [...files]
    .filter(
      ([relativePath, content]) =>
        !existing.has(relativePath) ||
        !readFileSync(path.join(siteRoot, relativePath)).equals(
          Buffer.from(content),
        ),
    )
    .map(([relativePath]) => relativePath);

  const extra = [...existing].filter((relativePath) => !files.has(relativePath));

  return { changed, extra };
};

const writeSite = (files, siteRoot) => {
  rmSync(siteRoot, { recursive: true, force: true });

  for (const [relativePath, content] of files) {
    const target = path.join(siteRoot, relativePath);

    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
};

const main = () => {
  const { files, problems, summary } = buildSite(TWENTY_DOCS_ROOT);

  if (problems.length > 0) {
    console.error(
      `The docs import failed:\n${problems.map((problem) => `- ${problem}`).join('\n')}\nSee upshift/README.md, "Documentation".`,
    );
    process.exit(1);
  }

  if (process.argv.includes('--check')) {
    const { changed, extra } = findDrift(files, SITE_ROOT);

    if (changed.length > 0 || extra.length > 0) {
      console.error(
        `upshift/docs/site is out of date (${changed.length} changed or missing, ${extra.length} extra). Run node upshift/docs/import-docs.mjs and commit the result.`,
      );
      process.exit(1);
    }

    console.log('upshift/docs/site matches packages/twenty-docs.');

    return;
  }

  writeSite(files, SITE_ROOT);
  console.log(
    `Wrote upshift/docs/site: ${summary.pages} pages, ${summary.images} images, ${summary.snippets} snippets, ${summary.redirects} redirects.`,
  );
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
