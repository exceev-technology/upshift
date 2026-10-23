import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const MAX_DOCS_VERSIONS = 10;

export const OLDEST_DOCS_MINOR = '2.47';

const RELEASE_TAG = /^upshift\/v(\d+)\.(\d+)\.(\d+)$/;

const compareMinors = (version, otherVersion) => {
  const [major, minor] = version.split('.').map(Number);
  const [otherMajor, otherMinor] = otherVersion.split('.').map(Number);

  return major - otherMajor || minor - otherMinor;
};

// A phrase rule or an exclusion with `since` or `until: 'X.Y'` only covers the
// docs of versions from or up to that minor.
export const isRuleForVersion = ({ since, until }, version) =>
  (since === undefined || compareMinors(version, since) >= 0) &&
  (until === undefined || compareMinors(version, until) <= 0);

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

    if (compareMinors(`${major}.${minor}`, OLDEST_DOCS_MINOR) < 0) {
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
