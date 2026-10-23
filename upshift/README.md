# Upshift layer

Everything that turns Twenty into Upshift lives in this folder. No Twenty file is edited in git: the layer is applied to a fresh Twenty checkout at build time. That is what keeps `upshift-main` conflict-free when Twenty ships new versions.

```
upshift/
  branding/
    brand.json        name, URLs and legal links used everywhere
    logo.svg          source logo (rounded), logo-square.svg, mark.svg
    wordmark.svg      logo with the name for light backgrounds, wordmark-dark.svg for dark (docs)
    assets/           logo-email.png, logo-512.png, social-card.png (served from GitHub)
    overlay/          files copied over Twenty's: app icons, onboarding logo, email footer
  scripts/
    apply-branding.mjs   applies the layer to a checkout, then audits it
    brand-catalogs.mjs   rebrands compiled translations during the Docker build
    generate-icons.mjs   renders every app icon from logo.svg
    build-image.sh       builds the image locally, same steps as CI
  docker/
    docker-compose.yml        Upshift server and worker, ready for Coolify
    docker-compose.local.yml  adds Postgres, Redis and a published port
    .env.example
  docs/
    rules.mjs           what is published and how it is rebranded
    import-docs.mjs     builds docs/site from a Twenty checkout
    site/               generated Mintlify site, not committed: the Upshift Docs workflow
                        builds it from the latest Upshift release and publishes the docs-site branch
```

## How a release is built

1. Check out Twenty at a version tag, for example `twenty/v2.45.6`. `scripts/latest-twenty-tag.sh` picks the highest `twenty/vX.Y.Z` tag; patch versions have no GitHub Release page but Twenty publishes them as Docker images, so Upshift ships them too.
2. Run `node upshift/scripts/apply-branding.mjs --root <checkout>`. It:
   - copies `branding/overlay/` over the checkout,
   - applies exact-match source patches (each patch expects a precise number of matches, so a moved string fails loudly instead of being skipped),
   - makes the image own its version: the build writes `APP_VERSION` to `/app/upshift-version` and the entrypoint exports it for the server and the worker, so an `APP_VERSION` left in a deployment's environment is ignored (and logged) instead of reporting an older release,
   - installs a translation hook that runs right after `lingui compile` and replaces "Twenty" with the brand name in every language,
   - turns off Yarn telemetry,
   - runs a reference census: any shipped file that references a Twenty-owned host or link outside the reviewed list (`REFERENCE_CENSUS`, each entry says why it is allowed) fails the build.

   Every change is prepared in memory first. If any patch point is missing, nothing is written.
3. Build Twenty's own Dockerfile (`--target twenty`) and push `ghcr.io/exceev-technology/upshift:vX.Y.Z`.

The [Upshift Release](../.github/workflows/upshift-release.yaml) workflow does this every morning for the newest Twenty tag, for amd64 and arm64, and skips versions that are already published. It publishes `vX.Y.Z`, moves `vX.Y` when that is the newest patch of its minor line, and moves `vX` and `latest` when it is the newest version overall. After the image is published it creates the git tag `upshift/vX.Y.Z` on the Upshift commit that built it, with a GitHub Release page carrying the pull and upgrade instructions; rebuilding an existing version moves that tag and updates the page. Before anything is published, the amd64 image goes through a smoke test (`scripts/smoke-test.mjs`): it starts with the compose file and its local Postgres and Redis overlay, checks the branding on the page, manifest and MCP server card, then signs up, creates a workspace and signs in through the API. Telemetry and Twenty icons are switched on in that environment on purpose, every Twenty-owned host resolves to a listener on the runner (`scripts/smoke-host-sink.mjs`), and the test fails if anything connects to it. On pull requests the same build and smoke test run without publishing.

The translation hook also verifies its own output on every build: message ids, placeholders and plural structure are unchanged, SDK commands such as `create-twenty-app` are untouched, and no message still says Twenty. The branding check runs it on the latest Twenty release with `--check-catalogs`. To build a specific version, run the workflow manually with `twenty-tag` set (for example `twenty/v2.43.0`). Tick `force` to rebuild an existing version.

## Deploying with Coolify

`docker/docker-compose.yml` is written for Coolify: Postgres and Redis are existing servers given by variables, Coolify generates the app secret, and its Traefik proxy answers CORS for the workspace subdomains.

