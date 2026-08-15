# Vonk Forge Web

The public recipe catalog and publishing surface for Vonk Forge. The static site
at [`vonkforge.ai`](https://vonkforge.ai) explains the verified path from public
recipe metadata to private, operator-owned compute and exposes the recipe and
publisher interfaces implemented in this repository.

This repository stores recipe metadata and bounded validation evidence. It does
not control Sparks, execute workloads, accept model uploads, or hold runtime
secrets. Container images remain in their registries, model weights remain at
their immutable origins and in node-local caches, and the operator's NAS remains
authoritative for local installation, placement, policy, and execution.

## Platform boundary

| Stage | Responsibility |
| --- | --- |
| Public catalog | Typed recipes, content-addressed source, immutable revisions, capacity facts, and bounded evidence |
| Operator NAS | Compose, PostgreSQL, policy, runtime secret files, and the local control plane |
| Spark runtime | Rootless source build followed by accepted workload execution through the native NVIDIA and Docker stack |

Accepted `main` builds advance public development images tagged `:dev` and the
signed APT `dev` channel. Production activation uses immutable signed releases,
compatibility gates, and the trusted host updater; it does not follow a mutable
container tag.

## Deployment boundary

The public static site is useful without a global control service. The hosted
layout is:

- Cloudflare Pages serves the static frontend at [`vonkforge.ai`](https://vonkforge.ai).
  The default Pages hostname is `vonk-forge-web.pages.dev`.
- Railway is reserved for a future global API, validation worker, and PostgreSQL
  database. It is not required for the current static catalog.
- GitHub Actions in `vonk-forge` builds and publishes the signed
  `vonk-forge-agent` package to Cloudflare R2 at `packages.vonkforge.ai`.
- Caddy belongs to the local NAS control host, not to the global catalog
  boundary.

The frontend deployment is defined in `.github/workflows/pages.yml`; see
[`docs/operations/cloudflare-pages.md`](docs/operations/cloudflare-pages.md)
for the one-time Cloudflare and GitHub setup. Railway is documented only as a
future backend option.

## Architecture and installation guides

The public frontend includes two operator-facing guides:

- `/architecture` maps the public catalog, operator workstation, NAS control
  plane, and a fleet of one to many Sparks. It distinguishes private Tailscale
  HTTPS, management-LAN enrollment TLS and agent mTLS, verified downloads, and
  recipe-selected NVIDIA fabric traffic.
- `/install` explains the development and production lanes, the exact
  `docker-compose.yaml` plus `secrets/` development project boundary, remote SSH
  publication onto the NAS filesystem, and the difference between a single
  Spark and a multi-node fleet.

These pages explain the system and link to the canonical runbooks in
`CarstVaartjes/vonk-forge`; they do not duplicate secret values or copy
shell procedures that would drift from the implementation repository.

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
hosted backend notes under `docs/operations` remain deferred until that global
service is explicitly enabled.

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
