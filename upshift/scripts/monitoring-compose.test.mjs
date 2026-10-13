import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const compose = JSON.parse(readFileSync(
  new URL('../docker/docker-compose.coolify-monitoring.yml', import.meta.url),
  'utf8',
));
const command = compose.services.alloy.command[0]
  .replaceAll('$$', '$')
  .replace(/exec \/bin\/alloy run[^\n]+/, 'printf "%s" "$UPSHIFT_MONITORING_URL"');

test('collector startup normalizes a root slash and rejects non-origin URLs', () => {
  for (const origin of ['https://monitoring.example.com', 'https://monitoring.example.com:8443', 'https://[::1]:8443']) {
    for (const url of [origin, `${origin}/`]) {
      const result = spawnSync('/bin/sh', ['-ec', command], {
        env: { ...process.env, UPSHIFT_MONITORING_URL: url },
        encoding: 'utf8',
      });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout, origin);
    }
  }
  for (const url of ['', 'http://example.com', 'https://', 'https:///', 'https://:8443',
    'https://example.com/path', 'https://example.com//', 'https://example.com?x=1',
    'https://example.com#fragment', 'https://secret@example.com', 'https://example.com\\path',
    'https://example.com with-space']) {
    const result = spawnSync('/bin/sh', ['-ec', command], {
      env: { ...process.env, UPSHIFT_MONITORING_URL: url },
      encoding: 'utf8',
    });
    assert.notEqual(result.status, 0, url);
    assert.equal(result.stdout, '');
    assert.doesNotMatch(result.stderr, /secret/);
  }
});