1. Create a **Docker Compose Empty** resource and paste `docker/docker-compose.yml`.
2. Add the domains on the `upshift` service with port 3000, for example `https://upshift.client-domain.com:3000`, and point their DNS at the server. With multi-workspace, every workspace is served on its own subdomain, so list each one too, comma separated: `https://upshift.client-domain.com:3000,https://app.upshift.client-domain.com:3000,https://acme.upshift.client-domain.com:3000`. A wildcard DNS record covers them all; a single wildcard route instead needs a wildcard certificate, see Coolify's [wildcard certificates](https://coolify.io/docs/core/networking/proxy/traefik/wildcard-certs) guide.
3. Untick **Escape special characters in labels?** on the resource. While it is ticked, Coolify passes `${TRAEFIK_CORS_ORIGIN_REGEX:?}` to Traefik literally instead of its value.
4. Fill in the variables. Coolify blocks the deployment until the required ones have a value.

| Variable | Example | Notes |
| --- | --- | --- |
| `SERVER_URL` | `https://upshift.client-domain.com` | Required. `FRONTEND_URL` defaults to it |
| `TRAEFIK_CORS_ORIGIN_REGEX` | `^https://([a-z0-9-]+\.)?client-domain\.com$` | Required. Enable **Literal**, the value contains `$` |
| `PG_DATABASE_HOST`, `PG_DATABASE_PORT`, `POSTGRES_DB` | `10.0.0.5`, `5432`, `upshift` | Host is required |
| `SERVICE_USER_POSTGRES`, `SERVICE_PASSWORD_POSTGRES` | | Coolify generates random values: replace them with the database's credentials |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_USER`, `REDIS_PASSWORD` | `10.0.0.6`, `6379`, `default` | Host is required |
| `PG_DATABASE_URL`, `REDIS_URL` | `postgres://upshift:p%2Fss@10.0.0.5:5432/upshift` | Replace the parts above. Use them when a user or password contains `/ ? # @ :` or `%`, percent-encoded; Coolify's generated passwords have no symbols |
| `SERVICE_BASE64_32_SECRET` | | Generated by Coolify, becomes `APP_SECRET`. It also encrypts stored secrets unless `ENCRYPTION_KEY` is set, so never change it on a running instance |
| `IS_MULTIWORKSPACE_ENABLED`, `DEFAULT_SUBDOMAIN` | `true`, `app` | One workspace per subdomain |
| `AUTH_COOKIE_ALLOWED_ORIGINS` | `https://app.upshift.client-domain.com,https://acme.upshift.client-domain.com` | Every workspace origin, see below |
| `STORAGE_TYPE`, `STORAGE_S3_*` | `s_3` | Defaults to `local` (a Docker volume) |
| `EMAIL_DRIVER`, `EMAIL_SMTP_*`, `EMAIL_FROM_*` | `smtp` | Defaults to `logger`, which only writes emails to the logs |
| `TAG` | `v2.45.6` | Pin an exact version in production |

With multi-workspace, add each new workspace's domain to the service and its origin to `AUTH_COOKIE_ALLOWED_ORIGINS`, then redeploy. Twenty answers 403 to cookie-authenticated POST requests (every GraphQL call) from any origin outside that list, so the Traefik regex alone does not let a new workspace in.

The CORS middleware is named `upshift-cors`. Traefik drops a middleware defined twice with different settings, so if a second Upshift stack runs behind the same Coolify proxy, rename it in all of that stack's labels.

To move an existing Twenty resource to Upshift, back up the database, keep its `SERVICE_BASE64_32_SECRET`, and set `POSTGRES_DB` to the database it already uses. The server runs the upgrade when it starts, and Twenty supports jumping several versions at once.

Without Coolify, `cp .env.example .env && docker compose up -d` starts Upshift with its own Postgres and Redis (`.env.example` sets `COMPOSE_FILE` to include `docker-compose.local.yml`). To use existing servers instead, drop that file from `COMPOSE_FILE`, set the hosts, and publish port 3000 through your own proxy or override file.

### Moving from the first compose file

