import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../docker',
);
const configuration = JSON.parse(
  execFileSync(
    'docker',
    [
      'compose',
      '-f',
      path.join(directory, 'docker-compose.yml'),
      '-f',
      path.join(directory, 'docker-compose.monitoring.yml'),
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
const output = `${JSON.stringify(configuration, null, 2)}\n`;
const destination = path.join(
  directory,
  'docker-compose.coolify-monitoring.yml',
);
if (process.argv.includes('--check')) {
  if (readFileSync(destination, 'utf8') !== output)
    throw new Error('Regenerate the Coolify monitoring compose file');
} else writeFileSync(destination, output);
