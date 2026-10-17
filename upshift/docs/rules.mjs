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
export const DOCS_URL = brand.docsUrl;
export const REPOSITORY_URL = brand.repositoryUrl;
export const TWENTY_SOURCE_URL = 'https://github.com/twentyhq/twenty';
export const COMPANY_NAME = brand.companyName;
export const COMPANY_URL = 'https://exceev.com';
export const DEMO_PAGE_URL = `${brand.websiteUrl}/demo`;
export const DEMO_URL =
  'https://calcom.exceev.com/team/exceev-technology/upshift-intro';
export const SOCIALS = {
  linkedin: brand.linkedinUrl,
  x: brand.xUrl,
  facebook: 'https://facebook.com/exceevconsulting',
  github: 'https://github.com/exceev-consulting',
};

// The accent of upshiftcloud.com, in its light and dark themes.
export const BRAND_COLORS = {
  primary: '#1A1BB5',
  light: '#9192F0',
  dark: '#1A1BB5',
};

export const KEPT_SECTIONS = ['getting-started', 'user-guide', 'developers'];

// Once the docs site's Access is set to Private in Mintlify, it asks readers to
// sign in for every page whose frontmatter does not say `public: true`. Pages
// of these sections are published without it; every other page gets it.
export const PRIVATE_SECTIONS = ['developers'];

// French is the default language, so it is served at the site root and English
// under /en/. Twenty's French translation sometimes translates the brand name
// literally as "Vingt".
export const LANGUAGES = [
  {
    language: 'fr',
    isDefault: true,
    twentyPrefix: 'fr/',
    sitePrefix: '',
    brandWord: /\b(?:Twenty|Vingt)\b/g,
    labels: {
      contactUs: 'Nous contacter',
      product: 'Produit',
      website: 'Site web',
      watchDemo: 'Voir la démo',
      bookDemo: 'Réserver une démo',
      documentation: 'Documentation',
      sections: ['Prise en main', 'Guide utilisateur'],
      company: 'Entreprise',
      legal: 'Légal',
      privacyPolicy: 'Confidentialité',
      terms: "Conditions d'usage",
      basedOnTwenty: 'Basé sur Twenty',
    },
  },
  {
    language: 'en',
    isDefault: false,
    twentyPrefix: '',
    sitePrefix: 'en/',
    brandWord: /\bTwenty\b/g,
    labels: {
      contactUs: 'Contact us',
      product: 'Product',
      website: 'Website',
      watchDemo: 'Watch the demo',
      bookDemo: 'Book a demo',
      documentation: 'Documentation',
      sections: ['Getting started', 'User guide'],
      company: 'Company',
      legal: 'Legal',
      privacyPolicy: 'Privacy',
      terms: 'Terms',
      basedOnTwenty: 'Built on Twenty',
    },
  },
];

// These pages describe Twenty's cloud plans, partner network and legal
// commitments, which Upshift does not offer.
export const EXCLUDED_PAGE_PREFIXES = [
  'user-guide/billing/',
  'user-guide/legal/',
  'user-guide/data-migration/how-tos/migrating-from-self-hosted-to-cloud',
  'user-guide/getting-started/capabilities/implementation-services',
  'user-guide/workflows/how-tos/need-more-help/professional-services',
  // Upshift is deployed from its own image and compose file (see
  // upshift/README.md), and changes to the platform itself go to Twenty.
  'developers/self-host/',
  'developers/contribute/',
  // The UI library reference shows live previews from Twenty's Storybook.
  'ui/',
];

// Code samples name the brand in comments, strings and diagrams too. The
// webhook signature headers keep Twenty's name: they are part of the API.
export const CODE_BRAND_WORD = /(?<!X-)\bTwenty\b/g;

// Twenty's sites and community channels.
export const FORBIDDEN_IN_PAGES = ['twenty.com', 'twentyhq', 'discord.gg'];

// The app adds these language prefixes to its documentation links; languages
// this site does not publish go to the English pages.
export const LOCALE_FALLBACK = 'en';

