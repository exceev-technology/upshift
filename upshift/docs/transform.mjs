import {
  BRAND_COLORS,
  BRAND_NAME,
  CONTACT_LINK,
  DOCS_URL,
  EXCLUDED_PAGE_PREFIXES,
  KEPT_SECTIONS,
  LANGUAGES,
  PRIVACY_POLICY_URL,
  TERMS_URL,
  TWENTY_SOURCE_URL,
  URL_REPLACEMENTS,
  WEBSITE_URL,
} from './rules.mjs';

const ASSET_PREFIXES = ['images/', 'snippets/'];
const CODE_SEGMENT = /(```[\s\S]*?```|`[^`\n]*`)/;
const MARKDOWN_LINK = /\[([^\]]*)\]\((\/[^)\s]*)\)/g;
const CARD_WITH_HREF =
  /<Card\b[^>]*?\bhref="(\/[^"]*)"[^>]*?(?:\/>|>[\s\S]*?<\/Card>)/g;
const EMPTY_CARD_GROUP = /<CardGroup\b[^>]*>\s*<\/CardGroup>\n?/g;
const HREF_ATTRIBUTE = /\bhref="(\/[^"]*)"/g;
const IMAGE_REFERENCE = /\/images\/[^\s)"'`]+/g;
const SNIPPET_IMPORT = /from\s+['"]\/(snippets\/[^'"]+)['"]/g;
const FORBIDDEN_IN_PAGES = ['twenty.com', 'twentyhq'];

export const renamePage = (page) => page.replaceAll('twenty', 'upshift');

export const sitePath = (language, page) =>
  `${language.sitePrefix}${renamePage(page)}`;

const isExcluded = (page) =>
  EXCLUDED_PAGE_PREFIXES.some((prefix) => page.startsWith(prefix));

const isAsset = (relativePath) =>
  ASSET_PREFIXES.some((prefix) => relativePath.startsWith(prefix));

const splitTarget = (target) => {
  const suffixStart = target.search(/[#?]/);
  const pathPart = suffixStart === -1 ? target : target.slice(0, suffixStart);
  const suffix = suffixStart === -1 ? '' : target.slice(suffixStart);

  return [pathPart.replace(/^\/|\/$/g, ''), suffix];
};

const parseTwentyPath = (twentyPath) => {
  const language =
    LANGUAGES.find(
      ({ twentyPrefix }) =>
        twentyPrefix !== '' && twentyPath.startsWith(twentyPrefix),
    ) ?? LANGUAGES.find(({ twentyPrefix }) => twentyPrefix === '');

  return { language, page: twentyPath.slice(language.twentyPrefix.length) };
};

const resolveIn = (language, page, suffix, publishedPages) => {
  const candidates = [
    language,
    ...LANGUAGES.filter((candidate) => candidate !== language),
  ];
  const match = candidates.find((candidate) =>
    publishedPages.get(candidate.language).has(page),
  );

  return match === undefined ? null : `/${sitePath(match, page)}${suffix}`;
};

const resolveLink = (target, publishedPages) => {
  const [twentyPath, suffix] = splitTarget(target);

  if (isAsset(twentyPath)) {
    return target;
  }

  const { language, page } = parseTwentyPath(twentyPath);

  return resolveIn(language, page, suffix, publishedPages);
};

const firstPage = (entry) =>
  typeof entry === 'string'
    ? entry
    : (entry.groups ?? entry.pages)
        .map(firstPage)
        .find((page) => page !== undefined);

export const filterNavigation = (twentyDocsConfig, language) => {
  const twentyTabs =
    twentyDocsConfig.navigation.languages.find(
      ({ language: code }) => code === language.language,
    )?.tabs ?? [];
  const pages = [];

  const filterEntry = (entry) => {
    if (typeof entry === 'string') {
      const page = entry.slice(language.twentyPrefix.length);

      if (isExcluded(page)) {
        return null;
      }

      pages.push(page);

      return sitePath(language, page);
    }

    const children = entry.pages
      .map(filterEntry)
      .filter((child) => child !== null);

    return children.length === 0 ? null : { ...entry, pages: children };
  };

  const tabs = KEPT_SECTIONS.map((section) => {
    const tab = twentyTabs.find((candidate) =>
      firstPage(candidate)?.startsWith(`${language.twentyPrefix}${section}/`),
    );

    if (tab === undefined) {
      throw new Error(
        `Twenty's ${language.language} docs have no tab for ${section}/ pages any more; update KEPT_SECTIONS in upshift/docs/rules.mjs`,
      );
    }

    return {
      ...tab,
      groups: tab.groups.map(filterEntry).filter((group) => group !== null),
    };
  });

  return { tabs, pages };
};

const uniqueBySource = (redirects) => [
  ...new Map(redirects.map((redirect) => [redirect.source, redirect])).values(),
];

export const filterRedirects = (redirects, publishedPages) => {
  const twentyRedirects = redirects.flatMap(({ source, destination }) => {
    const [sourcePath] = splitTarget(source);
    const [destinationPath, suffix] = splitTarget(destination);
    const { language: sourceLanguage, page: sourcePage } =
      parseTwentyPath(sourcePath);
    const { page: destinationPage } = parseTwentyPath(destinationPath);
    const languages =
      sourceLanguage.twentyPrefix === '' ? LANGUAGES : [sourceLanguage];

    return languages.flatMap((language) => {
      const resolved = resolveIn(
        language,
        destinationPage,
        suffix,
        publishedPages,
      );

      return resolved === null
        ? []
        : [
            {
              source: `/${language.sitePrefix}${sourcePage}`,
              destination: resolved,
            },
          ];
    });
  });

  const renameRedirects = LANGUAGES.flatMap((language) =>
    [...publishedPages.get(language.language)]
      .filter((page) => renamePage(page) !== page)
      .map((page) => ({
        source: `/${language.sitePrefix}${page}`,
        destination: `/${sitePath(language, page)}`,
      })),
  );

  return uniqueBySource([...twentyRedirects, ...renameRedirects]);
};
