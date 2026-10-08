# Upshift Docs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish Upshift-branded user documentation (Getting Started and User Guide, french(default) & English) at https://docs.upshiftcloud.com with Mintlify, built from Twenty's docs into its own folder, without editing `packages/twenty-docs`.

**Architecture:** `upshift/docs/import-docs.mjs` reads `packages/twenty-docs`, keeps two tabs, applies the rules in `upshift/docs/rules.mjs` (excluded pages, sentence rewrites, URL rewrites, "Twenty" to "Upshift"), and writes a complete Mintlify site to `upshift/docs/site/`. That folder is committed and Mintlify deploys it from `upshift-main`. A `--check` mode lets CI fail when the site no longer matches Twenty's docs.

**Tech Stack:** Node 24 built-ins only (`node:fs`, `node:path`, `node:test`), Mintlify (project `exceev-group`), GitHub Actions.

**Spec:** the "Decisions" section below, agreed in conversation on 2026-10-08.

---

## Decisions (what you approve with this plan)

| # | Decision | Why |
| --- | --- | --- |
| D1 | All docs code and content live in `upshift/docs/`. `packages/twenty-docs` is never edited. | Merging Twenty into `upshift-main` can never conflict with it, same rule as the rest of the layer. |
| D2 | `upshift/docs/site/` is 100% generated. Wording changes go in `rules.mjs`, never in `site/` or the Mintlify web editor (the next import replaces them, and CI reports the difference). | Twenty doc updates arrive with one command. If you later want hand-written Upshift pages, we add an `overrides/` folder the importer copies last. |
| D3 | French (Default) & English. | Fastest today. Arabic exists in Twenty's docs and can be added later with the same rules. |
| D4 | Published: the Getting Started and User Guide tabs, minus Twenty's billing (5 pages), legal (2), self-hosted to cloud migration (1), implementation services (1) and professional services (1). That leaves 120 pages. | Those pages describe Twenty's cloud plans, partner network and legal or compliance claims (SOC 2, GDPR, trust center). Rebranded, they would become false claims for Upshift. |
| D5 | Links into anything not published (the Developers tab, the UI library, excluded pages) are unwrapped to plain text. Cards pointing there are removed. Redirects pointing there are dropped. | Nothing under `/developers` is reachable, and no page shows a dead link. |
| D6 | "Twenty" becomes "Upshift" in prose, titles and alt text. It stays unchanged in code blocks, inline code and identifiers (`isTwenty`, `twenty-bounce`, image file names). | Code samples have to keep matching what the product actually uses. |
| D7 | Twenty addresses are rewritten: partner links and `contact@twenty.com` go to `contact@exceev.com`, `app.twenty.com` goes to `https://app.upshiftcloud.com`, `api.twenty.com` and workspace hosts become `crm.yourcompany.com`, and example emails or URLs become `example.com`. 9 specific sentences (partners, GitHub discussions, credits) are rewritten exactly. | Every value comes from `upshift/branding/brand.json`, so a brand change flows through. |
| D8 | Page slugs containing "twenty" are renamed (`generate-pdf-from-twenty` becomes `generate-pdf-from-upshift`, 6 pages), with redirects from the old slug. | The browser's address bar shows the brand too. |
| D9 | Mintlify branding: name "Upshift Documentation", `logo-square.svg` as logo and favicon, zinc colors from the logo (`#18181B`), a "Contact us" button to `mailto:contact@exceev.com`, and a footer with website, contact, privacy and terms. A "Credits: Based on the Twenty documentation (AGPL-3.0)" footer link keeps the license attribution. | Twenty's docs are AGPL-3.0. |
| D10 | Hosting: Mintlify project `exceev-group` builds from `exceev-technology/upshift`, folder `upshift/docs/site`. It uses branch `feat/upshift-docs` for the preview, then `upshift-main` after merge, on `docs.upshiftcloud.com` (already attached in Mintlify). | Same repository, no second repo to keep in sync. |
| D11 | Out of scope for this branch: Firebase, the landing page and the demo project, `brand.json`'s `docsUrl` (still `https://upshiftcloud.com/docs`, see Follow-ups), screenshots and videos that show the Twenty UI, and French. | Docs only, as requested. |

## Dry run (already done, outside the repository)

The exact code in this plan was run in a scratch copy against this branch's `packages/twenty-docs`:

- `Wrote upshift/docs/site: 120 pages, 105 images, 3 snippets, 82 redirects.` The site is 25 MB, and the import reported 0 problems.
- Every phrase rule matched its expected count.
- No `twenty.com` or `twentyhq` is left in any page.
- No link points to an unpublished page.
- `--check` reported the site up to date right after writing it.
- `node --test` passed 18 of 18 tests.
- "Upshift" now appears 406 times. "Twenty" remains only inside code samples and sample data, in 6 files (for example an email template signed "Twenty").

## What you do outside the code

1. **Mintlify GitHub app:** install it on the `exceev-technology` organization with access to `upshift` (Mintlify dashboard, Settings, Git). Today the Mintlify MCP sees 0 repositories, so Task 6 can't connect the repo until this is done.
2. **DNS for `docs.upshiftcloud.com`:** add the CNAME and the two TXT validation records the Mintlify dashboard shows for that domain. The values are given in chat, not committed, because they are account-specific verification tokens.
3. **Mintlify plan:** the project is on **hobby** today. Upgrading to Pro is a purchase in Mintlify's billing page, so you do it. Nothing in this plan depends on Pro.

## Global Constraints