const EXAMPLE_SERVER_HOST = 'crm.yourcompany.com';
const CONTACT_TEAM = `Contact the ${BRAND_NAME} team`;
const FRENCH_CONTACT_TEAM = `Contactez l'équipe ${BRAND_NAME}`;
const TWENTY_ISSUE_LINK =
  'https://github.com/twentyhq/twenty/issues/new/choose';
const DOCUMENT_GENERATOR_TUTORIAL =
  'developers/extend/apps/tutorials/document-generator/overview';

// Code samples are renamed too (see CODE_BRAND_WORD); these diagram lines give
// up a space so their right border stays aligned.
const DIAGRAM_RENAMES = [
  {
    from: '│   npm publish → appears in Twenty marketplace           │',
    to: `│   npm publish → appears in ${BRAND_NAME} marketplace          │`,
    count: 1,
  },
  {
    from: '│ Twenty API (records)       │',
    to: `│ ${BRAND_NAME} API (records)      │`,
    count: 1,
  },
];

// Each phrase must appear exactly `count` times across a language's published
// pages, so a sentence Twenty rewords fails the import instead of going out
// unchanged.
export const PHRASE_REPLACEMENTS = {
  fr: [
    {
      from: 'Twenty est une plateforme CRM complète. Voici ce que vous pouvez créer avec Twenty.',
      to: `${BRAND_NAME} réunit les processus commerciaux et opérationnels de votre entreprise sur une seule plateforme. Voici ce que vous pouvez y construire.`,
      count: 1,
    },
    // Twenty's French pages still ask to enable junction relations as a beta
    // feature; they no longer are one, and the English pages dropped the step.
    {
      from: "<Warning>\n**Fonctionnalité bêta**: Les relations de jonction doivent être activées dans **Paramètres → Communauté → Fonctionnalités** avant l'utilisation.\n</Warning>\n\n",
      to: '',
      count: 1,
    },
    {
      from: '<Warning>\n**Fonctionnalité bêta** : Les relations de jonction sont actuellement en bêta. Activez-les dans **Paramètres → Communauté → Fonctionnalités** avant de suivre ce guide.\n</Warning>\n\n',
      to: '',
      count: 1,
    },
    {
      from: '1. **Activer les relations de jonction dans les fonctionnalités bêta** : Allez dans **Paramètres → Communauté → Fonctionnalités** et activez **Relations de jonction**\n2. **Activer le mode avancé**',
      to: '1. **Activer le mode avancé**',
      count: 1,
    },
    {
      from: '* Rejoignez notre [Discord](https://discord.gg/UfGNZJfAG6) pour partager vos retours et vos demandes de fonctionnalités',
      to: `* [${FRENCH_CONTACT_TEAM}](${CONTACT_LINK}) pour partager vos retours et vos demandes de fonctionnalités`,
      count: 1,
    },
    {
      from: '  * Le nœud Delay consomme **1 crédit** lors de son exécution',
      to: '  * Le nœud Delay consomme **0,0001 crédit (0,0001 $)** lors de son exécution, comme une étape de workflow standard',
      count: 1,
    },
    {
      from: 'Vous avez besoin de configurer le SSO pour votre organisation ? [Trouvez un partenaire Twenty certifié](https://twenty.com/partners/list?categories=SOLUTIONING\\&ref=docs-sso) spécialisé en SSO et en gestion des identités. *(Vous préférez impliquer directement Twenty ? [contact@twenty.com](mailto:contact@twenty.com))*',
      to: `Vous avez besoin de configurer le SSO pour votre organisation ? [${FRENCH_CONTACT_TEAM}](${CONTACT_LINK}).`,
      count: 1,
    },
    {
      from: '[Trouver un partenaire certifié Vingt partenaires] (',
      to: `[${FRENCH_CONTACT_TEAM}](`,
      count: 3,
    },
    {
      from: "Partagez votre cas d'utilisation sur nos [discussions GitHub](https://github.com/twentyhq/twenty/discussions) pour aider à prioriser cette fonctionnalité.",
      to: `Partagez votre cas d'utilisation avec [l'équipe ${BRAND_NAME}](${CONTACT_LINK}) pour aider à prioriser cette fonctionnalité.`,
      count: 1,
    },
    {
      from: "Rejoignez nos [discussions GitHub](https://github.com/twentyhq/twenty/discussions) pour partager votre cas d'utilisation et aider à prioriser cette fonctionnalité.",
      to: `[${FRENCH_CONTACT_TEAM}](${CONTACT_LINK}) pour partager votre cas d'utilisation et aider à prioriser cette fonctionnalité.`,
      count: 1,
    },
    {
      from: '* Suivez notre [GitHub](https://github.com/twentyhq/twenty) pour les mises à jour de développement\n',
      to: '',
      count: 1,
    },
    {
      from: "Consultez nos [services de mise en œuvre](/fr/user-guide/getting-started/capabilities/implementation-services) pour obtenir de l'aide pour la conception de modèles de données complexes.",
      to: `[${FRENCH_CONTACT_TEAM}](${CONTACT_LINK}) pour obtenir de l'aide pour la conception de modèles de données complexes.`,
      count: 1,
    },
    {
      from: 'Nos [partenaires d’implémentation](/fr/user-guide/getting-started/capabilities/implementation-services) peuvent vous aider à exécuter ces scripts si nécessaire.',
      to: `[L'équipe ${BRAND_NAME}](${CONTACT_LINK}) peut vous aider à exécuter ces scripts si nécessaire.`,
      count: 1,
    },
    {
      from: 'Contactez-nous à [contact@twenty.com](mailto:contact@twenty.com) ou découvrez nos [services de mise en œuvre](/fr/user-guide/getting-started/capabilities/implementation-services).',
      to: `Contactez-nous à [${CONTACT_EMAIL}](${CONTACT_LINK}).`,
      count: 1,
    },
    // Developer pages. Self-hosting and contributing are not published, and
    // Twenty Cloud's API host and function domains do not exist for Upshift.
    {
      from: 'description: Créez des applications, utilisez l\'API, auto-hébergez ou contribuez à la base de code.\n---\n\nimport { CardTitle } from "/snippets/card-title.mdx"\n\n<CardGroup cols={3}>',
      to: 'description: Créez des applications et utilisez l\'API.\n---\n\nimport { CardTitle } from "/snippets/card-title.mdx"\n\n<CardGroup cols={2}>',
      count: 1,
    },
    {
      from: '| Cloud         | `https://api.twenty.com/` |\n',
      to: '',
      count: 1,
    },
    {
      from: '| **Cloud**        | `https://api.twenty.com` |\n',
      to: '',
      count: 1,
    },
    {
      from: "). Sur Twenty Cloud, `RestApiClient`\nrésout le chemin via le domaine des fonctions de l'espace de travail.",
      to: ').',
      count: 1,
    },
    {
      from: '> **Sur Twenty Cloud, les fonctions logiques déclenchées par HTTP sont servies sur un domaine dédié par espace de travail** à l’adresse `https://\\<your-workspace-subdomain>.withtwenty.com\\<path>`. ',
      to: '> ',
      count: 1,
    },
    {
      from: 'Sur Twenty Cloud, les routes d’application sont servies sur un domaine dédié par espace de travail (`https://\\<your-workspace-subdomain>.withtwenty.com`, ou le domaine public principal de l’application lorsqu’il est configuré) afin que',
      to: 'Les routes d’application peuvent être servies sur un domaine dédié afin que',
      count: 1,
    },
    {
      from: "      owner: 'twentyhq',\n      repo: 'twenty',\n",
      to: "      owner: 'exceev-technology',\n      repo: 'upshift',\n",
      count: 1,
    },
    {
      from: "  author: 'Twenty',\n",
      to: `  author: '${COMPANY_NAME}',\n`,
      count: 1,
    },
    {
      from: "  websiteUrl: 'https://docs.twenty.com/fr/developers/extend/apps',\n",
      to: `  websiteUrl: '${DOCS_URL}/${DOCUMENT_GENERATOR_TUTORIAL}',\n`,
      count: 1,
    },
    {
      from: `[ouvrez un ticket](${TWENTY_ISSUE_LINK})`,
      to: `[contactez l'équipe ${BRAND_NAME}](${CONTACT_LINK})`,
      count: 1,
    },
    {
      from: `[ouvrir un ticket](${TWENTY_ISSUE_LINK})`,
      to: `[contacter l'équipe ${BRAND_NAME}](${CONTACT_LINK})`,
      count: 1,
    },
    // Twenty's French translation turned the brand into "vingt", package
    // names included.
    {
      from: '`vingt-ui/input` et `vingt-ui/display`',
      to: '`twenty-ui/input` et `twenty-ui/display`',
      count: 1,
    },
    {
      from: '`vingt-sdk/front-component`',
      to: '`twenty-sdk/front-component`',
      count: 1,
    },
    {
      from: '; vingt résolvent les identifiants',
      to: `; ${BRAND_NAME} résout les identifiants`,
      count: 1,
    },
    // The scaffolded CI workflows call reusable actions from Twenty's
    // repository; the pages describe what they do without naming it.
    {
      from: ' à l’aide de l’action composite `twentyhq/twenty/.github/actions/spawn-twenty-app-dev-test@main`',
      to: '',
      count: 1,
    },
    {
      from: '2. Exécute `twentyhq/twenty/.github/actions/deploy-twenty-app@main` — l’équivalent CI de',
      to: '2. Exécute l’équivalent CI de',
      count: 1,
    },
    {
      from: '3. Exécute `twentyhq/twenty/.github/actions/install-twenty-app@main` afin que la version nouvellement déployée soit installée',
      to: '3. Installe la version nouvellement déployée',
      count: 1,
    },
    {
      from: ' des actions dans le dépôt `twentyhq/twenty` sont',
      to: ' des actions sont',
      count: 1,
    },
    {
      from: ' (via l’action `twentyhq/twenty/.github/actions/spawn-twenty-app-dev-test`)',
      to: '',
      count: 1,
    },
    ...DIAGRAM_RENAMES,
  ],
  en: [
    {
      from: "Twenty is a full-featured CRM platform. Here's what you can build with it.",
      to: `${BRAND_NAME} brings your company's sales and operations processes together on one platform. Here's what you can build with it.`,
      count: 1,
    },
    {
      from: '- Join our [Discord](https://discord.gg/UfGNZJfAG6) to share feedback and feature requests',
      to: `- [${CONTACT_TEAM}](${CONTACT_LINK}) to share feedback and feature requests`,
      count: 1,
    },
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
    // Developer pages. Self-hosting and contributing are not published, and
    // Twenty Cloud's API host and function domains do not exist for Upshift.
    {
      from: 'description: Build apps, use the API, self-host, or contribute to the codebase.\n---\n\nimport { CardTitle } from "/snippets/card-title.mdx"\n\n<CardGroup cols={3}>',
      to: 'description: Build apps and use the API.\n---\n\nimport { CardTitle } from "/snippets/card-title.mdx"\n\n<CardGroup cols={2}>',
      count: 1,
    },
    {
      from: '| Cloud | `https://api.twenty.com/` |\n',
      to: '',
      count: 1,
    },
    {
      from: '| **Cloud** | `https://api.twenty.com` |\n',
      to: '',
      count: 1,
    },
    {
      from: "). On Twenty Cloud, `RestApiClient`\nresolves the path through the workspace's functions domain.",
      to: ').',
      count: 1,
    },
    {
      from: '> **On Twenty Cloud, HTTP-triggered logic functions are served on a dedicated per-workspace domain** at `https://<your-workspace-subdomain>.withtwenty.com<path>`. ',
      to: '> ',
      count: 1,
    },
    {
      from: "On Twenty Cloud, app routes are served on a dedicated per-workspace domain (`https://<your-workspace-subdomain>.withtwenty.com`, or the application's primary public domain when one is configured) so that",
      to: 'App routes can be served on a dedicated domain so that',
      count: 1,
    },
    {
      from: 'claiming on Twenty Cloud does not claim the app on a separate self-hosted server.',
      to: 'claiming on one server does not claim the app on another.',
      count: 1,
    },
    {
      from: ' This configuration is already managed for you on Twenty Cloud.',
      to: '',
      count: 1,
    },
    {
      from: ' — see\n[pricing](https://twenty.com/pricing).',
      to: '.',
      count: 1,
    },
    {
      from: "      owner: 'twentyhq',\n      repo: 'twenty',\n",
      to: "      owner: 'exceev-technology',\n      repo: 'upshift',\n",
      count: 1,
    },
    {
      from: "  author: 'Twenty',\n",
      to: `  author: '${COMPANY_NAME}',\n`,
      count: 1,
    },
    {
      from: "  websiteUrl: 'https://docs.twenty.com/developers/extend/apps',\n",
      to: `  websiteUrl: '${DOCS_URL}/en/${DOCUMENT_GENERATOR_TUTORIAL}',\n`,
      count: 1,
    },
    {
      from: `contact us on [Discord](https://discord.gg/cx5n4Jzs57) or [open a GitHub issue](${TWENTY_ISSUE_LINK}).`,
      to: `[contact the ${BRAND_NAME} team](${CONTACT_LINK}).`,
      count: 1,
    },
    {
      from: `[open an issue](${TWENTY_ISSUE_LINK})`,
      to: `[contact the ${BRAND_NAME} team](${CONTACT_LINK})`,
      count: 2,
    },
    // Twenty's agent skills are published from its own repository.
    {
      from: [
        '## Build with AI agent skills',
        '',
        'Official Twenty [Agent Skills](https://skills.sh/) teach coding agents the full app workflow: scaffolding, entity development, sync and deploy operations, and marketplace publishing. They install into Claude Code, Codex, Cursor, Pi, and any other harness supported by the `skills` CLI, and work against any Twenty instance, including self-hosted custom domains and localhost.',
        '',
        '```bash filename="Terminal"',
        '# List the available skills',
        'npx skills add https://github.com/twentyhq/twenty/tree/agent-skills --list',
        '',
        '# Install the scaffolding and development skills',
        'npx skills add https://github.com/twentyhq/twenty/tree/agent-skills --skill create-app',
        'npx skills add https://github.com/twentyhq/twenty/tree/agent-skills --skill develop-app',
        '```',
        '',
        'Each skill installs with its own reference docs. The `agent-skills` branch becomes available after the first successful publish from `main`; before that, follow the [local build instructions](https://github.com/twentyhq/twenty/tree/main/packages/twenty-agent-skills#local-development).',
        '',
        '',
      ].join('\n'),
      to: '',
      count: 1,
    },
    // The scaffolded CI workflows call reusable actions from Twenty's
    // repository; the pages describe what they do without naming it.
    {
      from: ' using the `twentyhq/twenty/.github/actions/spawn-twenty-app-dev-test@main` composite action',
      to: '',
      count: 1,
    },
    {
      from: '2. Runs `twentyhq/twenty/.github/actions/deploy-twenty-app@main` — the CI equivalent of',
      to: '2. Runs the CI equivalent of',
      count: 1,
    },
    {
      from: '3. Runs `twentyhq/twenty/.github/actions/install-twenty-app@main` so the newly deployed version is installed',
      to: '3. Installs the newly deployed version',
      count: 1,
    },
    {
      from: ' in the `twentyhq/twenty` repo are',
      to: ' are',
      count: 1,
    },
    {
      from: ' (via the `twentyhq/twenty/.github/actions/spawn-twenty-app-dev-test` action)',
      to: '',
      count: 1,
    },
    ...DIAGRAM_RENAMES,
  ],
};

