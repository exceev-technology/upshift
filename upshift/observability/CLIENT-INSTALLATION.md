# Install Upshift and monitoring for a client

Start here for a Coolify installation. Complete the common preparation, then follow **one** monitoring guide:

| Option | Client's server | Data ownership and operations | Guide |
| --- | --- | --- | --- |
| Client-owned Grafana Cloud | Upshift, PostgreSQL, Redis and Alloy | Client owns the Cloud organization and billing, invites Exceev; Grafana runs the monitoring backends | [Grafana Cloud](GRAFANA-CLOUD.md) |
| Dedicated on-premises monitoring | The above plus Grafana, gateway, Loki, Tempo, Mimir, SeaweedFS, Prometheus and Alertmanager | Client owns the infrastructure and data; agree who maintains and restores it | [On-premises](ON-PREMISE.md) |

Alloy is the local collector in both options. Cloud does not need our gateway or an S3 bucket. On-premises uses the included gateway for authentication and budgets, and local SeaweedFS as S3-compatible storage; no AWS account is needed. Grafana with only InfluxDB does not provide the Loki/Tempo/Mimir backends used by this deployment.

The on-premises Compose files are supplied directly. The Cloud guide includes a recipe that derives separate deployment files from the same filtered collector. Cloud is not selected merely by changing the URL in the existing monitoring Compose file.

## 1. Record the installation details

Record these in the client's deployment inventory, without secret values:

- Client identifier, for example `client-a`; client owner and Exceev operator accounts.
- Coolify project, server, application resource and environment (`production` or `staging`).
- Git revision and released Upshift image tag/digest, PostgreSQL/Redis versions, persistent volume names and backup location.
- Upshift domain, chosen monitoring option, monitoring region/location, retention and notification recipient.
- Client Infisical project ID, environment slug and secret paths.

Use a client-owned Grafana account for ownership and direct access. Have the client invite individual Exceev accounts with the permissions needed for support; do not share their owner login. For on-premises, give the client their own dedicated Grafana installation. An Exceev organization containing multiple clients' datasources must remain operator-only.

## 2. Publish the correct Upshift image

The monitoring preload and additional Twenty reporting blocks must be included in the image build. Previously published images, including the original `v2.46`, do not change when this branch changes.

After merging the branch, use [Upshift Release](../../.github/workflows/upshift-release.yaml). To rebuild the discussed release, select `twenty-tag=twenty/v2.46.0` and `force=true`. Require a successful build and release smoke test, and record the source revision and registry digest. Publishing and production deployment are separate operator actions.

Set `TAG` to the verified version. The Compose image has the form `ghcr.io/exceev-technology/upshift:${TAG:-latest}`. To pin a digest without changing it, use `TAG=vX.Y.Z@sha256:<actual-digest>` with the real published tag and digest. Do not use `latest` for a repeatable client installation.

## 3. Prepare PostgreSQL, Redis, storage and DNS

1. Create or identify the client's private PostgreSQL and Redis resources in Coolify. The provided client Compose files expect existing databases. PostgreSQL 16 is the version used by our local Compose; use versions compatible with the selected Upshift release. Configure Redis with `maxmemory-policy noeviction` and persist it according to your recovery requirements.
2. Create a dedicated application database and credentials. Configure private DNS/network reachability from the Upshift application resource to both databases; independent Coolify resources are not automatically reachable through arbitrary Compose service names. Do not expose their ports publicly to solve routing problems.
3. Configure backups for PostgreSQL and Upshift attachments. The default attachment storage is the `server-local-data` named volume. If using application S3 storage, preserve its existing `STORAGE_S3_*` configuration; that storage is separate from monitoring storage.
4. Point the application domain at the client's Coolify proxy. Prepare additional workspace DNS/certificates only if multi-workspace is enabled.
5. For an existing installation, take a backup and record its actual volume bindings before changing the resource. Prefer updating the existing resource. A new Coolify resource/project can create new empty volumes even with identical Compose content.

## 4. Put client secrets in Infisical

Use one project per client, for example `upshift-client-a`, with `prod` and `staging` environments. Use `/upshift` for application and collector secrets. For dedicated on-premises monitoring, use a separate `/monitoring` path and resource identity. Separate projects can be used when a client's access policy requires stronger administrative separation.

