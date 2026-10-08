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
export const COMPANY_NAME = brand.companyName;
export const COMPANY_URL = 'https://exceev.com';
export const DEMO_URL =
  'https://calcom.exceev.com/team/exceev-technology/upshift-intro';
export const SOCIALS = {
  linkedin: 'https://linkedin.com/company/exceev-consulting',
  x: 'https://x.com/ExceevConseil',
  facebook: 'https://facebook.com/exceevconsulting',
  github: 'https://github.com/exceev-consulting',
};

// The accent of upshiftcloud.com, in its light and dark themes.
export const BRAND_COLORS = {
  primary: '#1A1BB5',
  light: '#9192F0',
  dark: '#1A1BB5',
};

export const KEPT_SECTIONS = ['getting-started', 'user-guide'];

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
];

const EXAMPLE_SERVER_HOST = 'crm.yourcompany.com';
const CONTACT_TEAM = `Contact the ${BRAND_NAME} team`;
const FRENCH_CONTACT_TEAM = `Contactez l'équipe ${BRAND_NAME}`;

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
  ],
  en: [
    {
      from: "Twenty is a full-featured CRM platform. Here's what you can build with it.",
      to: `${BRAND_NAME} brings your company's sales and operations processes together on one platform. Here's what you can build with it.`,
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
  ],
};

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

// Upshift covers the whole chain from first contact to reporting, CRM being
// only its first step, so prose that calls Upshift or its data "CRM" is
// reworded. Applied after the brand rename, outside code.
export const TERM_REPLACEMENTS = {
  fr: [
    [/\b(données|enregistrements|objets) CRM\b/g, '$1'],
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
    [/\bCRM (data|records|objects|experience|work)\b/g, '$1'],
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