- Never modify `packages/twenty-docs` or any other Twenty-owned file. New files go under `upshift/`. The only edits outside it are the two Upshift workflows in `.github/workflows/upshift-*.yaml`.
- No new dependencies: Node 24 built-ins only. Tests use `node:test`.
- `upshift/docs/site/` is written only by `node upshift/docs/import-docs.mjs`.
- Brand values come from `upshift/branding/brand.json` (`name`, `contactEmail`, `websiteUrl`, `privacyPolicyUrl`, `termsUrl`).
- Commit messages are one plain sentence, like the existing history, with no AI attribution trailers.
- Firebase, the landing page and `/Users/hlemrani/Documents/ChatGPT/Demo Client Upshift` are not touched.

## Review Focus

1. **Twenty renames or removes a kept tab.** The import must fail with a message naming the tab, not publish an empty site. Covered by Task 1's "fails when Twenty renames a kept tab".
2. **A published page links to an unpublished page with an anchor, or through a self-closing `<Card ... />`.** The text is kept and the Card is removed, leaving no dead link. Covered by Task 2's "unwraps links..." and "drops cards..." tests.
3. **"Twenty" inside code, inline code, identifiers (`isTwenty`), lowercase config keys (`"twenty": {`) and image file names.** These stay unchanged. Covered by Task 2's "renames Twenty in prose and leaves code... alone".
4. **A link to a renamed page with an anchor, and the old URL.** The link points to the new slug and keeps the anchor, and the old slug redirects. Covered by Task 1's `filterRedirects` test and Task 2's link test.
5. **Hand edits or stray files in `site/`** (a Mintlify editor commit, `.DS_Store`). `--check` reports the edit and ignores dotfiles. Covered by Task 4's `findDrift` test.

Manual checks no test covers (Task 4 Step 6 and Task 6 Step 4):

- Screenshots and Vimeo videos still show the Twenty UI.
- The Quickstart says to sign up at `upshiftcloud.com`.
- The logo looks right in light and dark mode.
- Mintlify builds from a large monorepo. If it is too slow or fails, the fallback is a small `exceev-technology/upshift-docs` repository that CI pushes `site/` to.

---

## File Structure

```
upshift/docs/
  PLAN.md                   this plan (removed before merge, Task 6)
  rules.mjs                 what is published and how it is rebranded (data only)
  transform.mjs             pure functions: navigation, redirects, page rebranding, assets, docs.json, audit
  import-docs.mjs           CLI: reads packages/twenty-docs, writes site/ or checks it (--check)
  test/
    navigation.test.mjs     filterNavigation, filterRedirects, renamePage
    rebrand.test.mjs        rebrandPage, applyPhraseReplacements
    site-files.test.mjs     collectAssets, buildDocsConfig, adaptCustomCss, auditSite
    import-docs.test.mjs    buildSite on the real Twenty docs, findDrift
  site/                     generated Mintlify site (Mintlify content directory)
.github/workflows/upshift-branding-check.yaml   new "docs" job
.github/workflows/upshift-release.yaml          docs-only PRs no longer build the image
upshift/README.md                               new "Documentation" section
```

---

### Task 1: Rules, and navigation filtering

**Files:**
- Create: `upshift/docs/rules.mjs`
- Create: `upshift/docs/transform.mjs`
- Test: `upshift/docs/test/navigation.test.mjs`