The first `docker-compose.yml` bundled Postgres and Redis and named the server service `server`. A `.env` made from that version needs these lines once, with your former `PG_DATABASE_USER`, `PG_DATABASE_PASSWORD` and `PG_DATABASE_NAME` if you had set them (the defaults were `postgres`, `postgres` and `default`):

```
COMPOSE_FILE=docker-compose.yml:docker-compose.local.yml
PG_DATABASE_HOST=db
SERVICE_USER_POSTGRES=postgres
SERVICE_PASSWORD_POSTGRES=postgres
POSTGRES_DB=default
REDIS_HOST=redis
TRAEFIK_CORS_ORIGIN_REGEX='^http://localhost$'
```

Then start it with `--remove-orphans`, which removes the old `server` container that still holds the port:

```bash
docker compose up -d --remove-orphans
```

`docker-compose.local.yml` keeps the project name `upshift`, so the existing database and file volumes are reused.

## Documentation

`docs/` publishes the user documentation at https://docs.upshiftcloud.com with Mintlify. It is built from Twenty's own docs in `packages/twenty-docs`, which stays untouched:

- `docs/rules.mjs` says what is published and how it is rebranded: the Getting Started, User Guide and Developers tabs in French (the default, served at the root) and English (under `/en/`), without Twenty's billing, legal, cloud migration and partner pages, nor its self-hosting, contributing and UI library pages, with Twenty's links and addresses pointed at Upshift. The Developers tab is only readable after signing in, see [Developer pages](#developer-pages). No page names Twenty, code samples included, except the real identifiers listed in [What users see](#what-users-see); links to Twenty's source code point at the same files in this repository's `main` branch, which mirrors Twenty. Pages those tabs link to but that Twenty keeps out of its navigation are published too, without a navigation entry. French links to a page Twenty has not translated yet go to its English version. Upshift covers the whole chain from first contact to reporting, so the rules also reword prose that calls Upshift or its data "CRM"; "CRM" stays only for other products, migrations and the prospecting step.
- `docs/booking.js` opens the Upshift intro booking (the Contact us and Book a demo links) in a Cal.com pop-up; Mintlify loads it on every page. Without Cal.com's script, those links open the booking page.
- `docs/overrides/` holds pages written for Upshift, such as "Pourquoi Upshift" (`getting-started/introduction.mdx`, and its English version under `en/`), which replace Twenty's version of the same page, and the React snippets those pages import from `snippets/`, such as the interactive process map (`snippets/process-map.jsx`, styled in `docs/upshift.css`).
- `docs/import-docs.mjs` applies the rules and overrides to a Twenty checkout and writes `docs/site/`. `--root <checkout>` says which Twenty sources to read (this repository by default), `--version X.Y.Z` names the Upshift release the site documents and fails when the server's `TWENTY_CURRENT_VERSION` in the checkout is neither `X.Y.Z` nor `X.Y.0` (Twenty bumps it only for minor releases, so `twenty/v2.50.1` carries `2.50.0`), `--check` builds without writing, and `--public-only` leaves the developer pages out (their rules are still checked), as does `PUBLISH_PRIVATE_SECTIONS = false` in `rules.mjs`. The navigation carries a single version, `vX.Y.Z` from `--version`, or from the checkout's `TWENTY_CURRENT_VERSION` without it, so readers see which release the docs describe.

The site is not committed. The [Upshift Docs](../.github/workflows/upshift-docs.yaml) workflow builds it from the latest Upshift release: it takes the newest `upshift/vX.Y.Z` GitHub Release, checks out Twenty at the matching `twenty/vX.Y.Z` tag, applies the rules and overrides of `upshift-main`, and publishes the result to the `docs-site` branch, which Mintlify deploys to docs.upshiftcloud.com. It runs after every Upshift Release run, on every push to `upshift-main` that touches `docs/` or `branding/`, and on demand. Pull requests that touch those folders run the same build without publishing. Never edit the `docs-site` branch by hand or in the Mintlify web editor: the next run replaces it. Change the rules or add an override instead.

```bash
node upshift/docs/import-docs.mjs
```

The import fails when a sentence a rule expects has changed in Twenty's docs, when a page outside the Developers tab lacks `public: true` or a developer page has it, when an excluded section no longer matches any Twenty page (so a moved legal or billing page cannot slip through), when a page still references a Twenty address or links to a page that is not published, when a page presents Upshift as a CRM (add a term rule, or an allowed context in `CRM_ALLOWED_CONTEXTS`), or when an override no longer matches a published page or no page imports an override snippet. Update the rule's text or `count` in `rules.mjs` and run it again. The Upshift Branding Check runs the importer's tests and a `--check` build against this branch's Twenty docs, so a Twenty change that breaks a rule shows up before the next release. The Upshift Docs workflow runs the build against the released docs.

### Developer pages

Mintlify hides every page whose frontmatter does not say `public: true` once the site's access is private, and shows signed-out readers only the navigation groups marked `"public": true` in `docs.json`. The importer adds both to every page and group except those of `PRIVATE_SECTIONS` (the Developers tab), so turning the login on only closes the developer pages. Public pages link to them; readers who follow those links are asked to sign in.

The developer pages are published only while `PUBLISH_PRIVATE_SECTIONS` in `rules.mjs` is `true`. It is on: in the Mintlify dashboard, **Settings → Access** (app.mintlify.com/settings/project/authentication) has **Visibility** set to **Private** with the **Password** method. **Authenticated** would let in the members of the Mintlify organization instead (all plans), and **Custom** uses OAuth or JWT, for example to sign in with Upshift accounts (Enterprise plan). The public pages stay open because they say `public: true`.

To turn the login off, first set `PUBLISH_PRIVATE_SECTIONS` to `false` and let the Upshift Docs workflow publish, so the developer pages are gone before the site opens up. With the login on, the sitemap and `llms.txt` list the public pages only, and the search shows developer pages to signed-in readers only.

To preview the site locally, build it from this checkout, then serve it (the local preview shows the developer pages without a login):

```bash
node upshift/docs/import-docs.mjs && cd upshift/docs/site && npx --yes mintlify@4.2.956 dev
```

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

Then run `node upshift/docs/import-docs.mjs --check` in the same branch: it fails when Twenty's docs changed in a way the rules no longer match.

Open a PR into `upshift-main`. The merge has no conflicts because Upshift only adds files. The [Upshift Branding Check](../.github/workflows/upshift-branding-check.yaml) workflow applies the layer to the PR and to the latest Twenty release, so you learn about broken patch points before the next release.

`upshift-main` modifies none of Twenty's files, so syncing never conflicts. The only path both sides could create is `.github/README.md`; if Twenty ever adds one, keep ours.

## GitHub Actions

Only `upshift-release.yaml`, `upshift-branding-check.yaml` and `upshift-docs.yaml` run. Twenty's own workflows test, deploy and translate Twenty itself (several need Twenty's private secrets), so they are disabled in the repository settings. When a sync brings a new Twenty workflow, the `disable-twenty-workflows` job of the branding check disables it on the next push to `upshift-main`. It can run once on that same push before being disabled.

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
| `references <host or link>` | New code calls or links to a Twenty-owned host | Patch it; while the latest Twenty release does not have that code yet, mark the replacement `optional: true`. If it is unreachable or intentional, add the file to `REFERENCE_CENSUS` with the reason |
| `lingui compile command not found` / `catalogs changed shape` | Twenty changed its translation build | Update `installCatalogHooks` or `brand-catalogs.mjs` |

