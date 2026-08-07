# Vonk Forge Web

Future global catalog, API, and publishing website for Vonk Forge recipes. This
repository stores recipe metadata and validation evidence; container images and
model weights remain in their external registries. It is not the local Spark
control plane: local PostgreSQL remains authoritative for authoring, imports,
installation, placement, and execution.

## Deployment boundary

The initial Vonk Forge product does not require this global service. The target
hosted layout is:

- Cloudflare Pages serves the static frontend at `vonkforge.ai`.
- Railway is reserved for the future global API, validation worker, and
  PostgreSQL database; do not provision it for the initial local release.
- GitHub Actions in `vonk-forge` builds and publishes the signed
  `vonk-forge-agent` package to Cloudflare R2 at `packages.vonkforge.ai`.
- Caddy belongs to the local NAS control host, not to the global catalog
  boundary.

The frontend deployment is defined in `.github/workflows/pages.yml`; see
[`docs/operations/cloudflare-pages.md`](docs/operations/cloudflare-pages.md)
for the one-time Cloudflare and GitHub setup. Railway is documented only as a
future backend option.

## Local API

Use Python 3.12 and [uv](https://docs.astral.sh/uv/):

```bash
uv sync --project api
VONK_DATABASE_URL=postgresql+psycopg://vonk:vonk@127.0.0.1:5432/vonk_catalog \
  uv run --project api uvicorn vonk_catalog.api:create_app --factory --reload
```

Liveness is available at `/health/live`; readiness is available at
`/health/ready`.

## Local deployment

The reference stack contains PostgreSQL, a one-shot migration, the private API,
the public static web gateway, and a private validation worker. Only the web
gateway publishes a host port. It proxies `/v1/*` to the API over the internal
application network; PostgreSQL is reachable only on the database network.

Before first start, create `deploy/secrets/postgres-password.txt` containing a
long random local database password. This file is ignored by Git. Then use:

```bash
export VONK_POSTGRES_PASSWORD_FILE="$PWD/deploy/secrets/postgres-password.txt"
docker compose -f deploy/compose.yaml up -d --build --wait
```

The website and same-origin API are at `http://127.0.0.1:8080`. Stop without
deleting PostgreSQL data with:

```bash
docker compose -f deploy/compose.yaml down
```

The local Compose gateway is useful for development and contract testing. The
future hosted deployment notes live under `docs/operations`; they are deferred
until the global catalog is explicitly enabled.

## Contract verification

The public JSON Schemas, canonical fixture hashes, OpenAPI document, and
generated TypeScript declarations are checked together:

```bash
npm --prefix web ci
scripts/verify-contracts
scripts/export-contract
```

The export is a deterministic `dist/vonk-contracts-v1.tar.gz` archive. Local
Vonk Forge installations pin a released archive and its SHA-256; they never
load schema definitions from this repository's moving `main` branch.
