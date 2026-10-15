export const IMAGE_VERSION_FILE = '/app/upshift-version';

// A deployment's environment overrides the image's APP_VERSION, so a value left over from an
// older release made the server report, and upgrade against, the wrong version
export const VERSION_PATCHES = [
  {
    file: 'packages/twenty-docker/twenty/Dockerfile',
    replacements: [
      {
        from: 'ENV APP_VERSION=$APP_VERSION',
        to: [
          'ENV APP_VERSION=$APP_VERSION',
          `RUN printf '%s' "$APP_VERSION" > ${IMAGE_VERSION_FILE}`,
        ].join('\n'),
      },
    ],
  },
  {
    file: 'packages/twenty-docker/twenty/entrypoint.sh',
    replacements: [
      {
        from: '#!/bin/sh\nset -e\n',
        to: [
          '#!/bin/sh',
          'set -e',
          '',
          `if [ -s ${IMAGE_VERSION_FILE} ]; then`,
          `    image_version=$(cat ${IMAGE_VERSION_FILE})`,
          '    if [ -n "${APP_VERSION}" ] && [ "${APP_VERSION}" != "${image_version}" ]; then',
          '        echo "Ignoring APP_VERSION=${APP_VERSION} from the environment, this image is ${image_version}"',
          '    fi',
          '    export APP_VERSION="${image_version}"',
          'fi',
          '',
        ].join('\n'),
      },
    ],
  },
];
