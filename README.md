# Vonk Forge Web

Public catalog, API, and publishing website for Vonk Forge recipes. This
service stores recipe metadata and validation evidence; container images and
model weights remain in their external registries.

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

The reference stack contains four services: PostgreSQL, the public API, the
static web site, and a private validation worker. PostgreSQL and the worker do
not publish host ports. API and web bind to loopback for local development.

Before first start, create `deploy/secrets/postgres-password.txt` containing a
local database password. This directory is ignored by Git. Then use:

```bash
docker compose -f deploy/compose.yaml build
docker compose -f deploy/compose.yaml up -d --wait
docker compose -f deploy/compose.yaml exec -T api \
  alembic -c /app/api/alembic.ini upgrade head
```

The API is at `http://127.0.0.1:8000` and the web site at
`http://127.0.0.1:8080`. Stop without deleting PostgreSQL data with:

```bash
docker compose -f deploy/compose.yaml down
```

Railway service definitions live under `deploy/railway`. Production database
credentials and OAuth settings belong in Railway secrets, never in this
repository.

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
