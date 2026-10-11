import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { hashToken } from '../gateway/config.mjs';
const directory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const temporary = mkdtempSync(path.join(tmpdir(), 'upshift-monitoring-smoke-'));
const project = `upshift-monitoring-test-${randomBytes(4).toString('hex')}`;
const token = randomBytes(32).toString('base64url');
const otherToken = randomBytes(32).toString('base64url');
const environmentFile = path.join(temporary, '.env');
writeFileSync(
  environmentFile,
  [
    `TEST_TOKEN=${token}`,
    `TEST_OTHER_TOKEN=${otherToken}`,
    'S3_ACCESS_KEY_ID=monitoring-test',
    `S3_SECRET_ACCESS_KEY=${randomBytes(32).toString('hex')}`,
    `GRAFANA_ADMIN_PASSWORD=${randomBytes(32).toString('hex')}`,
    'GRAFANA_URL=http://grafana:3000',
    'ALERT_WEBHOOK_URL=http://alert-sink:8080/alerts',
    `MONITORING_TENANTS_JSON=${JSON.stringify([
      {
        id: 'client-a',
        tokenSha256: hashToken(token),
        budgetBytes: 2147483648,
      },
      {
        id: 'client-b',
        tokenSha256: hashToken(otherToken),
        budgetBytes: 1048576,
      },
    ])}`,
  ].join('\n'),
  { mode: 0o600 },
);
const compose = async (...argumentsList) =>
  new Promise((resolve, reject) => {
    const child = spawn(
      'docker',
      [
        'compose',
        '-p',
        project,
        '--env-file',
        environmentFile,
        '-f',
        path.join(directory, 'compose.yml'),
        '-f',
        path.join(directory, 'test/compose.yml'),
        ...argumentsList,
      ],
      {
        stdio: 'inherit',
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          DOCKER_HOST: process.env.DOCKER_HOST,
          DOCKER_CONTEXT: process.env.DOCKER_CONTEXT,
        },
      },
    );
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(`Docker Compose ${argumentsList[0]} failed (${code})`),
          ),
    );
  });
try {
  await compose('config', '--quiet');
  await compose('up', '-d', '--build');
  await compose(
    'run',
    '--rm',
    '--no-deps',
    'alloy',
    'validate',
    '/etc/alloy/config.alloy',
  );
  await compose(
    'exec',
    '-T',
    'prometheus',
    'promtool',
    'check',
    'config',
    '/etc/prometheus/prometheus.yml',
  );
  await compose(
    'exec',
    '-T',
    'prometheus',
    'promtool',
    'test',
    'rules',
    '/etc/prometheus/alerts.test.yml',
  );
  await compose(
    'exec',
    '-T',
    'alertmanager',
    'amtool',
    'check-config',
    '/etc/alertmanager/config.yml',
  );
  await compose('run', '--rm', '--no-deps', 'runner');
} catch (error) {
  await compose(
    'logs',
    '--tail=20',
    'gateway',
    'loki',
    'tempo',
    'mimir',
    'alloy',
  );
  throw error;
} finally {
  await compose('down', '-v', '--remove-orphans');
  rmSync(temporary, { recursive: true, force: true });
}
