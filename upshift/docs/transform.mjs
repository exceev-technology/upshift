import {
  BRAND_COLORS,
  BRAND_NAME,
  COMPANY_NAME,
  COMPANY_URL,
  CONTACT_LINK,
  CRM_ALLOWED_CONTEXTS,
  DEMO_URL,
  DOCS_URL,
  EXCLUDED_PAGE_PREFIXES,
  KEPT_SECTIONS,
  LANGUAGES,
  PRIVACY_POLICY_URL,
  SOCIALS,
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
const CRM_WORD = /\bCRMs?\b/;

export const renamePage = (page) => page.replaceAll('twenty', 'upshift');

export const sitePath = (language, page) =>
  `${language.sitePrefix}${renamePage(page)}`;

export const isExcluded = (page) =>
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
  const excludedPages = [];

  const filterEntry = (entry) => {
    if (typeof entry === 'string') {
      const page = entry.slice(language.twentyPrefix.length);

      if (isExcluded(page)) {
        excludedPages.push(page);

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

  return { tabs, pages, excludedPages };
};

const linkTargets = (source) => [
  ...[...source.matchAll(MARKDOWN_LINK)].map((match) => match[2]),
  ...[...source.matchAll(HREF_ATTRIBUTE)].map((match) => match[1]),
];

const isInKeptSection = (page) =>
  KEPT_SECTIONS.some((section) => page.startsWith(`${section}/`));

export const listLinkedPages = (source) =>
  linkTargets(source).flatMap((target) => {
    const [twentyPath] = splitTarget(target);

    if (isAsset(twentyPath)) {
      return [];
    }

    const { language, page } = parseTwentyPath(twentyPath);

    return isInKeptSection(page) ? [{ language, page }] : [];
  });

export const findUnmatchedExclusions = (
  excludedPages,
  prefixes = EXCLUDED_PAGE_PREFIXES,
) =>
  prefixes
    .filter((prefix) => !excludedPages.some((page) => page.startsWith(prefix)))
    .map(
      (prefix) =>
        `rules.mjs excludes ${prefix}, but no Twenty page matches it any more; check where those pages moved`,
    );

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

const withoutCode = (source) =>
  source
    .split(CODE_SEGMENT)
    .filter((segment, index) => index % 2 === 0)
    .join('');

export const replaceTerms = (source, rules) =>
  rules.reduce(
    (output, [pattern, replacement]) =>
      replaceOutsideCode(output, pattern, replacement),
    source,
  );

export const applyOverrides = (files, overrides, sitePages) => {
  const published = new Set(sitePages);
  const problems = [];

  for (const [filePath, content] of overrides) {
    if (published.has(filePath.replace(/\.mdx$/, ''))) {
      files.set(filePath, content);
    } else {
      problems.push(`overrides/${filePath} does not replace any published page`);
    }
  }

  return problems;
};

export const replaceOutsideCode = (source, pattern, replacement) =>
  source
    .split(CODE_SEGMENT)
    .map((segment, index) =>
      index % 2 === 1 ? segment : segment.replace(pattern, replacement),
    )
    .join('');

export const applyPhraseReplacements = (sources, rules) => {
  const outputs = new Map(sources);
  const problems = [];

  for (const { from, to, count } of rules) {
    let found = 0;

    for (const [page, source] of outputs) {
      const parts = source.split(from);

      found += parts.length - 1;
      outputs.set(page, parts.join(to));
    }

    if (found !== count) {
      problems.push(
        `rules.mjs expects ${count} matches of "${from.slice(0, 60)}" in the published pages, found ${found}`,
      );
    }
  }

  return { outputs, problems };
};

export const rebrandPage = (source, publishedPages, brandWord) => {
  let output = source;

  for (const [pattern, replacement] of URL_REPLACEMENTS) {
    output = output.replace(pattern, replacement);
  }

  output = output.replace(CARD_WITH_HREF, (card, target) =>
    resolveLink(target, publishedPages) === null ? '' : card,
  );

  output = output.replace(MARKDOWN_LINK, (link, text, target) => {
    const resolved = resolveLink(target, publishedPages);

    return resolved === null ? text : `[${text}](${resolved})`;
  });

  output = output.replace(HREF_ATTRIBUTE, (attribute, target) => {
    const resolved = resolveLink(target, publishedPages);

    return resolved === null ? attribute : `href="${resolved}"`;
  });

  output = output.replace(EMPTY_CARD_GROUP, '');

  return replaceOutsideCode(output, brandWord, BRAND_NAME);
};

export const collectAssets = (sources) => {
  const images = new Set();
  const snippets = new Set();

  for (const source of sources) {
    for (const [image] of source.matchAll(IMAGE_REFERENCE)) {
      images.add(image.slice(1));
    }

    for (const [, snippet] of source.matchAll(SNIPPET_IMPORT)) {
      snippets.add(snippet);
    }
  }

  return { images: [...images].sort(), snippets: [...snippets].sort() };
};

const buildNavbar = (labels) => ({
  primary: { type: 'button', label: labels.contactUs, href: CONTACT_LINK },
});

const buildFooter = (labels, tabs) => ({
  socials: SOCIALS,
  links: [
    {
      header: labels.product,
      items: [
        { label: labels.website, href: WEBSITE_URL },
        { label: labels.bookDemo, href: DEMO_URL },
      ],
    },
    {
      header: labels.documentation,
      items: tabs.map((tab, index) => ({
        label: labels.sections[index],
        href: `/${firstPage(tab)}`,
      })),
    },
    {
      header: labels.company,
      items: [
        { label: COMPANY_NAME, href: COMPANY_URL },
        { label: labels.contactUs, href: CONTACT_LINK },
      ],
    },
    {
      header: labels.legal,
      items: [
        { label: labels.privacyPolicy, href: PRIVACY_POLICY_URL },
        { label: labels.terms, href: TERMS_URL },
        { label: labels.basedOnTwenty, href: TWENTY_SOURCE_URL },
      ],
    },
  ],
});

export const buildDocsConfig = (twentyDocsConfig, navigation, redirects) => {
  const defaultNavigation = navigation.find(({ language }) => language.isDefault);

  return {
    $schema: twentyDocsConfig.$schema,
    name: `${BRAND_NAME} Documentation`,
    theme: twentyDocsConfig.theme,
    logo: { light: '/logo-light.svg', dark: '/logo-dark.svg' },
    favicon: '/favicon.svg',
    colors: BRAND_COLORS,
    interaction: twentyDocsConfig.interaction,
    navbar: buildNavbar(defaultNavigation.language.labels),
    styling: twentyDocsConfig.styling,
    seo: { metatags: { canonical: DOCS_URL } },
    navigation: {
      languages: navigation.map(({ language, tabs }) => ({
        language: language.language,
        ...(language.isDefault ? { default: true } : {}),
        navbar: buildNavbar(language.labels),
        footer: buildFooter(language.labels, tabs),
        tabs,
      })),
    },
    footer: buildFooter(
      defaultNavigation.language.labels,
      defaultNavigation.tabs,
    ),
    redirects,
  };
};

export const adaptCustomCss = (css) =>
  css
    .split('\n')
    .filter((line) => !line.includes('/developers/'))
    .join('\n')
    .replaceAll("[href='/", "[href$='/");

export const auditSite = (files, sitePages) => {
  const published = new Set(sitePages);
  const problems = sitePages
    .filter((page) => !files.has(`${page}.mdx`))
    .map((page) => `${page} is in the navigation but has no page`);

  for (const [filePath, content] of files) {
    const text = content.toString();

    if (filePath === 'docs.json') {
      if (text.includes('twenty.com')) {
        problems.push('docs.json still references twenty.com');
      }

      continue;
    }

    if (!filePath.endsWith('.mdx')) {
      continue;
    }

    for (const needle of FORBIDDEN_IN_PAGES) {
      if (text.includes(needle)) {
        problems.push(`${filePath} still references ${needle}`);
      }
    }

    for (const line of withoutCode(text).split('\n')) {
      const isAllowed = CRM_ALLOWED_CONTEXTS.some((context) => context.test(line));

      if (CRM_WORD.test(line) && !isAllowed) {
        problems.push(
          `${filePath} presents ${BRAND_NAME} as a CRM: "${line.trim().slice(0, 100)}"`,
        );
      }
    }

    for (const target of linkTargets(text)) {
      const [page] = splitTarget(target);
      const isMissing = isAsset(page) ? !files.has(page) : !published.has(page);

      if (isMissing) {
        problems.push(`${filePath} links to ${target}, which is not published`);
      }
    }
  }

  return problems;
};
