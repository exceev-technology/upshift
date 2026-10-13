# Reporting audit

Reviewed the UpShift release layer against Twenty `twenty/v2.46.0`
(`9070979232c4f37165108a2eb5a4042e0cfdc3d6`) and the source on `upshift-main`.
The release builds a fresh upstream checkout with this layer applied; inspecting
the unpatched monorepo alone does not describe the shipped image.

## Findings and changes

| Path | Finding before this change | Protection in this change |
| --- | --- | --- |
| Signup telemetry | The existing layer already blocks the Twenty telemetry sender regardless of configuration | Existing guard retained |
| Browser pageviews | Anonymous and authenticated visits set a session cookie and submit pageviews to the instance even with analytics disabled | Remove both tracking mounts and disable the server analytics mutation |
| Sentry | Environment variables can enable backend errors, traces, profiles and AI input/output capture; saved frontend DSNs can enable browser replay | Block initialization on both sides, return an empty frontend DSN and use console exceptions |
| Remote metrics | Environment variables can enable OTLP exports independently of the telemetry setting | Disable the remote exporter; retain local console and Prometheus metrics |
| Enterprise API | Licence refresh and seat reporting send instance identifiers, administrator email and usage counts despite telemetry being off | Block all six remote operations before metadata/network access; portal/checkout return null, activation rejects before persisting a key, and self-hosted purchase/activation UI is removed |
| Release smoke test | Its baseline ignored connections made during startup | Validate the sink before starting the app and inspect the entire subsequent log |

Company enrichment, Twenty-hosted logos, prefilled avatars and the default help
search proxy were already neutralized by the layer. These protections remain.
Enterprise local signature verification and expiration checks remain unchanged;
this change does not grant enterprise features. Remote activation, renewal,
checkout, portal, subscription status and release operations are unavailable.

## Verification

- Six source-based regression tests execute reporting paths with dependencies
  stubbed and reporting settings enabled. They pass against both reviewed sources.
- The complete layer applies successfully to both source trees, including the
  census of Twenty-owned references. New mounts of the removed browser reporting
  components also fail that census.
- Release CI runs these tests before applying the layer and enables telemetry,
  analytics, Sentry and OTLP settings during its connection-sink smoke test.

The local audit did not build or run the full Docker image, execute the browser,
or run the monorepo typecheck. The registry rejected both anonymous and available
authenticated inspection, so the existing image was not directly inspected.

The [October 10 release run](https://github.com/exceev-technology/upshift/actions/runs/38053259056)
records publication of `v2.46.0` and `v2.46` from UpShift revision
`20967c0e439226022de7413005d7203e5bb84286`, with image index digest
`sha256:e46fd8ee085165140703af7254b796ecba84c8f1c486afd92438c268b8eb430a`.
That build predates these changes. This is historical release-log evidence,
not confirmation of what the mutable tag currently resolves to.

## Deployment boundary

Merge this change, rebuild `twenty/v2.46.0` through **Upshift Release** with
`force=true`, and verify the new revision, passing image smoke test and digest.
Deploy that digest. A local commit does not modify the published image.

These guards cover built-in reporting. Local audit logs and usage accounting
remain available. User-configured integrations, workflows, installed apps and
external content can still make network requests; this is not a general egress
firewall. The API smoke test covers its configured destinations and flows, not
all browser actions or every possible third-party dependency.

## Optional operator-owned monitoring

The additive `upshift/observability` layer introduces a separate opt-in Node preload for reviewed HTTP completion logs, server request spans and bounded request/process metrics. It defaults off and accepts only a local collector origin. It does not reopen any upstream Sentry, OTLP, telemetry, browser analytics or enterprise-reporting path. See [coverage and deployment limitations](observability/README.md). Tests check disabled export, sensitive-field exclusion, tenant isolation, gzip/ingestion bounds and storage-budget gates.
