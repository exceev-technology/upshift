import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const INSTRUMENTATION_DIRECTORY = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../observability/instrumentation',
);
const INSTRUMENTATION_FILES = ['preload.mjs', 'telemetry.mjs'];

export const OBSERVABILITY_PATCHES = [
  {
    file: 'packages/twenty-docker/twenty/Dockerfile',
    replacements: [
      {
        from: 'ENV NODE_ENV=production',
        to: [
          'ENV NODE_ENV=production',
          '',
          'COPY --chown=1000 ./packages/twenty-server/upshift-observability /app/upshift-observability',
        ].join('\n'),
      },
      {
        from: 'CMD ["node", "dist/main"]',
        to: 'CMD ["node", "--import=/app/upshift-observability/preload.mjs", "dist/main"]',
      },
    ],
  },
  {
    file: 'packages/twenty-server/package.json',
    replacements: ['dist/main', 'dist/queue-worker/queue-worker'].map(
      (entrypoint) => ({
        from: `"node ${entrypoint}"`,
        to: `"node --import=/app/upshift-observability/preload.mjs ${entrypoint}"`,
      }),
    ),
  },
];

export const readObservabilityInstrumentation = (
  twentyRoot,
  sourceDirectory = INSTRUMENTATION_DIRECTORY,
) => {
  const targetDirectory = path.join(
    twentyRoot,
    'packages/twenty-server/upshift-observability',
  );
  return INSTRUMENTATION_FILES.map((file) => ({
    filePath: path.join(targetDirectory, file),
    content: readFileSync(path.join(sourceDirectory, file)),
  }));
};
