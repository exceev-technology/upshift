<p align="center">
  <img src="../upshift/branding/assets/logo-512.png" width="96" alt="Upshift" />
</p>

<h1 align="center">Upshift</h1>

<p align="center">The CRM by Exceev Technology, built on <a href="https://github.com/twentyhq/twenty">Twenty</a>.</p>

## Run Upshift

You need Docker with Compose.

```bash
cd upshift/docker
cp .env.example .env
```

Set `SERVER_URL` to the address users will open, and `ENCRYPTION_KEY` to the output of `openssl rand -base64 32`. Then start it:

```bash
docker compose up -d
```

Upshift is then available at `SERVER_URL` (port 3000 by default). The first account you create becomes the workspace admin.

## Versions

Upshift follows Twenty's versions, the `twenty/vX.Y.Z` tags that Twenty also publishes as Docker images (GitHub Release pages only exist for minor versions). The image `ghcr.io/exceev-technology/upshift:v2.45.6` is Twenty `v2.45.6` with the Upshift layer applied.

| Image tag | Points to |
| --- | --- |
| `v2.45.6` | that exact version |
| `v2.45` | the newest patch of 2.45 |
| `v2` and `latest` | the newest version |

Pin an exact version in `TAG` for production, or a minor line such as `v2.45` to receive its patches. Each published version also gets a page under [Releases](https://github.com/exceev-technology/upshift/releases) (git tag `upshift/vX.Y.Z`) with its upgrade instructions. New Twenty versions are picked up automatically every morning by the [Upshift Release](workflows/upshift-release.yaml) workflow.

## Privacy

An Upshift deployment sends nothing to Twenty, unless an admin activates a Twenty enterprise licence. The build removes sign-up telemetry, company logo lookups (twenty-icons.com), company enrichment (twenty-companies.com), the AI help-center search proxy and the email images hosted by Twenty. The build fails if a new Twenty release adds another call to a Twenty-owned host. Details in [upshift/README.md](../upshift/README.md#what-the-layer-disables).

## How this repository works

| Branch | Purpose |
| --- | --- |
| `main` | Untouched mirror of `twentyhq/twenty`. Protected; it only receives Twenty's commits. |
| `upshift-main` | Default branch. Twenty plus the Upshift layer in `upshift/`. |

Everything Upshift adds lives in new files (`upshift/`, `.github/README.md`, `.github/workflows/upshift-*.yaml`), so merging a new Twenty version into `upshift-main` does not conflict. The rebrand is applied at build time. See [upshift/README.md](../upshift/README.md) for the maintainer guide.

## License

Upshift is a fork of [Twenty](https://github.com/twentyhq/twenty) and keeps its license: AGPLv3 for most of the code, with files marked `/* @license Enterprise */` under Twenty's commercial license. See [LICENSE](../LICENSE). "Twenty" and its logo are trademarks of Twenty.com, PBC; Upshift is not affiliated with or endorsed by Twenty.
