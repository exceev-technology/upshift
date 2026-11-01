import {
  BRAND_COLORS,
  BRAND_NAME,
  CODE_BRAND_WORD,
  COMPANY_NAME,
  COMPANY_URL,
  CRM_ALLOWED_CONTEXTS,
  DEMO_PAGE_URL,
  DEMO_URL,
  DOCS_URL,
  EXCLUDED_PAGE_PREFIXES,
  FORBIDDEN_IN_PAGES,
  KEPT_SECTIONS,
  LANGUAGES,
  LOCALE_FALLBACK,
  PRIVACY_POLICY_URL,
  PRIVATE_SECTIONS,
  SOCIALS,
  TERMS_URL,
  TWENTY_SOURCE_URL,
  URL_REPLACEMENTS,
  WEBSITE_URL,
} from './rules.mjs';

const ASSET_PREFIXES = ['images/', 'snippets/'];
const STYLE_ASSET_URL = /url\(\s*['"]?\/((?:fonts|images)\/[^'")\s]+)/g;
const CODE_SEGMENT = /(```[\s\S]*?```|`[^`\n]*`)/;
const MARKDOWN_LINK = /\[([^\]]*)\]\((\/[^)\s]*)\)/g;
const CARD_WITH_HREF =
  /<Card\b[^>]*?\bhref="(\/[^"]*)"[^>]*?(?:\/>|>[\s\S]*?<\/Card>)/g;
const LANDING_BUTTON_WITH_HREF =
  /<LandingButton\b[^>]*?\bhref="(\/[^"]*)"[^>]*>[\s\S]*?<\/LandingButton>/g;
const EMPTY_CARD_GROUP = /<CardGroup\b[^>]*>\s*<\/CardGroup>\n?/g;
const HREF_ATTRIBUTE = /\bhref="(\/[^"]*)"/g;
const IMAGE_REFERENCE = /\/images\/[^\s)"'`]+/g;
const SNIPPET_IMPORT = /from\s+['"]\/(snippets\/[^'"]+)['"]/g;
const CRM_WORD = /\bCRMs?\b/;
const FRONTMATTER = /^---\n[\s\S]*?\n---\n/;
const HEADING_LINE = /^#{1,6}\s+(.+?)\s*$/gm;
const COMPONENT_TITLE = /\btitle="([^"]+)"/g;
const ID_ATTRIBUTE = /\bid="([^"]+)"/g;
const MARKDOWN_ANCHOR_LINK = /\[([^\]]*)\]\(((?:\/[^)#\s]*)?)#([^)\s]+)\)/g;
const HREF_ANCHOR = /\bhref="((?:\/[^"#\s]*)?)#([^"\s]+)"/g;
const PUBLIC_FLAG = /^public: true$/m;
const VERSION_FOLDER = /^v\d+\.\d+\//;

export const renamePage = (page) => page.replaceAll('twenty', 'upshift');

export const sitePath = (language, page) =>
  `${language.sitePrefix}${renamePage(page)}`;

const exclusionPrefix = (exclusion) =>
  typeof exclusion === 'string' ? exclusion : exclusion.prefix;

export const isExcluded = (page, exclusions = EXCLUDED_PAGE_PREFIXES) =>
  exclusions.some((exclusion) => page.startsWith(exclusionPrefix(exclusion)));

export const isPrivate = (page) =>
  PRIVATE_SECTIONS.some((section) => page.startsWith(`${section}/`));

export const markPublic = (source) =>
  source.replace(/^---\n/, '---\npublic: true\n');

const isAsset = (relativePath) =>
  ASSET_PREFIXES.some((prefix) => relativePath.startsWith(prefix));

const isSnippet = (relativePath) => relativePath.startsWith('snippets/');

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
    : [entry.root, ...(entry.groups ?? entry.pages)]
        .filter((child) => child !== undefined)
        .map(firstPage)
        .find((page) => page !== undefined);

export const filterNavigation = (
  twentyDocsConfig,
  language,
  { exclusions = EXCLUDED_PAGE_PREFIXES, historical = false } = {},
) => {
  const twentyTabs =
    twentyDocsConfig.navigation.languages.find(
      ({ language: code }) => code === language.language,
    )?.tabs ?? [];
  const pages = [];
  const excludedPages = [];
  const missingSections = [];

  const filterEntry = (entry) => {
    if (typeof entry === 'string') {
      const page = entry.slice(language.twentyPrefix.length);

      if (isExcluded(page, exclusions)) {
        excludedPages.push(page);

        return null;
      }

      pages.push(page);

      return sitePath(language, page);
    }

    // Twenty puts a section's overview page in its group's `root`
    const { root, ...group } = entry;
    const filteredRoot = root === undefined ? null : filterEntry(root);
    const children = entry.pages
      .map(filterEntry)
      .filter((child) => child !== null);

    if (children.length === 0 && filteredRoot === null) {
      return null;
    }

    return filteredRoot === null
      ? { ...group, pages: children }
      : { ...group, root: filteredRoot, pages: children };
  };

  const tabs = KEPT_SECTIONS.flatMap((section) => {
    const tab = twentyTabs.find((candidate) =>
      firstPage(candidate)?.startsWith(`${language.twentyPrefix}${section}/`),
    );

    // An older version that predates a kept section is published without it
    if (tab === undefined && historical) {
      missingSections.push(section);

      return [];
    }

    if (tab === undefined) {
      throw new Error(
        `Twenty's ${language.language} docs have no tab for ${section}/ pages any more; update KEPT_SECTIONS in upshift/docs/rules.mjs`,
      );
    }

    const groups = tab.groups
      .map(filterEntry)
      .filter((group) => group !== null);

    // Mintlify builds the navigation of signed-out readers from the groups
    // marked public; a page's own `public: true` only opens the page.
    return [
      {
        ...tab,
        groups: PRIVATE_SECTIONS.includes(section)
          ? groups
          : groups.map((group) => ({ ...group, public: true })),
      },
    ];
  });

  return { tabs, pages, excludedPages, missingSections };
};

export const publicTabs = (language, tabs) =>
  tabs.filter(
    (tab) => !isPrivate(firstPage(tab).slice(language.sitePrefix.length)),
  );

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
  exclusions = EXCLUDED_PAGE_PREFIXES,
) =>
  exclusions
    .map(exclusionPrefix)
    .filter((prefix) => !excludedPages.some((page) => page.startsWith(prefix)))
    .map(
      (prefix) =>
        `rules.mjs excludes ${prefix}, but no Twenty page matches it any more; check where those pages moved`,
    );

export const buildLocaleRedirects = (appLanguages, appDefaultLanguage) =>
  appLanguages
    .filter((code) => code !== appDefaultLanguage)
    .map((code) => {
      const language =
        LANGUAGES.find(({ language: published }) => published === code) ??
        LANGUAGES.find(({ language: published }) => published === LOCALE_FALLBACK);

      return {
        source: `/${code}/:slug*`,
        destination: `/${language.sitePrefix}:slug*`,
      };
    });

// The app links to Twenty's paths in its own language, including pages Twenty
// has not translated yet.
export const buildUntranslatedRedirects = (publishedPages) =>
  LANGUAGES.flatMap((language) => {
    const translated = publishedPages.get(language.language);
    const untranslated = new Set(
      LANGUAGES.flatMap((other) => [...publishedPages.get(other.language)]).filter(
        (page) => !translated.has(page),
      ),
    );

    return [...untranslated].flatMap((page) => {
      const destination = resolveIn(language, page, '', publishedPages);

      return [...new Set([page, renamePage(page)])].map((sourcePage) => ({
        source: `/${language.sitePrefix}${sourcePage}`,
        destination,
      }));
    });
  });

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
    if (isSnippet(filePath) || published.has(filePath.replace(/\.mdx$/, ''))) {
      files.set(filePath, content);
    } else {
      problems.push(`overrides/${filePath} does not replace any published page`);
    }
  }

  const { snippets } = collectAssets([...files.values()]);

  for (const filePath of overrides.keys()) {
    if (isSnippet(filePath) && !snippets.includes(filePath)) {
      problems.push(`overrides/${filePath} is not imported by any page`);
    }
  }

  return problems;
};

