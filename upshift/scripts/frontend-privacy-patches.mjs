const FRONT_MODULES = 'packages/twenty-front/src/modules';

// Removing the mounts prevents persisted instance settings from enabling browser telemetry.
export const FRONTEND_PRIVACY_PATCHES = [
  {
    file: `${FRONT_MODULES}/app/components/RootAppProviders.tsx`,
    replacements: [
      {
        from: "import { TrackPageViewEffect } from '@/analytics/components/TrackPageViewEffect';\n",
        to: '',
      },
      {
        pattern: /^[ \t]*<TrackPageViewEffect \/>[ \t]*\r?\n/gm,
        to: '',
      },
    ],
  },
  {
    file: `${FRONT_MODULES}/app/components/WorkspaceAppProviders.tsx`,
    replacements: [
      {
        from: "import { TrackPageViewEffect } from '@/analytics/components/TrackPageViewEffect';\n",
        to: '',
      },
      {
        pattern: /^[ \t]*<TrackPageViewEffect \/>[ \t]*\r?\n/gm,
        to: '',
      },
    ],
  },
  {
    file: `${FRONT_MODULES}/error-handler/components/ExceptionHandlerProvider.tsx`,
    replacements: [
      {
        from: "import { SentryInitEffect } from '@/error-handler/components/SentryInitEffect';\n",
        to: '',
      },
      {
        pattern: /^[ \t]*<SentryInitEffect \/>[ \t]*\r?\n/gm,
        to: '',
      },
    ],
  },
];