## What the layer disables

| Call | Default in Twenty | In Upshift |
| --- | --- | --- |
| Sign-up telemetry to twenty-telemetry.com (user email, name, workspace, server URL) | On | Removed in code, cannot be re-enabled from env or admin panel |
| Anonymous and authenticated browser pageviews | Browser collects and submits to the instance | Tracking components unmounted; direct analytics mutations acknowledge without storing events |
| Sentry errors, traces, profiles, AI inputs/outputs and browser session replay | Off unless configured | Server initialization and browser component disabled; exception logging uses the console |
| OpenTelemetry metric exports | Off unless configured | Remote exporter disabled; local console and Prometheus metrics remain available |
| Enterprise licence validation, seat reports, checkout, portal, status and release calls to Twenty | Conditional on licence configuration or admin actions | Requests rejected before collecting instance metadata or contacting Twenty |
| Company logos from twenty-icons.com (browser and server) | On | URL builder returns nothing, workspace logo inference removed |
| Company enrichment from twenty-companies.com during email and calendar sync | On | Removed, falls back to the name derived from the domain |
| AI help-center search through Twenty's documentation server (docs.twenty.com/mcp, twenty-help-search.com before v2.50) | On | Disabled, the tool answers without sending the query (before v2.50, your own Mintlify key re-enables it) |
| Email logo and default workspace logo hosted by Twenty | On | Served from this repository |
| Founder avatars from twentyhq.github.io in prefilled data | On | Removed |
| Yarn telemetry during builds | On | Off |