// rebrandPage turns Twenty's links to unpublished pages into text; an older
// version gets the same for links in Upshift's overrides.
export const unlinkMissingPages = (source, sitePages) => {
  const published = new Set(sitePages);
  const isMissingPage = (target) => {
    const [page] = splitTarget(target);

    return page !== '' && !isAsset(page) && !published.has(page);
  };

  return source
    .replace(MARKDOWN_LINK, (link, text, target) =>
      isMissingPage(target) ? text : link,
    )
    .replace(HREF_ATTRIBUTE, (attribute, target) =>
      isMissingPage(target) ? '' : attribute,
    );
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

  output = output.replace(LANDING_BUTTON_WITH_HREF, (button, target) =>
    resolveLink(target, publishedPages) === null ? '' : button,
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

  return output
    .split(CODE_SEGMENT)
    .map((segment, index) =>
      segment.replace(index % 2 === 1 ? CODE_BRAND_WORD : brandWord, BRAND_NAME),
    )
    .join('');
};

// The anchor Mintlify derives from a heading, like github-slugger.
const headingAnchor = (heading) =>
  heading
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '')
    .trim()
    .replace(/\s/g, '-');

const decodeFragment = (fragment) => {
  try {
    return decodeURIComponent(fragment);
  } catch {
    return fragment;
  }
};

