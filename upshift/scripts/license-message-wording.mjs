import { createHash } from 'node:crypto';

const NEUTRAL_MESSAGE = 'This feature is not enabled.';

// Rewritten by message id in every compiled server catalog, reusing each locale's own text so no translation is lost.
// Not listed: Organization key activation errors (that flow is removed), the two custom role messages with a
// role placeholder (custom roles are always granted while billing is off) and the "paid plan" errors (billing only).
const LICENSE_MESSAGES = [
  {
    message:
      'Workspace limit reached. A valid Organization key is required to create more workspaces.',
    keepFirstSentence: true,
  },
  {
    message:
      'This feature is complimentary up to {MAX_SEATS_WITHOUT_ENTERPRISE_KEY} seats. Your instance is above that, so an Organization key is required.',
    keepFirstSentence: true,
  },
  { message: 'Audit logs require an Organization subscription.', replaceWith: NEUTRAL_MESSAGE },
  {
    message: 'Changing log retention requires an Organization subscription.',
    replaceWith: NEUTRAL_MESSAGE,
  },
  { message: 'Validation rules require the Organization plan.', replaceWith: NEUTRAL_MESSAGE },
  {
    message: 'Limits scoped below the workspace require the Organization plan.',
    replaceWith: NEUTRAL_MESSAGE,
  },
  { message: 'Custom roles are part of the Organization plan.', replaceWith: NEUTRAL_MESSAGE },
  { message: 'Email group requires an Enterprise plan.', replaceWith: NEUTRAL_MESSAGE },
  { message: 'Enterprise validity token is not valid.', replaceWith: NEUTRAL_MESSAGE },
];

// Same id Lingui derives for a message without context
export const toLinguiMessageId = (message) =>
  createHash('sha256').update(`${message}\u001F`).digest('base64').slice(0, 6);

export const LICENSE_MESSAGE_REWRITES = LICENSE_MESSAGES.map(
  ({ message, keepFirstSentence, replaceWith }) => ({
    id: toLinguiMessageId(message),
    message,
    ...(keepFirstSentence
      ? { keepFirstSentence }
      : { replaceWith: toLinguiMessageId(replaceWith) }),
  }),
);
