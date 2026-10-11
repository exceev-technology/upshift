import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  OBSERVABILITY_PATCHES,
  installObservabilityInstrumentation,
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
    for (const { from, to, count = 1 } of patch.replacements) {
      assert.equal(source.split(from).length - 1, count);
      source = source.split(from).join(to);
    }
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

test('installer packages only the reviewed runtime files without altering upstream dependencies', (context) => {
  const checkout = mkdtempSync(
    path.join(os.tmpdir(), 'upshift-observability-'),
  );
  context.after(() => rmSync(checkout, { recursive: true, force: true }));
  installObservabilityInstrumentation(checkout);
  for (const file of ['preload.mjs', 'telemetry.mjs']) {
    assert.equal(
      readFileSync(
        path.join(
          checkout,
          'packages/twenty-server/upshift-observability',
          file,
        ),
        'utf8',
      ),
      readFileSync(
        path.join(
          REPOSITORY_ROOT,
          'upshift/observability/instrumentation',
          file,
        ),
        'utf8',
      ),
    );
  }
});
