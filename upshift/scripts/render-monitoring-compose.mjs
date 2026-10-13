import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../docker',
);
const renderConfiguration = (filenames) => {
  const configuration = JSON.parse(
    execFileSync(
      'docker',
      [
        'compose',
        ...filenames.flatMap((filename) => ['-f', path.join(directory, filename)]),
        'config',
        '--no-interpolate',
        '--no-env-resolution',
        '--no-path-resolution',
        '--format',
        'json',
      ],
      { encoding: 'utf8' },
    ),
  );
  // Explicit generated project names would make different clients share networks or volumes.
  delete configuration.name;
  for (const definitions of [configuration.networks, configuration.volumes]) {
    for (const definition of Object.values(definitions ?? {}))
      delete definition.name;
  }
  return configuration;
};
const configuration = renderConfiguration([
  'docker-compose.yml',
  'docker-compose.monitoring.yml',
]);
const destination = path.join(
  directory,
  'docker-compose.coolify-monitoring.yml',
);
if (process.argv.includes('--check')) {
  // Normalize both inputs with the same Compose version before comparing effective settings.
  assert.deepStrictEqual(
    renderConfiguration(['docker-compose.coolify-monitoring.yml']),
    configuration,
    'Regenerate the Coolify monitoring compose file',
  );
} else writeFileSync(destination, `${JSON.stringify(configuration, null, 2)}\n`);