Left in place on purpose:

- The admin panel reads Twenty's public Docker Hub tags to show the latest version (Upshift versions match them).
- Support chat, captcha and Cal.com stay off unless configured.
- Third-party services used by features: npm/unpkg for the app marketplace, models.dev for the AI model list, the TradingView widget on the sample dashboard.

These reporting restrictions are enforced in the build layer, including when environment variables or saved database settings enable reporting. Local audit logs and usage accounting are preserved. Enterprise network operations fail with an explicit error; local licence verification and expiration rules are unchanged, so remote activation and renewal are unavailable.

The privacy tests run against both the branch source and the upstream release before applying the layer:

```bash
node --test upshift/scripts/*.test.mjs
UPSHIFT_PRIVACY_SOURCE_ROOT=/path/to/fresh/twenty node --test upshift/scripts/*.test.mjs
```

The release smoke test deliberately enables telemetry, analytics, Sentry and remote metrics against a local connection sink. Its control request runs before the application starts; after clearing only that control request, the test checks connections throughout startup and signup/signin. This tests the listed destinations and API flows; it is not a browser network test or a firewall for user-installed apps, workflows, external URLs or configured integrations.

Changing these sources does not update an existing registry image. After merging the changes, run **Upshift Release** with `twenty-tag=twenty/v2.46.0` and `force=true` to rebuild that release. Verify the successful build's source revision and digest before deploying, and pin the resulting digest rather than relying on the movable `v2.46` alias. Until that rebuild passes, the existing image does not contain these additional privacy guards.

## What users see

- Name, logo, icons, page titles, emails, translations (all languages), AI assistant prompts, MCP and OpenAPI metadata say Upshift.
- Upshift is described as a platform that digitizes all company processes, CRM included, not as a CRM: the invitation email in every language (`scripts/catalog-wording.mjs`), the AI assistant, agent and workflow prompts and the MCP instructions. CRM stays where it names that part of the product, such as the CRM Hygiene skill.
- Documentation links point to `docsUrl` (`https://docs.upshiftcloud.com`) with Twenty's paths kept, for example `/user-guide/workflows/...` and `/developers/extend/apps/getting-started`. The Upshift docs site serves or redirects those paths, the developer ones behind its login.
- The Community settings page links to Exceev's LinkedIn and X (`linkedinUrl`, `xUrl`) and shows the beta Features toggles, so each workspace can turn a feature on or off, only when the server offers at least one. Twenty's contributor cover, partners and changelog are removed from it.
- Hidden: the Organization tab of the admin panel (Twenty's enterprise licence and plans), the Legal / DPA pages (Twenty's own legal agreement) and the ChatGPT card that installs Twenty's ChatGPT app.

Still named Twenty on purpose, because they are real identifiers:

- The app developer commands and packages `npx create-twenty-app`, `yarn twenty ...`, `twenty-sdk` and `twenty-client-sdk`, and the `TWENTY_*` variables apps read (published npm packages; the example folder is renamed `my-upshift-app`, in the docs too).
- Webhook signature headers `X-Twenty-Webhook-Signature`, `-Timestamp`, `-Nonce` (API contract).
- Internal package paths, logs and environment variable names inside the container.

## Optional client monitoring

Start with the [client installation guide](observability/CLIENT-INSTALLATION.md), then choose [client-owned Grafana Cloud](observability/GRAFANA-CLOUD.md) or [a dedicated on-premises Grafana stack](observability/ON-PREMISE.md). Both use Coolify, client-scoped Infisical secrets and a local Alloy collector. The Cloud guide includes a recipe for its separate authentication and deployment files; the on-premises stack includes per-client retained-data budgets and infrastructure alerts. Collection is opt-in and filters operational records. Twenty reporting stays blocked. Publish a rebuilt Upshift image before enabling instrumentation. See the [self-hosted operator runbooks](observability/README.md) for backend maintenance.