**Interfaces:**
- Produces: `renamePage(page: string): string`, `filterNavigation(twentyDocsConfig): { tabs: Tab[], pages: string[] }` (`pages` are Twenty's original slugs, `tabs` already use renamed slugs), `filterRedirects(redirects: {source, destination}[], pages: string[]): {source, destination}[]`. `rules.mjs` exports every constant used by later tasks.

- [ ] **Step 1: Write the failing test**

Create `upshift/docs/test/navigation.test.mjs`:

```js
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { filterNavigation, filterRedirects, renamePage } from '../transform.mjs';

const twentyDocsConfig = {
  navigation: {
    languages: [
      { language: 'fr', tabs: [] },
      {
        language: 'en',
        tabs: [
          {
            tab: 'Getting Started',
            groups: [{ group: 'Welcome', pages: ['getting-started/introduction'] }],
          },
          {
            tab: 'User Guide',
            groups: [
              { group: 'Billing', pages: ['user-guide/billing/overview'] },
              {
                group: 'Workflows',
                pages: [
                  'user-guide/workflows/overview',
                  {
                    group: 'How-Tos',
                    pages: ['user-guide/workflows/how-tos/generate-pdf-from-twenty'],
                  },
                ],
              },
            ],
          },
          {
            tab: 'Developers',
            groups: [{ group: 'Overview', pages: ['developers/introduction'] }],
          },
        ],
      },
    ],
  },
};

describe('filterNavigation', () => {
  it('keeps the Getting Started and User Guide tabs without excluded pages', () => {
    const { tabs, pages } = filterNavigation(twentyDocsConfig);

    assert.deepEqual(tabs, [
      {
        tab: 'Getting Started',
        groups: [{ group: 'Welcome', pages: ['getting-started/introduction'] }],
      },
      {
        tab: 'User Guide',
        groups: [
          {
            group: 'Workflows',
            pages: [
              'user-guide/workflows/overview',
              {
                group: 'How-Tos',
                pages: ['user-guide/workflows/how-tos/generate-pdf-from-upshift'],
              },
            ],
          },
        ],
      },
    ]);
    assert.deepEqual(pages, [
      'getting-started/introduction',
      'user-guide/workflows/overview',
      'user-guide/workflows/how-tos/generate-pdf-from-twenty',
    ]);
  });

  it('fails when Twenty renames a kept tab', () => {
    const renamed = structuredClone(twentyDocsConfig);

    renamed.navigation.languages[1].tabs[1].tab = 'Guide';

    assert.throws(() => filterNavigation(renamed), /no "User Guide" tab/);
  });
});

describe('filterRedirects', () => {
  it('keeps redirects into published pages and points them at renamed slugs', () => {
    const pages = [
      'user-guide/workflows/overview',
      'user-guide/workflows/how-tos/generate-pdf-from-twenty',
    ];

    const redirects = filterRedirects(
      [
        { source: '/user-guide/workflows', destination: '/user-guide/workflows/overview' },
        {
          source: '/pdf',
          destination: '/user-guide/workflows/how-tos/generate-pdf-from-twenty#setup',
        },
        { source: '/developers/api', destination: '/developers/extend/api' },
      ],
      pages,
    );

    assert.deepEqual(redirects, [
      { source: '/user-guide/workflows', destination: '/user-guide/workflows/overview' },
      {
        source: '/pdf',
        destination: '/user-guide/workflows/how-tos/generate-pdf-from-upshift#setup',
      },
      {
        source: '/user-guide/workflows/how-tos/generate-pdf-from-twenty',
        destination: '/user-guide/workflows/how-tos/generate-pdf-from-upshift',
      },
    ]);
  });
});

describe('renamePage', () => {
  it('replaces twenty in page slugs', () => {
    assert.equal(
      renamePage('user-guide/calendar-emails/how-tos/can-i-send-emails-from-twenty'),
      'user-guide/calendar-emails/how-tos/can-i-send-emails-from-upshift',
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test upshift/docs/test/navigation.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `upshift/docs/transform.mjs`.

- [ ] **Step 3: Write the rules**

Create `upshift/docs/rules.mjs`:

```js
import { readFileSync } from 'node:fs';

const brand = JSON.parse(
  readFileSync(new URL('../branding/brand.json', import.meta.url), 'utf8'),
);

export const BRAND_NAME = brand.name;
export const CONTACT_EMAIL = brand.contactEmail;
export const CONTACT_LINK = `mailto:${brand.contactEmail}`;
export const WEBSITE_URL = brand.websiteUrl;
export const PRIVACY_POLICY_URL = brand.privacyPolicyUrl;
export const TERMS_URL = brand.termsUrl;
export const DOCS_URL = 'https://docs.upshiftcloud.com';
export const TWENTY_SOURCE_URL = 'https://github.com/twentyhq/twenty';

export const BRAND_COLORS = {
  primary: '#18181B',
  light: '#FAFAFA',
  dark: '#18181B',
};

export const KEPT_TABS = ['Getting Started', 'User Guide'];

// These pages describe Twenty's cloud plans, partner network and legal
// commitments, which Upshift does not offer.
export const EXCLUDED_PAGE_PREFIXES = [
  'user-guide/billing/',
  'user-guide/legal/',
  'user-guide/data-migration/how-tos/migrating-from-self-hosted-to-cloud',
  'user-guide/getting-started/capabilities/implementation-services',
  'user-guide/workflows/how-tos/need-more-help/professional-services',
];

const EXAMPLE_SERVER_HOST = 'crm.yourcompany.com';
const CONTACT_TEAM = `Contact the ${BRAND_NAME} team`;

// Each phrase must appear exactly `count` times across the published pages, so
// a sentence Twenty rewords fails the import instead of going out unchanged.
export const PHRASE_REPLACEMENTS = [
  {
    from: 'Need SSO configured for your organization? [Find a certified Twenty partner](https://twenty.com/partners/list?categories=SOLUTIONING&ref=docs-sso) who specializes in SSO and identity setup. *(Prefer to loop in Twenty directly? [contact@twenty.com](mailto:contact@twenty.com))*',
    to: `Need SSO configured for your organization? [${CONTACT_TEAM}](${CONTACT_LINK}).`,
    count: 1,
  },
  { from: 'Find a certified Twenty partner', to: CONTACT_TEAM, count: 3 },
  {
    from: 'Share your use case on our [GitHub discussions](https://github.com/twentyhq/twenty/discussions) to help prioritize this feature.',
    to: `Share your use case with the [${BRAND_NAME} team](${CONTACT_LINK}) to help prioritize this feature.`,
    count: 1,
  },
  {
    from: 'Join our [GitHub discussions](https://github.com/twentyhq/twenty/discussions) to share your use case and help prioritize this feature.',
    to: `[${CONTACT_TEAM}](${CONTACT_LINK}) to share your use case and help prioritize this feature.`,
    count: 1,
  },
  {
    from: '- Follow our [GitHub](https://github.com/twentyhq/twenty) for development updates\n',
    to: '',
    count: 1,
  },
  {
    from: '- **Email credits** if you use Twenty Cloud. Each sent email uses credits. See [Credits](/user-guide/billing/capabilities/credits).\n',
    to: '',
    count: 1,
  },
  {
    from: 'Check our [Implementation Services](/user-guide/getting-started/capabilities/implementation-services) for help with complex data model design.',
    to: `[${CONTACT_TEAM}](${CONTACT_LINK}) for help with complex data model design.`,
    count: 1,
  },
  {
    from: 'Our [implementation partners](/user-guide/getting-started/capabilities/implementation-services) can help run these scripts if needed.',
    to: `The [${BRAND_NAME} team](${CONTACT_LINK}) can help run these scripts if needed.`,
    count: 1,
  },
  {
    from: 'Contact us at [contact@twenty.com](mailto:contact@twenty.com) or explore our [Implementation Services](/user-guide/getting-started/capabilities/implementation-services).',
    to: `Contact us at [${CONTACT_EMAIL}](${CONTACT_LINK}).`,
    count: 1,
  },
];

// Applied in order to whole pages, code samples included, because readers
// copy those URLs.
export const URL_REPLACEMENTS = [
  [/https:\/\/twenty\.com\/partners[^\s)"']*/g, CONTACT_LINK],
  [/contact@twenty\.com/g, CONTACT_EMAIL],
  [/https:\/\/app\.twenty\.com[^\s)"']*/g, WEBSITE_URL],
  [/app\.twenty\.com/g, new URL(WEBSITE_URL).host],
  [/inbound\.twenty\.com/g, 'inbound.yourcompany.com'],
  [/twenty\.yourcompany\.com/g, EXAMPLE_SERVER_HOST],
  [/\b[\w-]+\.twenty\.com/g, EXAMPLE_SERVER_HOST],
  [/@twenty\.com/g, '@example.com'],
  [/https:\/\/twenty\.com/g, 'https://example.com'],
];
```

- [ ] **Step 4: Write `transform.mjs` with its shared header and the navigation functions**

Create `upshift/docs/transform.mjs`. The header imports and constants are used by Tasks 2 and 3 too:

```js
import {
  BRAND_COLORS,
  BRAND_NAME,
  CONTACT_LINK,
  DOCS_URL,
  EXCLUDED_PAGE_PREFIXES,
  KEPT_TABS,
  PHRASE_REPLACEMENTS,
  PRIVACY_POLICY_URL,
  TERMS_URL,
  TWENTY_SOURCE_URL,
  URL_REPLACEMENTS,
  WEBSITE_URL,
} from './rules.mjs';

const ASSET_PREFIXES = ['images/', 'snippets/'];
const CODE_SEGMENT = /(```[\s\S]*?```|`[^`\n]*`)/;
const BRAND_WORD = /\bTwenty\b/g;
const MARKDOWN_LINK = /\[([^\]]*)\]\((\/[^)\s]*)\)/g;
const CARD_WITH_HREF =
  /<Card\b[^>]*?\bhref="(\/[^"]*)"[^>]*?(?:\/>|>[\s\S]*?<\/Card>)/g;
const EMPTY_CARD_GROUP = /<CardGroup\b[^>]*>\s*<\/CardGroup>\n?/g;
const HREF_ATTRIBUTE = /\bhref="(\/[^"]*)"/g;
const IMAGE_REFERENCE = /\/images\/[^\s)"'`]+/g;
const SNIPPET_IMPORT = /from\s+['"]\/(snippets\/[^'"]+)['"]/g;
const FORBIDDEN_IN_PAGES = ['twenty.com', 'twentyhq'];

export const renamePage = (page) => page.replaceAll('twenty', 'upshift');

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

const resolveLink = (target, publishedPages) => {
  const [page, suffix] = splitTarget(target);

  if (isAsset(page)) {
    return target;
  }

  return publishedPages.has(page) ? `/${renamePage(page)}${suffix}` : null;
};

export const filterNavigation = (twentyDocsConfig) => {
  const english = twentyDocsConfig.navigation.languages.find(
    ({ language }) => language === 'en',
  );
  const pages = [];

  const filterEntry = (entry) => {
    if (typeof entry === 'string') {
      if (isExcluded(entry)) {
        return null;
      }

      pages.push(entry);

      return renamePage(entry);
    }

    const children = entry.pages
      .map(filterEntry)
      .filter((child) => child !== null);

    return children.length === 0 ? null : { ...entry, pages: children };
  };

  const tabs = KEPT_TABS.map((tabName) => {
    const tab = english.tabs.find(({ tab: name }) => name === tabName);

    if (tab === undefined) {
      throw new Error(
        `Twenty's docs have no "${tabName}" tab any more; update KEPT_TABS in upshift/docs/rules.mjs`,
      );
    }

    return {
      ...tab,
      groups: tab.groups.map(filterEntry).filter((group) => group !== null),
    };
  });

  return { tabs, pages };
};

export const filterRedirects = (redirects, pages) => {
  const publishedPages = new Set(pages);

  const twentyRedirects = redirects.flatMap(({ source, destination }) => {
    const resolved = resolveLink(destination, publishedPages);

    return resolved === null ? [] : [{ source, destination: resolved }];
  });

  const renameRedirects = pages
    .filter((page) => renamePage(page) !== page)
    .map((page) => ({ source: `/${page}`, destination: `/${renamePage(page)}` }));

  return [...twentyRedirects, ...renameRedirects];
};
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test upshift/docs/test/navigation.test.mjs`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add upshift/docs/rules.mjs upshift/docs/transform.mjs upshift/docs/test/navigation.test.mjs
git commit -m "Pick which Twenty doc pages Upshift publishes"
```

---

### Task 2: Page rebranding

**Files:**
- Modify: `upshift/docs/transform.mjs` (append)
- Test: `upshift/docs/test/rebrand.test.mjs`

**Interfaces:**
- Consumes: `renamePage`, `resolveLink`, the constants from Task 1's header.
- Produces: `replaceOutsideCode(source, pattern, replacement): string`, `applyPhraseReplacements(sources: Map<string, string>, rules = PHRASE_REPLACEMENTS): { outputs: Map<string, string>, problems: string[] }`, `rebrandPage(source: string, publishedPages: Set<string>): string` (`publishedPages` holds Twenty's original slugs).

- [ ] **Step 1: Write the failing test**

Create `upshift/docs/test/rebrand.test.mjs`:

```js
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { applyPhraseReplacements, rebrandPage } from '../transform.mjs';

const publishedPages = new Set([
  'user-guide/workflows/overview',
  'user-guide/calendar-emails/how-tos/can-i-send-emails-from-twenty',
]);

describe('rebrandPage', () => {
  it('renames Twenty in prose and leaves code, identifiers and file names alone', () => {
    const source = [
      "Twenty keeps your data. Twenty's views are fast.",
      '![Twenty inbox](/images/user-guide/emails/03-twenty-add-email-channel.png)',
      'Check `user.isTwenty` before calling Twenty.',
      '```json',
      '{ "twenty": { "name": "Twenty" } }',
      '```',
    ].join('\n');

    assert.equal(
      rebrandPage(source, publishedPages),
      [
        "Upshift keeps your data. Upshift's views are fast.",
        '![Upshift inbox](/images/user-guide/emails/03-twenty-add-email-channel.png)',
        'Check `user.isTwenty` before calling Upshift.',
        '```json',
        '{ "twenty": { "name": "Twenty" } }',
        '```',
      ].join('\n'),
    );
  });

  it('points Twenty hosts and addresses at Upshift ones', () => {
    const source = [
      'Write to [contact@twenty.com](mailto:contact@twenty.com).',
      'Go to [app.twenty.com](https://app.twenty.com/welcome).',
      'curl https://api.twenty.com/graphql',
      'Forward to ch_1@inbound.twenty.com or https://mycompany.twenty.com/mcp, as jane@twenty.com.',
      '[Partners](https://twenty.com/partners/list?ref=docs) and `https://twenty.com`.',
    ].join('\n');

    assert.equal(
      rebrandPage(source, publishedPages),
      [
        'Write to [contact@exceev.com](mailto:contact@exceev.com).',
        'Go to [upshiftcloud.com](https://upshiftcloud.com).',
        'curl https://crm.yourcompany.com/graphql',
        'Forward to ch_1@inbound.yourcompany.com or https://crm.yourcompany.com/mcp, as jane@example.com.',
        '[Partners](mailto:contact@exceev.com) and `https://example.com`.',
      ].join('\n'),
    );
  });

  it('unwraps links to unpublished pages and renames links to renamed pages', () => {
    const source =
      'See the [API](/developers/extend/api#create-an-api-key), [workflows](/user-guide/workflows/overview/) and [emails](/user-guide/calendar-emails/how-tos/can-i-send-emails-from-twenty#roadmap).';

    assert.equal(
      rebrandPage(source, publishedPages),
      'See the API, [workflows](/user-guide/workflows/overview) and [emails](/user-guide/calendar-emails/how-tos/can-i-send-emails-from-upshift#roadmap).',
    );
  });

  it('drops cards that lead to unpublished pages and the groups they leave empty', () => {
    const source = [
      '<CardGroup cols={2}>',
      '  <Card title="Explore the API" icon="plug" href="/developers/extend/api">',
      '    Build integrations.',
      '  </Card>',
      '  <Card title="Billing" href="/user-guide/billing/overview" />',
      '</CardGroup>',
      '<CardGroup cols={2}>',
      '  <Card title="Workflows" href="/user-guide/workflows/overview">Automate.</Card>',
      '</CardGroup>',
    ].join('\n');

    assert.equal(
      rebrandPage(source, publishedPages),
      [
        '<CardGroup cols={2}>',
        '  <Card title="Workflows" href="/user-guide/workflows/overview">Automate.</Card>',
        '</CardGroup>',
      ].join('\n'),
    );
  });
});

