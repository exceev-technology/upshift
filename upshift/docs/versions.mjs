import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const MAX_DOCS_VERSIONS = 10;

export const OLDEST_DOCS_MINOR = '2.47';

const RELEASE_TAG = /^upshift\/v(\d+)\.(\d+)\.(\d+)$/;
const [OLDEST_MAJOR, OLDEST_MINOR] = OLDEST_DOCS_MINOR.split('.').map(Number);

const isDocumented = (major, minor) =>
  major > OLDEST_MAJOR || (major === OLDEST_MAJOR && minor >= OLDEST_MINOR);

const minorParts = (version) => version.split('.').slice(0, 2).map(Number);

// A phrase rule with `until: 'X.Y'` only rewrites the docs of versions up to that minor.
export const isRuleForVersion = ({ until }, version) => {
  if (until === undefined) {
    return true;
  }

  const [major, minor] = minorParts(version);
  const [untilMajor, untilMinor] = minorParts(until);

  return major < untilMajor || (major === untilMajor && minor <= untilMinor);
};

export const versionPath = (version) =>
  `v${version.split('.').slice(0, 2).join('.')}`;

export const selectDocsVersions = (releaseTags) => {
  const latestByMinor = new Map();

  for (const tag of releaseTags) {
    const match = tag.match(RELEASE_TAG);

    if (match === null) {
      continue;
    }

    const [major, minor, patch] = match.slice(1).map(Number);

    if (!isDocumented(major, minor)) {
      continue;
    }

    const latest = latestByMinor.get(`${major}.${minor}`);

    if (latest === undefined || patch > latest[2]) {
      latestByMinor.set(`${major}.${minor}`, [major, minor, patch]);
    }
  }

  return [...latestByMinor.values()]
    .sort(
      ([majorA, minorA], [majorB, minorB]) => majorB - majorA || minorB - minorA,
    )
    .slice(0, MAX_DOCS_VERSIONS)
    .map((parts) => parts.join('.'));
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const tags = readFileSync(0, 'utf8')
    .split('\n')
    .map((tag) => tag.trim())
    .filter((tag) => tag !== '');

  console.log(selectDocsVersions(tags).join('\n'));
}