// Renaming the brand in a heading changes its anchor, so links to the old
// anchor follow it. Twenty's translations keep the English anchors of
// translated headings; links to an anchor their page does not have drop it
// and open the page, or become plain text on the same page.
export const repairAnchors = (files) => {
  const brandSlug = BRAND_NAME.toLowerCase();
  const pages = [...files.keys()].filter((filePath) => filePath.endsWith('.mdx'));
  const anchors = new Map(
    pages.map((filePath) => {
      const text = files.get(filePath).toString();

      return [
        filePath.replace(/\.mdx$/, ''),
        new Set([
          ...[...text.matchAll(HEADING_LINE), ...text.matchAll(COMPONENT_TITLE)].map(
            ([, heading]) => headingAnchor(heading),
          ),
          ...[...text.matchAll(ID_ATTRIBUTE)].map(([, id]) => id),
        ]),
      ];
    }),
  );

  for (const filePath of pages) {
    const page = filePath.replace(/\.mdx$/, '');
    const repair = (target, fragment) => {
      const targetAnchors = anchors.get(
        target === '' ? page : target.replace(/^\/|\/$/g, ''),
      );
      const anchor = decodeFragment(fragment);

      if (targetAnchors === undefined || targetAnchors.has(anchor)) {
        return `#${fragment}`;
      }

      const renamed = anchor.replaceAll('twenty', brandSlug);

      return targetAnchors.has(renamed) ? `#${renamed}` : '';
    };

    files.set(
      filePath,
      files
        .get(filePath)
        .toString()
        .replace(MARKDOWN_ANCHOR_LINK, (link, text, target, fragment) => {
          const anchor = repair(target, fragment);

          return target === '' && anchor === ''
            ? text
            : `[${text}](${target}${anchor})`;
        })
        .replace(HREF_ANCHOR, (attribute, target, fragment) => {
          const anchor = repair(target, fragment);

          return target === '' && anchor === ''
            ? attribute
            : `href="${target}${anchor}"`;
        }),
    );
  }
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

export const collectStyleAssets = (css) =>
  [...new Set([...css.matchAll(STYLE_ASSET_URL)].map(([, asset]) => asset))].sort();

const isSameContent = (content, otherContent) =>
  otherContent !== undefined &&
  Buffer.from(content).equals(Buffer.from(otherContent));

const prefixNavigation = (entry, prefix) =>
  typeof entry === 'string'
    ? `${prefix}/${entry}`
    : Object.fromEntries(
        Object.entries(entry).map(([key, value]) => [
          key,
          key === 'groups' || key === 'pages'
            ? value.map((child) => prefixNavigation(child, prefix))
            : key === 'root'
              ? prefixNavigation(value, prefix)
              : value,
        ]),
      );

const markNoindex = (source) =>
  FRONTMATTER.test(source)
    ? source.replace(/^---\n/, '---\nnoindex: true\n')
    : `---\nnoindex: true\n---\n\n${source}`;

// An older version is built like the latest one, then moved under its folder.
// Assets it shares byte for byte with the latest version stay at the root,
// unless they link to one of its pages or use an asset it keeps.
export const relocateVersion = (
  { files, sitePages, privatePages, tabsByLanguage },
  prefix,
  latestFiles,
) => {
  const pages = new Set(sitePages);
  const movedPath = (asset) =>
    isSnippet(asset)
      ? `snippets/${prefix}/${asset.slice('snippets/'.length)}`
      : `${prefix}/${asset}`;
  const linksToVersionPage = (source) =>
    linkTargets(source).some((target) => pages.has(splitTarget(target)[0]));
  const movedAssets = new Set(
    [...files.keys()].filter(
      (filePath) =>
        isAsset(filePath) &&
        (!isSameContent(files.get(filePath), latestFiles.get(filePath)) ||
          (isSnippet(filePath) &&
            linksToVersionPage(files.get(filePath).toString()))),
    ),
  );
  const snippetDependencies = [...files.keys()]
    .filter(isSnippet)
    .map((snippet) => {
      const { images, snippets } = collectAssets([files.get(snippet).toString()]);

      return [snippet, [...images, ...snippets]];
    });
  let hasMovedMore = true;

  // A shared snippet would show the latest copy of what it uses
  while (hasMovedMore) {
    hasMovedMore = false;

    for (const [snippet, dependencies] of snippetDependencies) {
      if (
        !movedAssets.has(snippet) &&
        dependencies.some((dependency) => movedAssets.has(dependency))
      ) {
        movedAssets.add(snippet);
        hasMovedMore = true;
      }
    }
  }
  const prefixTarget = (target) => {
    const [page, suffix] = splitTarget(target);

    return pages.has(page) ? `/${prefix}/${page}${suffix}` : target;
  };
  const pointAtVersion = (source) =>
    source
      .replace(MARKDOWN_LINK, (link, text, target) => `[${text}](${prefixTarget(target)})`)
      .replace(HREF_ATTRIBUTE, (attribute, target) => `href="${prefixTarget(target)}"`)
      .replace(IMAGE_REFERENCE, (reference) =>
        movedAssets.has(reference.slice(1))
          ? `/${movedPath(reference.slice(1))}`
          : reference,
      )
      .replace(SNIPPET_IMPORT, (statement, snippet) =>
        movedAssets.has(snippet)
          ? statement.replace(`/${snippet}`, `/${movedPath(snippet)}`)
          : statement,
      );
  const relocatedFiles = new Map();

  for (const [filePath, content] of files) {
    if (filePath.endsWith('.mdx') && pages.has(filePath.replace(/\.mdx$/, ''))) {
      relocatedFiles.set(
        `${prefix}/${filePath}`,
        markNoindex(pointAtVersion(content.toString())),
      );
    } else if (movedAssets.has(filePath)) {
      relocatedFiles.set(
        movedPath(filePath),
        isSnippet(filePath) ? pointAtVersion(content.toString()) : content,
      );
    }
  }

  return {
    files: relocatedFiles,
    sitePages: sitePages.map((page) => `${prefix}/${page}`),
    privatePages: [...privatePages].map((page) => `${prefix}/${page}`),
    tabsByLanguage: new Map(
      [...tabsByLanguage].map(([language, tabs]) => [
        language,
        tabs.map((tab) => prefixNavigation(tab, prefix)),
      ]),
    ),
  };
};

const buildNavbar = (labels) => ({
  primary: { type: 'button', label: labels.contactUs, href: DEMO_URL },
});

const buildFooter = (labels, tabs) => ({
  socials: SOCIALS,
  links: [
    {
      header: labels.product,
      items: [
        { label: labels.website, href: WEBSITE_URL },
        { label: labels.watchDemo, href: DEMO_PAGE_URL },
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
        { label: labels.contactUs, href: DEMO_URL },
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

export const buildDocsConfig = (
  twentyDocsConfig,
  navigation,
  redirects,
  releaseVersion,
) => {
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
        footer: buildFooter(language.labels, publicTabs(language, tabs)),
        versions: [{ version: `v${releaseVersion}`, default: true, tabs }],
      })),
    },
    footer: buildFooter(
      defaultNavigation.language.labels,
      publicTabs(defaultNavigation.language, defaultNavigation.tabs),
    ),
    redirects,
  };
};

export const adaptCustomCss = (css) => css.replaceAll("[href='/", "[href$='/");

export const auditSite = (files, sitePages, privatePages = new Set()) => {
  const published = new Set(sitePages);
  const problems = sitePages
    .filter((page) => !files.has(`${page}.mdx`))
    .map((page) => `${page} is in the navigation but has no page`);

  for (const page of sitePages.filter((sitePage) => files.has(`${sitePage}.mdx`))) {
    const [frontmatter = ''] =
      files.get(`${page}.mdx`).toString().match(FRONTMATTER) ?? [];
    const isMarkedPublic = PUBLIC_FLAG.test(frontmatter);

    if (privatePages.has(page) && isMarkedPublic) {
      problems.push(`${page} says public: true, so it would not need the docs login`);
    }

    if (!privatePages.has(page) && !isMarkedPublic) {
      problems.push(`${page} does not say public: true, so the docs login would hide it`);
    }
  }

  for (const [filePath, content] of files) {
    const text = content.toString();

    if (filePath === 'docs.json') {
      if (text.includes('twenty.com')) {
        problems.push('docs.json still references twenty.com');
      }

      continue;
    }

    if (!/\.(mdx|jsx?)$/.test(filePath)) {
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
      const isMissing = isAsset(page.replace(VERSION_FOLDER, ''))
        ? !files.has(page)
        : !published.has(page);

      if (isMissing) {
        problems.push(`${filePath} links to ${target}, which is not published`);
      }
    }
  }

  return problems;
};