describe('applyPhraseReplacements', () => {
  const rules = [
    { from: 'Find a certified Twenty partner', to: 'Contact the Upshift team', count: 2 },
  ];

  it('replaces a phrase across pages', () => {
    const { outputs, problems } = applyPhraseReplacements(
      new Map([
        ['a', 'Find a certified Twenty partner.'],
        ['b', 'Or Find a certified Twenty partner.'],
      ]),
      rules,
    );

    assert.deepEqual(problems, []);
    assert.deepEqual([...outputs.values()], [
      'Contact the Upshift team.',
      'Or Contact the Upshift team.',
    ]);
  });

  it('reports a phrase Twenty reworded', () => {
    const { problems } = applyPhraseReplacements(
      new Map([['a', 'Find a Twenty partner.']]),
      rules,
    );

    assert.equal(problems.length, 1);
    assert.match(problems[0], /expects 2 matches .* found 0/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test upshift/docs/test/rebrand.test.mjs`
Expected: FAIL with `SyntaxError: The requested module '../transform.mjs' does not provide an export named 'applyPhraseReplacements'`.

- [ ] **Step 3: Append the rebranding functions to `transform.mjs`**

```js
export const replaceOutsideCode = (source, pattern, replacement) =>
  source
    .split(CODE_SEGMENT)
    .map((segment, index) =>
      index % 2 === 1 ? segment : segment.replace(pattern, replacement),
    )
    .join('');

export const applyPhraseReplacements = (
  sources,
  rules = PHRASE_REPLACEMENTS,
) => {
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

export const rebrandPage = (source, publishedPages) => {
  let output = source;

  for (const [pattern, replacement] of URL_REPLACEMENTS) {
    output = output.replace(pattern, replacement);
  }

  output = output.replace(CARD_WITH_HREF, (card, target) => {
    const resolved = resolveLink(target, publishedPages);

    return resolved === null
      ? ''
      : card.replace(`href="${target}"`, `href="${resolved}"`);
  });

  output = output.replace(MARKDOWN_LINK, (link, text, target) => {
    const resolved = resolveLink(target, publishedPages);

    return resolved === null ? text : `[${text}](${resolved})`;
  });

  output = output.replace(HREF_ATTRIBUTE, (attribute, target) => {
    const resolved = resolveLink(target, publishedPages);

    return resolved === null ? attribute : `href="${resolved}"`;
  });

  output = output.replace(EMPTY_CARD_GROUP, '');

  return replaceOutsideCode(output, BRAND_WORD, BRAND_NAME);
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test upshift/docs/test/navigation.test.mjs upshift/docs/test/rebrand.test.mjs`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add upshift/docs/transform.mjs upshift/docs/test/rebrand.test.mjs
git commit -m "Rebrand Twenty's doc pages for Upshift"
```

---

### Task 3: Assets, Mintlify config and audit

**Files:**
- Modify: `upshift/docs/transform.mjs` (append)
- Test: `upshift/docs/test/site-files.test.mjs`

**Interfaces:**
- Consumes: `splitTarget`, `isAsset`, the constants from Task 1's header.
- Produces: `collectAssets(sources: string[]): { images: string[], snippets: string[] }` (relative paths without a leading slash, sorted), `buildDocsConfig(twentyDocsConfig, tabs, redirects): object`, `adaptCustomCss(css: string): string`, `auditSite(files: Map<string, string | Buffer>, publishedPages: string[]): string[]` (`publishedPages` holds renamed slugs).

- [ ] **Step 1: Write the failing test**

Create `upshift/docs/test/site-files.test.mjs`:

```js
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  adaptCustomCss,
  auditSite,
  buildDocsConfig,
  collectAssets,
} from '../transform.mjs';

describe('collectAssets', () => {
  it('finds images in markdown, attributes and frontmatter, and imported snippets', () => {
    const page = [
      '---',
      'image: /images/docs/cover.png',
      '---',
      "import { VimeoEmbed } from '/snippets/vimeo-embed.mdx';",
      '![Inbox](/images/user-guide/inbox.png)',
      '<Card img="/images/user-guide/halftone/billing.png" />',
      '<img src="/images/user-guide/inbox.png" />',
    ].join('\n');

    assert.deepEqual(collectAssets([page]), {
      images: [
        'images/docs/cover.png',
        'images/user-guide/halftone/billing.png',
        'images/user-guide/inbox.png',
      ],
      snippets: ['snippets/vimeo-embed.mdx'],
    });
  });
});

describe('buildDocsConfig', () => {
  it('brands the Mintlify config and keeps Twenty only in the credits', () => {
    const tabs = [{ tab: 'Getting Started', groups: [] }];
    const redirects = [{ source: '/a', destination: '/b' }];

    const config = buildDocsConfig(
      {
        $schema: 'https://mintlify.com/docs.json',
        theme: 'almond',
        interaction: { drilldown: false },
        styling: { eyebrows: 'breadcrumbs' },
      },
      tabs,
      redirects,
    );

    assert.equal(config.name, 'Upshift Documentation');
    assert.equal(config.$schema, 'https://mintlify.com/docs.json');
    assert.deepEqual(config.navigation, { tabs });
    assert.deepEqual(config.redirects, redirects);
    assert.equal(config.seo.metatags.canonical, 'https://docs.upshiftcloud.com');
    assert.equal(JSON.stringify(config).includes('twenty.com'), false);
    assert.deepEqual(config.footer.links.at(-1).items, [
      {
        label: 'Based on the Twenty documentation (AGPL-3.0)',
        href: 'https://github.com/twentyhq/twenty',
      },
    ]);
  });
});

describe('adaptCustomCss', () => {
  it('drops selectors for the Developers tab and keeps the User Guide ones', () => {
    const css = [
      "div:has(> .sidebar-group a[href='/developers/introduction']),",
      "div:has(> .sidebar-group a[href='/user-guide/introduction']) {",
      '  display: none;',
      '}',
    ].join('\n');

    assert.equal(
      adaptCustomCss(css),
      [
        "div:has(> .sidebar-group a[href='/user-guide/introduction']) {",
        '  display: none;',
        '}',
      ].join('\n'),
    );
  });
});

describe('auditSite', () => {
  it('reports missing pages, Twenty hosts and links to unpublished pages', () => {
    const files = new Map([
      [
        'user-guide/a.mdx',
        'Mail [us](mailto:contact@twenty.com), read [b](/user-guide/b) and see ![x](/images/missing.png).',
      ],
      ['docs.json', '{"canonical":"https://docs.twenty.com"}'],
    ]);

    assert.deepEqual(auditSite(files, ['user-guide/a', 'user-guide/c']), [
      'user-guide/c is in the navigation but has no page',
      'user-guide/a.mdx still references twenty.com',
      'user-guide/a.mdx links to /user-guide/b, which is not published',
      'user-guide/a.mdx links to /images/missing.png, which is not published',
      'docs.json still references twenty.com',
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test upshift/docs/test/site-files.test.mjs`
Expected: FAIL with `SyntaxError: The requested module '../transform.mjs' does not provide an export named 'adaptCustomCss'`.

- [ ] **Step 3: Append the site file functions to `transform.mjs`**

```js
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

export const buildDocsConfig = (twentyDocsConfig, tabs, redirects) => ({
  $schema: twentyDocsConfig.$schema,
  name: `${BRAND_NAME} Documentation`,
  theme: twentyDocsConfig.theme,
  logo: { light: '/logo.svg', dark: '/logo.svg' },
  favicon: '/favicon.svg',
  colors: BRAND_COLORS,
  interaction: twentyDocsConfig.interaction,
  navbar: {
    primary: { type: 'button', label: 'Contact us', href: CONTACT_LINK },
  },
  styling: twentyDocsConfig.styling,
  seo: { metatags: { canonical: DOCS_URL } },
  navigation: { tabs },
  footer: {
    links: [
      {
        header: BRAND_NAME,
        items: [
          { label: 'Website', href: WEBSITE_URL },
          { label: 'Contact', href: CONTACT_LINK },
          { label: 'Privacy policy', href: PRIVACY_POLICY_URL },
          { label: 'Terms', href: TERMS_URL },
        ],
      },
      {
        header: 'Credits',
        items: [
          {
            label: 'Based on the Twenty documentation (AGPL-3.0)',
            href: TWENTY_SOURCE_URL,
          },
        ],
      },
    ],
  },
  redirects,
});

export const adaptCustomCss = (css) =>
  css
    .split('\n')
    .filter((line) => !line.includes('/developers/'))
    .join('\n');

export const auditSite = (files, publishedPages) => {
  const published = new Set(publishedPages);
  const problems = publishedPages
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

    const targets = [
      ...[...text.matchAll(MARKDOWN_LINK)].map((match) => match[2]),
      ...[...text.matchAll(HREF_ATTRIBUTE)].map((match) => match[1]),
    ];

    for (const target of targets) {
      const [page] = splitTarget(target);
      const isMissing = isAsset(page) ? !files.has(page) : !published.has(page);

      if (isMissing) {
        problems.push(`${filePath} links to ${target}, which is not published`);
      }
    }
  }

  return problems;
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test upshift/docs/test/navigation.test.mjs upshift/docs/test/rebrand.test.mjs upshift/docs/test/site-files.test.mjs`
Expected: PASS, 14 tests.

- [ ] **Step 5: Commit**

```bash
git add upshift/docs/transform.mjs upshift/docs/test/site-files.test.mjs
git commit -m "Build the Upshift Mintlify config and audit the docs site"
```

---

### Task 4: The importer, and the generated site

**Files:**
- Create: `upshift/docs/import-docs.mjs`
- Test: `upshift/docs/test/import-docs.test.mjs`
- Generate: `upshift/docs/site/` (about 25 MB: 120 pages, 105 images, 3 snippets, `docs.json`, `custom.css`, `logo.svg`, `favicon.svg`)

**Interfaces:**
- Consumes: every export of `transform.mjs`.
- Produces: `TWENTY_DOCS_ROOT: string`, `buildSite(twentyDocsRoot: string): { files: Map<string, string | Buffer>, problems: string[], summary }`, `findDrift(files, siteRoot): { changed: string[], extra: string[] }`. CLI: `node upshift/docs/import-docs.mjs [--check]`, exit code 1 on problems or drift.

- [ ] **Step 1: Write the failing test**

Create `upshift/docs/test/import-docs.test.mjs`:

```js
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

  it('publishes only the Getting Started and User Guide tabs', () => {
    assert.deepEqual(
      docsConfig.navigation.tabs.map(({ tab }) => tab),
      ['Getting Started', 'User Guide'],
    );

    const unwanted = [...files.keys()].filter((filePath) =>
      /^(developers|ui|user-guide\/billing|user-guide\/legal)\//.test(filePath),
    );

    assert.deepEqual(unwanted, []);
  });

  it('ships the files Mintlify needs at the site root', () => {
    for (const filePath of ['docs.json', 'custom.css', 'logo.svg', 'favicon.svg']) {
      assert.ok(files.has(filePath), filePath);
    }
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test upshift/docs/test/import-docs.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `upshift/docs/import-docs.mjs`.

- [ ] **Step 3: Write the importer**

Create `upshift/docs/import-docs.mjs`:

```js
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
  adaptCustomCss,
  applyPhraseReplacements,
  auditSite,
  buildDocsConfig,
  collectAssets,
  filterNavigation,
  filterRedirects,
  rebrandPage,
  renamePage,
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
  const { tabs, pages } = filterNavigation(twentyDocsConfig);
  const publishedPages = new Set(pages);

  const { outputs, problems } = applyPhraseReplacements(
    new Map(pages.map((page) => [page, readTwenty(`${page}.mdx`).toString()])),
  );

  const files = new Map();

  for (const [page, source] of outputs) {
    files.set(`${renamePage(page)}.mdx`, rebrandPage(source, publishedPages));
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

  const logo = readFileSync(path.join(BRANDING_ROOT, 'logo-square.svg'));
  const redirects = filterRedirects(twentyDocsConfig.redirects, pages);

  files.set('custom.css', adaptCustomCss(readTwenty('custom.css').toString()));
  files.set('logo.svg', logo);
  files.set('favicon.svg', logo);
  files.set(
    'docs.json',
    `${JSON.stringify(buildDocsConfig(twentyDocsConfig, tabs, redirects), null, 2)}\n`,
  );

  problems.push(...auditSite(files, pages.map(renamePage)));

  return {
    files,
    problems,
    summary: {
      pages: pages.length,
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
```

- [ ] **Step 4: Run all tests to verify they pass**

Run: `node --test upshift/docs/test/*.test.mjs`
Expected: PASS, 18 tests.

- [ ] **Step 5: Generate the site and check it**

Run: `node upshift/docs/import-docs.mjs`
Expected: `Wrote upshift/docs/site: 120 pages, 105 images, 3 snippets, 82 redirects.`

Run: `node upshift/docs/import-docs.mjs --check`
Expected: `upshift/docs/site matches packages/twenty-docs.`

Run: `cd upshift/docs/site && npx --yes mintlify@4.2.956 broken-links`
Expected: no broken links reported.

- [ ] **Step 6: Look at it in a browser**

Run: `cd upshift/docs/site && npx --yes mintlify@4.2.956 dev --port 3333`

Open http://localhost:3333 and check:
- Only the Getting Started and User Guide tabs exist, and `/developers/introduction` returns a 404.
- The logo and colors look right in light and dark mode.
- The Key Features page has no API or Self-Hosting cards.
- The SSO page ends with "Contact the Upshift team".
- The footer shows the Credits link.

Stop the server when done.

- [ ] **Step 7: Commit the importer, then the generated site**

```bash
git add upshift/docs/import-docs.mjs upshift/docs/test/import-docs.test.mjs
git commit -m "Import Twenty's user docs into an Upshift Mintlify site"
```

```bash
git add upshift/docs/site
git commit -m "Generate the Upshift docs site from Twenty's docs"
```

---

### Task 5: CI and README

**Files:**
- Modify: `.github/workflows/upshift-branding-check.yaml` (add a `docs` job after `apply-layer`)
- Modify: `.github/workflows/upshift-release.yaml:8-10` (paths filter)
- Modify: `upshift/README.md` (folder tree, a "Documentation" section, one line in "Syncing Twenty into upshift-main")

- [ ] **Step 1: Add the docs job to the branding check**

In `.github/workflows/upshift-branding-check.yaml`, insert this job between the `apply-layer` job and `disable-twenty-workflows`:

```yaml
  docs:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: Check out this branch
        uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4.3.1
        with:
          persist-credentials: false

      - name: Set up Node
        uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
        with:
          node-version: 24

      - name: Test the docs importer
        run: node --test upshift/docs/test/*.test.mjs

      - name: Check the docs site matches Twenty's docs
        run: node upshift/docs/import-docs.mjs --check
```

- [ ] **Step 2: Stop docs-only PRs from building the Docker image**

In `.github/workflows/upshift-release.yaml`, replace:

```yaml
    paths:
      - 'upshift/**'
      - '.github/workflows/upshift-release.yaml'
```

with:

```yaml
    paths:
      - 'upshift/**'
      - '!upshift/docs/**'
      - '.github/workflows/upshift-release.yaml'
```

This PR itself still runs one image build, because it edits `upshift-release.yaml`, which is in its own paths list.

- [ ] **Step 3: Document it in `upshift/README.md`**

In the folder tree at the top, after the `docker/` block, add:

```
  docs/
    rules.mjs           what is published and how it is rebranded
    import-docs.mjs     builds docs/site from packages/twenty-docs
    site/               generated Mintlify site, deployed to docs.upshiftcloud.com
```

Add this section before "## Syncing Twenty into upshift-main":

````markdown
## Documentation

`docs/` publishes the user documentation at https://docs.upshiftcloud.com with Mintlify. It is built from Twenty's own docs in `packages/twenty-docs`, which stays untouched:

- `docs/rules.mjs` says what is published and how it is rebranded: the Getting Started and User Guide tabs in English, without Twenty's billing, legal, cloud migration and partner pages, with Twenty's links and addresses pointed at Upshift.
- `docs/import-docs.mjs` applies the rules and writes `docs/site/`, the folder Mintlify deploys from `upshift-main`. Never edit `docs/site/` by hand or in the Mintlify web editor: the next import replaces it. Change the rules instead.

```bash
node upshift/docs/import-docs.mjs
```

The import fails when a sentence a rule expects has changed in Twenty's docs, or when a page still references a Twenty address or links to a page that is not published. Update the rule's text or `count` in `rules.mjs` and run it again. The Upshift Branding Check runs the importer's tests and fails while `docs/site/` differs from what the import produces.

To preview the site locally:

```bash
cd upshift/docs/site && npx --yes mintlify@4.2.956 dev
```
````

In "## Syncing Twenty into upshift-main", after the `git merge main` command block, add:

```markdown
Then refresh the docs in the same branch with `node upshift/docs/import-docs.mjs` and commit `upshift/docs/site` if it changed.
```

- [ ] **Step 4: Verify**

Run: `node --test upshift/docs/test/*.test.mjs && node upshift/docs/import-docs.mjs --check`
Expected: 18 tests pass, then `upshift/docs/site matches packages/twenty-docs.`

Run: `git diff --stat origin/upshift-main -- packages/`
Expected: no output, because no Twenty file changed.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/upshift-branding-check.yaml .github/workflows/upshift-release.yaml upshift/README.md
git commit -m "Check the docs site in CI and document the docs import"
```

---

### Task 6: Publish on Mintlify

Each step that changes something outside this machine (push, Mintlify settings, PR) is confirmed with you first.

- [ ] **Step 1: Check the prerequisites**

- The Mintlify MCP `list_repos_and_prs` with `{ action: 'list_repos', search: 'upshift' }` on subdomain `exceev-group` lists `exceev-technology/upshift`. If not, the GitHub app isn't installed yet (see "What you do outside the code").
- `gh repo view exceev-technology/upshift --json visibility` gives the value for `isPrivate`.

- [ ] **Step 2: Push the branch**

```bash
git push -u origin feat/upshift-docs
```

- [ ] **Step 3: Point Mintlify at the branch for a preview**

Mintlify MCP `manage_git_source` on `exceev-group`:

```json
{ "action": "update", "index": 0, "gitSource": { "type": "github", "owner": "exceev-technology", "repo": "upshift", "deployBranch": "feat/upshift-docs", "contentDirectory": "upshift/docs/site", "isPrivate": true } }
```

Set `isPrivate` from Step 1. This replaces the starter repository `mintlify-community/docs-exceev-group-bffbad9f` the project builds from today.

- [ ] **Step 4: Verify the preview**

Open the Mintlify default URL for `exceev-group` (shown in the Mintlify dashboard) in the browser pane and repeat Task 4 Step 6's checks on the deployed site. If Mintlify fails to build from the monorepo, stop and switch to the fallback in "Review Focus".

- [ ] **Step 5: Remove the plan and open the PR**

```bash
git rm upshift/docs/PLAN.md
git commit -m "Remove the docs implementation plan"
git push
gh pr create --repo exceev-technology/upshift --base upshift-main --head feat/upshift-docs --title "Publish Upshift user docs on Mintlify" --body "Builds docs.upshiftcloud.com from Twenty's Getting Started and User Guide pages. See upshift/README.md, Documentation."
```

- [ ] **Step 6: After merge, deploy from `upshift-main`**

Mintlify MCP `manage_git_source` on `exceev-group`: the same payload as Step 3 with `"deployBranch": "upshift-main"`.

- [ ] **Step 7: Validate the custom domain**

Once your DNS records exist, call Mintlify MCP `manage_custom_domain` with `{ "action": "retrigger_validation", "customHostnameId": "b9123b73-f246-480d-8c01-a66e01b5ecac" }`. Then `get_deployment_settings` should show `docs.upshiftcloud.com` as `active`. Open https://docs.upshiftcloud.com to confirm.

---

## Follow-ups (not in this branch)

- Point `docsUrl` in `upshift/branding/brand.json` to `https://docs.upshiftcloud.com`, so the CRM's help links reach the new site. This is a one-line change but it rebuilds the image, so it goes in its own PR.
- Rewrite pages that describe Twenty Cloud sign-up (Quickstart, "Why Twenty", Create a workspace) for how Upshift clients get access.
- Replace screenshots and videos that show the Twenty UI.
- Add French with the same rules.
- After the Pro upgrade: turn on the AI assistant and feedback with `update_deployment_settings`.
