import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { applyReplacements } from './patch-replacements.mjs';
import { IMAGE_VERSION_FILE, VERSION_PATCHES } from './version-patches.mjs';

const SOURCE_ROOT =
  process.env.UPSHIFT_PRIVACY_SOURCE_ROOT ??
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const patchedSource = (file) => {
  const patch = VERSION_PATCHES.find((candidate) => candidate.file === file);
  const result = applyReplacements(
    readFileSync(path.join(SOURCE_ROOT, file), 'utf8'),
    patch.replacements,
  );
  assert.deepEqual(result.failures, [], file);
  return result.content;
};

const runEntrypoint = (context, { imageVersion, environmentVersion }) => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'upshift-version-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const versionFile = path.join(directory, 'upshift-version');
  const entrypoint = path.join(directory, 'entrypoint.sh');
  writeFileSync(versionFile, imageVersion);
  writeFileSync(
    entrypoint,
    patchedSource('packages/twenty-docker/twenty/entrypoint.sh')
      .split(IMAGE_VERSION_FILE)
      .join(versionFile),
  );

  const environment = {
    PATH: process.env.PATH,
    DISABLE_DB_MIGRATIONS: 'true',
    DISABLE_CRON_JOBS_REGISTRATION: 'true',
    ...(environmentVersion !== undefined && { APP_VERSION: environmentVersion }),
  };
  const result = spawnSync(
    'sh',
    [entrypoint, 'sh', '-c', 'printf "%s" "$APP_VERSION"'],
    { env: environment, encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
  return { log: result.stdout, appVersion: result.stdout.split('\n').at(-1) };
};

test('the Dockerfile stores the build version in the image right after setting APP_VERSION', () => {
  assert.match(
    patchedSource('packages/twenty-docker/twenty/Dockerfile'),
    /\nARG APP_VERSION\nENV APP_VERSION=\$APP_VERSION\nRUN printf '%s' "\$APP_VERSION" > \/app\/upshift-version\n/,
  );
});

test('a stale APP_VERSION from the deployment is replaced by the image version', (context) => {
  const { log, appVersion } = runEntrypoint(context, {
    imageVersion: '2.47.0',
    environmentVersion: '2.46.0',
  });
  assert.equal(appVersion, '2.47.0');
  assert.match(log, /Ignoring APP_VERSION=2\.46\.0 from the environment, this image is 2\.47\.0/);
});

test('a missing APP_VERSION gets the image version without a warning', (context) => {
  const { log, appVersion } = runEntrypoint(context, { imageVersion: '2.47.0' });
  assert.equal(appVersion, '2.47.0');
  assert.doesNotMatch(log, /Ignoring/);
});

test('an image built without a version keeps the deployment APP_VERSION', (context) => {
  const { appVersion } = runEntrypoint(context, {
    imageVersion: '',
    environmentVersion: '2.46.0',
  });
  assert.equal(appVersion, '2.46.0');
});
