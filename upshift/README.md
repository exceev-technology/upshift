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
    import-docs.mjs     builds docs/site from packages/twenty-docs
    site/               generated Mintlify site, deployed to docs.upshiftcloud.com
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

The [Upshift Release](../.github/workflows/upshift-release.yaml) workflow does this every morning for the newest Twenty tag, for amd64 and arm64, and skips versions that are already published. It publishes `vX.Y.Z`, moves `vX.Y` when that is the newest patch of its minor line, and moves `vX` and `latest` when it is the newest version overall. After the image is published it creates the git tag `upshift/vX.Y.Z` on the Upshift commit that built it, with a GitHub Release page carrying the pull and upgrade instructions; rebuilding an existing version moves that tag and updates the page. Before anything is published, the amd64 image goes through a smoke test (`scripts/smoke-test.mjs`): it starts with the compose file and its local Postgres and Redis overlay, checks the branding on the page, manifest and MCP server card, then signs up, creates a workspace and signs in through the API. Telemetry and Twenty icons are switched on in that environment on purpose, every Twenty-owned host resolves to a listener on the runner (`scripts/smoke-host-sink.mjs`), and the test fails if anything connects to it. On pull requests the same build and smoke test run without publishing.

The translation hook also verifies its own output on every build: message ids, placeholders and plural structure are unchanged, SDK commands such as `create-twenty-app` are untouched, and no message still says Twenty. The branding check runs it on the latest Twenty release with `--check-catalogs`. To build a specific version, run the workflow manually with `twenty-tag` set (for example `twenty/v2.43.0`). Tick `force` to rebuild an existing version.

## Deploying with Coolify

`docker/docker-compose.yml` is written for Coolify: Postgres and Redis are existing servers given by variables, Coolify generates the app secret, and its Traefik proxy answers CORS for the workspace subdomains.

1. Create a **Docker Compose Empty** resource and paste `docker/docker-compose.yml`.
2. Add the domains on the `upshift` service with port 3000, for example `https://crm.client-domain.com:3000`, and point their DNS at the server. With multi-workspace, every workspace is served on its own subdomain, so list each one too, comma separated: `https://crm.client-domain.com:3000,https://app.crm.client-domain.com:3000,https://acme.crm.client-domain.com:3000`. A wildcard DNS record covers them all; a single wildcard route instead needs a wildcard certificate, see Coolify's [wildcard certificates](https://coolify.io/docs/core/networking/proxy/traefik/wildcard-certs) guide.
3. Untick **Escape special characters in labels?** on the resource. While it is ticked, Coolify passes `${TRAEFIK_CORS_ORIGIN_REGEX:?}` to Traefik literally instead of its value.
4. Fill in the variables. Coolify blocks the deployment until the required ones have a value.

| Variable | Example | Notes |
| --- | --- | --- |
| `SERVER_URL` | `https://crm.client-domain.com` | Required. `FRONTEND_URL` defaults to it |
| `TRAEFIK_CORS_ORIGIN_REGEX` | `^https://([a-z0-9-]+\.)?client-domain\.com$` | Required. Enable **Literal**, the value contains `$` |
| `PG_DATABASE_HOST`, `PG_DATABASE_PORT`, `POSTGRES_DB` | `10.0.0.5`, `5432`, `upshift` | Host is required |
| `SERVICE_USER_POSTGRES`, `SERVICE_PASSWORD_POSTGRES` | | Coolify generates random values: replace them with the database's credentials |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_USER`, `REDIS_PASSWORD` | `10.0.0.6`, `6379`, `default` | Host is required |
| `PG_DATABASE_URL`, `REDIS_URL` | `postgres://upshift:p%2Fss@10.0.0.5:5432/upshift` | Replace the parts above. Use them when a user or password contains `/ ? # @ :` or `%`, percent-encoded; Coolify's generated passwords have no symbols |
| `SERVICE_BASE64_32_SECRET` | | Generated by Coolify, becomes `APP_SECRET`. It also encrypts stored secrets unless `ENCRYPTION_KEY` is set, so never change it on a running instance |
| `IS_MULTIWORKSPACE_ENABLED`, `DEFAULT_SUBDOMAIN` | `true`, `app` | One workspace per subdomain |
| `AUTH_COOKIE_ALLOWED_ORIGINS` | `https://app.crm.client-domain.com,https://acme.crm.client-domain.com` | Every workspace origin, see below |
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

- `docs/rules.mjs` says what is published and how it is rebranded: the Getting Started and User Guide tabs in French (the default, served at the root) and English (under `/en/`), without Twenty's billing, legal, cloud migration and partner pages, with Twenty's links and addresses pointed at Upshift. Pages those tabs link to but that Twenty keeps out of its navigation are published too, without a navigation entry. French links to a page Twenty has not translated yet go to its English version. Upshift covers the whole chain from first contact to reporting, so the rules also reword prose that calls Upshift or its data "CRM"; "CRM" stays only for other products, migrations and the prospecting step.
- `docs/overrides/` holds pages written for Upshift, such as "Pourquoi Upshift" (`getting-started/introduction.mdx`, and its English version under `en/`), which replace Twenty's version of the same page.
- `docs/import-docs.mjs` applies the rules and overrides and writes `docs/site/`, the folder Mintlify deploys from `upshift-main`. Never edit `docs/site/` by hand or in the Mintlify web editor: the next import replaces it. Change the rules or add an override instead.

```bash
node upshift/docs/import-docs.mjs
```

The import fails when a sentence a rule expects has changed in Twenty's docs, when an excluded section no longer matches any Twenty page (so a moved legal or billing page cannot slip through), when a page still references a Twenty address or links to a page that is not published, when a page presents Upshift as a CRM (add a term rule, or an allowed context in `CRM_ALLOWED_CONTEXTS`), or when an override no longer matches a published page. Update the rule's text or `count` in `rules.mjs` and run it again. The Upshift Branding Check runs the importer's tests and fails while `docs/site/` differs from what the import produces.

To preview the site locally:

```bash
cd upshift/docs/site && npx --yes mintlify@4.2.956 dev
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

Then refresh the docs in the same branch with `node upshift/docs/import-docs.mjs` and commit `upshift/docs/site` if it changed.

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