// Applied in order to whole pages, code samples included, because readers
// copy those URLs.
export const URL_REPLACEMENTS = [
  [/https:\/\/twenty\.com\/partners[^\s)"']*/g, CONTACT_LINK],
  // The main branch of the Upshift repository mirrors Twenty's.
  [
    /https:\/\/github\.com\/twentyhq\/twenty\/(blob|tree)\/main\//g,
    `${REPOSITORY_URL}/$1/main/`,
  ],
  [/https:\/\/github\.com\/twentyhq\/twenty\/issues/g, CONTACT_LINK],
  [/https:\/\/www\.twenty\.com\/terms/g, TERMS_URL],
  [/twenty\.example\.com/g, EXAMPLE_SERVER_HOST],
  [/your-twenty-server\.com/g, EXAMPLE_SERVER_HOST],
  [/your-twenty-server/g, `your-${brand.slug}-server`],
  // The app names its scaffolding example the same way (apply-branding.mjs).
  [/my-twenty-app/g, `my-${brand.slug}-app`],
  [/My twenty app/g, `My ${brand.slug} app`],
  [/contact@twenty\.com/g, CONTACT_EMAIL],
  [/https:\/\/app\.twenty\.com[^\s)"']*/g, WEBSITE_URL],
  [/app\.twenty\.com/g, new URL(WEBSITE_URL).host],
  [/inbound\.twenty\.com/g, 'inbound.yourcompany.com'],
  [/twenty\.yourcompany\.com/g, EXAMPLE_SERVER_HOST],
  [/\b[\w-]+\.twenty\.com/g, EXAMPLE_SERVER_HOST],
  [/@twenty\.com/g, '@example.com'],
  [/https:\/\/twenty\.com/g, 'https://example.com'],
];

// Upshift covers the whole chain from first contact to reporting, CRM being
// only its first step, so prose that calls Upshift or its data "CRM" is
// reworded. Applied after the brand rename, outside code.
export const TERM_REPLACEMENTS = {
  fr: [
    [/\b(données|enregistrements?|objets) CRM\b/g, '$1'],
    [/\bexpérience CRM\b/g, 'expérience'],
    [/\bdirectement dans votre CRM\b/g, 'directement dans la plateforme'],
    [/\bque votre CRM reste\b/g, 'que vos données restent'],
    [/\b(dans|vers) votre CRM\b/g, `$1 ${BRAND_NAME}`],
    [/\bde votre CRM\b/g, `d'${BRAND_NAME}`],
    [/\bau CRM\b/g, `à ${BRAND_NAME}`],
    [/\bque votre CRM\b/g, `qu'${BRAND_NAME}`],
    [/\bLe CRM a\b/g, `${BRAND_NAME} a`],
    [new RegExp(`\\ble CRM ${BRAND_NAME}\\b`, 'g'), BRAND_NAME],
    [new RegExp(`\\b${BRAND_NAME} CRM\\b`, 'g'), BRAND_NAME],
    [/\ble CRM qui\b/g, 'la plateforme qui'],
  ],
  en: [
    [/\bCRM (data|records?|objects|experience|work)\b/g, '$1'],
    [/\bdirectly into your CRM\b/g, 'directly into the platform'],
    [/\b(in|into|to|within|through) your CRM\b/g, `$1 ${BRAND_NAME}`],
    [/\bto the CRM\b/g, `to ${BRAND_NAME}`],
    [/\byour CRM stays\b/g, 'your data stays'],
    [/\byour CRM changes\b/g, 'your data changes'],
    [/\bYour CRM can\b/g, `${BRAND_NAME} can`],
    [/\bThe CRM has\b/g, `${BRAND_NAME} has`],
    [new RegExp(`\\b${BRAND_NAME} CRM\\b`, 'g'), BRAND_NAME],
    [/\bthe CRM that\b/g, 'the platform that'],
  ],
};

// Lines where "CRM" is fine because it means another product or the
// prospecting step of Upshift; any other mention fails the import.
export const CRM_ALLOWED_CONTEXTS = [
  /\b(other|any|current|previous|old|traditional|most) CRMs?\b/i,
  /\bCRM Automations\b/,
  /\b(autres|n'importe quel|ancien|plupart des) CRM\b/i,
  /\bCRM (actuel|précédent|traditionnels)\b/i,
  /\bAutomatisations CRM\b/,
  /\|\s*(Your|Votre) CRM\s*\|/,
  /\b(Prospection et|Prospecting and) CRM\b/,
];
