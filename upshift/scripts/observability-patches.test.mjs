import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { applyReplacements } from './patch-replacements.mjs';

import {
  OBSERVABILITY_PATCHES,
  readObservabilityInstrumentation,
} from './observability-patches.mjs';

const REPOSITORY_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

test('Dockerfile preload patch matches upstream exactly and is inherited by server and worker images', () => {
  for (const patch of OBSERVABILITY_PATCHES) {
    let source = readFileSync(
      path.join(
        process.env.UPSHIFT_PRIVACY_SOURCE_ROOT ?? REPOSITORY_ROOT,
        patch.file,
      ),
      'utf8',
    );
    const result = applyReplacements(source, patch.replacements);
    assert.deepEqual(result.failures, [], patch.file);
    source = result.content;
    if (patch.file.endsWith('Dockerfile')) {
      assert.match(
        source,
        /COPY --chown=1000 .*upshift-observability \/app\/upshift-observability/,
      );
      assert.match(
        source,
        /CMD \["node", "--import=\/app\/upshift-observability\/preload.mjs", "dist\/main"\]/,
      );
      assert.doesNotMatch(source, /ENV NODE_OPTIONS=.*upshift-observability/);
    } else {
      const scripts = JSON.parse(source).scripts;
      assert.match(
        scripts['worker:prod'],
        /node --import=.* dist\/queue-worker\/queue-worker/,
      );
      assert.match(scripts['start:prod'], /node --import=.* dist\/main/);
      assert.doesNotMatch(scripts['command:prod'], /upshift-observability/);
    }
  }
});

test('instrumentation preparation reads only reviewed files without writing to the checkout', (context) => {
  const checkout = mkdtempSync(
    path.join(os.tmpdir(), 'upshift-observability-'),
  );
  context.after(() => rmSync(checkout, { recursive: true, force: true }));
  const files = readObservabilityInstrumentation(checkout);
  assert.equal(files.length, 2);
  for (const file of ['preload.mjs', 'telemetry.mjs']) {
    const target = path.join(checkout, 'packages/twenty-server/upshift-observability', file);
    assert.equal(
      files.find(({ filePath }) => filePath === target).content.toString(),
      readFileSync(
        path.join(
          REPOSITORY_ROOT,
          'upshift/observability/instrumentation',
          file,
        ),
        'utf8',
      ),
    );
    assert.equal(existsSync(target), false);
  }
});

test('missing instrumentation source fails preparation without a partial installation', (context) => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'upshift-missing-instrumentation-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  writeFileSync(path.join(directory, 'preload.mjs'), 'fixture');
  const checkout = path.join(directory, 'checkout');
  assert.throws(() => readObservabilityInstrumentation(checkout, directory), /ENOENT/);
  assert.equal(existsSync(checkout), false);
});
