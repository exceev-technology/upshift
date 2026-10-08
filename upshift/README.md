# Upshift layer

Everything that turns Twenty into Upshift lives in this folder. No Twenty file is edited in git: the layer is applied to a fresh Twenty checkout at build time. That is what keeps `upshift-main` conflict-free when Twenty ships new versions.

```
upshift/
  branding/
    brand.json        name, URLs and legal links used everywhere
    logo.svg          source logo (rounded), logo-square.svg, mark.svg
    assets/           logo-email.png, logo-512.png, social-card.png (served from GitHub)
    overlay/          files copied over Twenty's: app icons, onboarding logo, email footer
  scripts/
    apply-branding.mjs   applies the layer to a checkout, then audits it
    brand-catalogs.mjs   rebrands compiled translations during the Docker build
    generate-icons.mjs   renders every app icon from logo.svg
    build-image.sh       builds the image locally, same steps as CI
  docker/
    docker-compose.yml, .env.example
```

## How a release is built

1. Check out Twenty at a version tag, for example `twenty/v2.45.6`. `scripts/latest-twenty-tag.sh` picks the highest `twenty/vX.Y.Z` tag; patch versions have no GitHub Release page but Twenty publishes them as Docker images, so Upshift ships them too.
2. Run `node upshift/scripts/apply-branding.mjs --root <checkout>`. It:
   - copies `branding/overlay/` over the checkout,
   - applies exact-match source patches (each patch expects a precise number of matches, so a moved string fails loudly instead of being skipped),
   - installs a translation hook that runs right after `lingui compile` and replaces "Twenty" with the brand name in every language,
   - turns off Yarn telemetry,
   - runs a reference census: any shipped file that references a Twenty-owned host or link outside the reviewed list (`REFERENCE_CENSUS`, each entry says why it is allowed) fails the build.

   Every change is prepared in memory first. If any patch point is missing, nothing is written.
3. Build Twenty's own Dockerfile (`--target twenty`) and push `ghcr.io/exceev-technology/upshift:vX.Y.Z`.

The [Upshift Release](../.github/workflows/upshift-release.yaml) workflow does this every morning for the newest Twenty tag, for amd64 and arm64, and skips versions that are already published. It publishes `vX.Y.Z`, moves `vX.Y` when that is the newest patch of its minor line, and moves `vX` and `latest` when it is the newest version overall. Before anything is published, the amd64 image goes through a smoke test (`scripts/smoke-test.mjs`): it starts with the compose file, checks the branding on the page, manifest and MCP server card, then signs up, creates a workspace and signs in through the API. Telemetry and Twenty icons are switched on in that environment on purpose, every Twenty-owned host resolves to a listener on the runner (`scripts/smoke-host-sink.mjs`), and the test fails if anything connects to it. On pull requests the same build and smoke test run without publishing.

The translation hook also verifies its own output on every build: message ids, placeholders and plural structure are unchanged, SDK commands such as `create-twenty-app` are untouched, and no message still says Twenty. The branding check runs it on the latest Twenty release with `--check-catalogs`. To build a specific version, run the workflow manually with `twenty-tag` set (for example `twenty/v2.43.0`). Tick `force` to rebuild an existing version.

## Syncing Twenty into upshift-main

`main` mirrors Twenty and only receives Twenty's commits.

```bash
gh repo sync exceev-technology/upshift --branch main
```

```bash
git switch main && git pull --ff-only
```

```bash
git switch -c sync/twenty-$(date +%Y-%m-%d) upshift-main && git merge main
```

Open a PR into `upshift-main`. The merge has no conflicts because Upshift only adds files. The [Upshift Branding Check](../.github/workflows/upshift-branding-check.yaml) workflow applies the layer to the PR and to the latest Twenty release, so you learn about broken patch points before the next release.

`upshift-main` modifies none of Twenty's files, so syncing never conflicts. The only path both sides could create is `.github/README.md`; if Twenty ever adds one, keep ours.

## GitHub Actions

Only `upshift-release.yaml` and `upshift-branding-check.yaml` run. Twenty's own workflows test, deploy and translate Twenty itself (several need Twenty's private secrets), so they are disabled in the repository settings. When a sync brings a new Twenty workflow, the `disable-twenty-workflows` job of the branding check disables it on the next push to `upshift-main`. It can run once on that same push before being disabled.

To turn one of Twenty's workflows back on:

```bash
gh workflow enable <file>.yaml --repo exceev-technology/upshift
```

The auto-disable job would switch it off again on the next push to `upshift-main`, so also exclude it in that job's filter.