Create a read-only machine identity scoped to the required project, environment and path. In Coolify, register its Universal Auth credentials under **Keys & Tokens → Integration Tokens → Infisical**. On the resource, open **Environment Variables → Secret manager**, select the identity, project ID, environment slug and path. Map each secret as `{{vault.KEY}}`, including when the provider is Infisical. Restart/redeploy after a secret change. A Compose resource uses one secret source for the whole stack. See [Coolify's secret manager setup](https://coolify.io/docs/integrations/security/using-secret-managers) and [provider credentials](https://coolify.io/docs/integrations/security/secret-managers).

If your Coolify version lacks this integration, either update it after testing or enter the same values in the resource's runtime environment variables. The supplied images do not fetch Infisical themselves. Do not add an Infisical sidecar or CLI wrapper unless you separately implement and test it.

| Application variable | Where to set it | Notes |
| --- | --- | --- |
| `TAG` | Coolify, nonsecret | Verified release, preferably with digest |
| `SERVER_URL` | Coolify, nonsecret | HTTPS application origin, without a port suffix |
| `FRONTEND_URL` | Coolify, nonsecret | Defaults to `SERVER_URL` |
| `TRAEFIK_CORS_ORIGIN_REGEX` | Coolify, nonsecret, Literal enabled | Restrict to this client's intended origins; see the [base deployment guide](../README.md#deploying-with-coolify) |
| `PG_DATABASE_HOST`, `PG_DATABASE_PORT`, `POSTGRES_DB` | Coolify | Private database host when assembling the URL; defaults: port `5432`, database `upshift` |
| `SERVICE_USER_POSTGRES`, `SERVICE_PASSWORD_POSTGRES` | Infisical `/upshift` | Must match the real database credentials, not unrelated Coolify-generated values |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_USER` | Coolify | Private host when assembling the URL; defaults: `6379`, `default` |
| `REDIS_PASSWORD` | Infisical `/upshift` | Match the Redis resource |
| `PG_DATABASE_URL`, `REDIS_URL` | Infisical, if overriding assembled URLs | Alternative to the corresponding host/credential parts; percent-encode credential characters in URLs |
| `SERVICE_BASE64_32_SECRET` | Infisical `/upshift` | Passed to server and worker as `APP_SECRET` |
| `ENCRYPTION_KEY`, `FALLBACK_ENCRYPTION_KEY` | Infisical if used | Preserve the existing encryption configuration |
| `EMAIL_DRIVER`, `EMAIL_FROM_*`, `EMAIL_SMTP_*` | Coolify for nonsecrets; Infisical for credentials | Configure SMTP for real invitations/password resets; the default `logger` does not send email |
| `STORAGE_TYPE`, `STORAGE_S3_*` | Coolify for nonsecrets; Infisical for credentials | Optional application attachment storage |
| `UPSHIFT_OBSERVABILITY_ENVIRONMENT` | Coolify | `production` or `staging` |
| `UPSHIFT_TRACE_SAMPLE_RATE` | Coolify | Start with `0.1`; accepts `0` through `1` |

For an existing client, **copy existing secrets unchanged** into Infisical. `SERVICE_BASE64_32_SECRET` may also protect stored application secrets when no explicit encryption key exists. Do not rotate it or the encryption keys during monitoring adoption. For a new installation, retain the generated application secret securely and reuse it for every redeployment.

The Cloud/on-premises guides add the collector credentials. These belong only in Alloy's environment; they are not application encryption keys. Keep secret values out of Git, shell history, screenshots and support tickets.

## 5. Configure the application in Coolify

Use a **Git-based Docker Compose application**, Base Directory `/upshift/docker`, pointing to a revision containing the chosen guide's deployment files. Relative Alloy bind mounts require that checkout; pasting the YAML into an empty service does not provide the collector file.

Choose the Compose location in the next guide. Keep server and worker together in this resource. Route only the `upshift` service through HTTPS to port **3000**, for example the Coolify domain entry `https://upshift.client-domain.com:3000`; Alloy gets no public domain or published port.

Untick **Escape special characters in labels?** so the CORS regex is expanded, and enable Literal for the regex variable. Follow the [base guide](../README.md#deploying-with-coolify) for workspace domains, cookie origins and CORS. If deploying multiple Upshift resources behind one proxy, rename the `upshift-cors` middleware consistently in each resource's deployment file to avoid collisions. Preserve those client-specific changes when regenerating files.

## 6. Verify and hand over

Finish the signal-specific checks in the selected guide, then record:

- Server and worker are healthy, sign-in works, a record can be created/read, SMTP works and an attachment survives a restart.
- Metrics, a sampled request log and its trace are visible in the correct client's Grafana. No request bodies, query values or customer identifiers appear in the exported records.
- A notification test reaches the agreed recipient. Decide who receives incidents outside business hours.
- The client can sign in to Grafana and Infisical, and Exceev's access is limited to the agreed role.
- The inventory includes image digest, configuration revision, retention, backup/restore instructions and a tested recovery date.

The [collection scope](README.md#what-is-collected) is deliberately narrow: worker process metrics are included, but browser errors, job failures, database spans and GraphQL errors returned as HTTP 200 are not. Request/process metrics are emitted every **15 seconds**; there is currently no environment variable to change that interval. Sampling controls successful request logs/traces, not metric frequency, and HTTP error records remain eligible at a zero success sample rate.

This opt-in operational monitoring does not re-enable Twenty analytics or enterprise callbacks. Grafana Cloud receives these records when chosen; on-premises sends them to the client's monitoring server. User-configured integrations and external workflows remain separate from these protections.

## Disable, switch or retire monitoring

To disable collection, change `UPSHIFT_OBSERVABILITY_ENABLED` to `'false'` in the selected Compose file for **both** server and worker, then redeploy. A same-named Coolify variable alone does not override the literal `'true'` in the supplied overlay. Alternatively return to `docker-compose.yml` while preserving the resource's persistent volumes. Remove Alloy after confirming export has stopped.

To switch destinations, deploy the new monitoring backend first, change to the other guide's collector configuration and credentials, then verify all three signals before revoking the old token. This switches new writes; it does not migrate historical data. Retain old query access until the agreed history expires.

On handover or termination, let the client revoke Exceev's user access and rotate the ingestion/machine-identity credentials as needed. Preserve application secrets and storage. Agree any data deletion separately; never remove backend files manually to shorten history.