## Building locally

```bash
upshift/scripts/build-image.sh twenty/v2.44.0
```

Without an argument it builds the latest Twenty tag. It clones Twenty into a temporary folder, applies the layer and builds `upshift:<version>`. Plan for about 25 GB of free disk and 16 GB of memory for Docker.

To look at the patched source without building, apply the layer to any separate copy:

```bash
mkdir -p /tmp/twenty-copy && git archive main | tar -x -C /tmp/twenty-copy && node upshift/scripts/apply-branding.mjs --root /tmp/twenty-copy
```

The script refuses to run on this repository's own working tree outside CI.

## Changing the brand

- Name, website, docs URL, legal links, contact email, email sender: edit `branding/brand.json`.
- Logo: replace `branding/logo.svg` (and `logo-square.svg`, `mark.svg`), then regenerate the icons and commit the result:

```bash
node upshift/scripts/generate-icons.mjs
```

Email images and the social card are loaded from `publicAssetsBaseUrl` (raw GitHub files of this public repository). If the repository becomes private, host `branding/assets/` elsewhere and update that URL.

## When the layer check fails

Every failure names the file and what was expected.

| Message | What happened | Fix |
| --- | --- | --- |
| `expected N occurrence(s) of "..."` | Twenty changed or moved a patched string | Find the new code, update `from`/`to` in `PATCHES` |
| `no longer exists in Twenty` | Twenty moved or deleted a patched file | Add the new path first in the patch's `file` list and keep the old one while releases still use it. A file that only exists in newer Twenty code can be marked `optional: true` |
| `changed in Twenty (sha256 ...)` | Twenty edited a file Upshift replaces whole (the email footer) | Compare with the overlay, port anything relevant, add the new hash to `CODE_OVERLAY_UPSTREAM_SHA256` |
| `has no Upshift version` | Twenty added a new app icon | `node upshift/scripts/generate-icons.mjs --root <checkout>` and commit |
| `references <host or link>` | New code calls or links to a Twenty-owned host | Patch it. If it is unreachable or intentional, add the file to `REFERENCE_CENSUS` with the reason |
| `lingui compile command not found` / `catalogs changed shape` | Twenty changed its translation build | Update `installCatalogHooks` or `brand-catalogs.mjs` |

## What the layer disables

| Call | Default in Twenty | In Upshift |
| --- | --- | --- |
| Sign-up telemetry to twenty-telemetry.com (user email, name, workspace, server URL) | On | Removed in code, cannot be re-enabled from env or admin panel |
| Company logos from twenty-icons.com (browser and server) | On | URL builder returns nothing, workspace logo inference removed |
| Company enrichment from twenty-companies.com during email and calendar sync | On | Removed, falls back to the name derived from the domain |
| AI help-center search through twenty-help-search.com | On | Disabled unless you configure your own Mintlify key |
| Email logo and default workspace logo hosted by Twenty | On | Served from this repository |
| Founder avatars from twentyhq.github.io in prefilled data | On | Removed |
| Yarn telemetry during builds | On | Off |

Left in place on purpose:

- Enterprise licence calls to twenty.com. They only happen after an explicit admin action: setting `ENTERPRISE_KEY`, or clicking through the enterprise checkout in the admin panel.
- The admin panel reads Twenty's public Docker Hub tags to show the latest version (Upshift versions match them).
- Sentry, support chat, captcha and Cal.com stay off unless configured.
- Third-party services used by features: npm/unpkg for the app marketplace, models.dev for the AI model list, the TradingView widget on the sample dashboard.

## What users see

- Name, logo, icons, page titles, emails, translations (all languages), AI assistant prompts, MCP and OpenAPI metadata say Upshift.
- Documentation links point to `docsUrl` (`https://upshiftcloud.com/docs`) with Twenty's paths kept, for example `/user-guide/workflows/...` and `/developers/extend/apps/getting-started`. The Upshift docs site should serve or redirect those paths.
- Hidden: the Community settings page (Twenty's Discord, X, partners, changelog), the Legal / DPA pages (Twenty's own legal agreement) and the ChatGPT card that installs Twenty's ChatGPT app.

Still named Twenty on purpose, because they are real identifiers:

- The app developer commands `npx create-twenty-app` and `yarn twenty ...` (published npm packages; the example folder is renamed `my-upshift-app`).
- Webhook signature headers `X-Twenty-Webhook-Signature`, `-Timestamp`, `-Nonce` (API contract).
- Internal package paths, logs and environment variable names inside the container.
