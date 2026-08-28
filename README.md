# Vonk Forge Web

**The public front door for local AI you operate yourself.**

This repository powers [`vonkforge.ai`](https://vonkforge.ai): the Vonk Forge
product site, installation guide, architecture explainer, and public recipe
catalog. It helps an NVIDIA DGX Spark owner understand the system and get to a
local controller without pretending the public website is the controller.

[Open the website](https://vonkforge.ai) ·
[Install Vonk Forge](https://vonkforge.ai/install) ·
[Browse recipes](https://vonkforge.ai/recipes) ·
[Controller repository](https://github.com/CarstVaartjes/vonk-forge)

| Library: choose with exact model and lifecycle facts | Fleet: see capacity, placement, and blockers |
| --- | --- |
| ![Vonk Forge Library](docs/assets/controller-library.webp) | ![Vonk Forge Fleet](docs/assets/controller-fleet.webp) |

These are fixture-backed screenshots of the private Web Controller implemented
in `vonk-forge`; they contain no live fleet data.

## What visitors should understand

1. **What it is:** one local control plane for one or many NVIDIA DGX Sparks.
2. **Where it runs:** any local computer with Docker Compose, including a
   laptop, NAS, or server.
3. **How it works:** install the controller, enroll Sparks, choose a reproducible
   recipe, preview the plan, then confirm it.
4. **What stays private:** controller authority, identity, secrets, model
   caches, fleet state, and execution.

```mermaid
flowchart LR
    Website[vonkforge.ai<br/>explain, install, discover]
    Controller[Your local controller<br/>private Web UI and API]
    Sparks[Your DGX Sparks<br/>model cache and execution]

    Website -->|signed installer + recipe metadata| Controller
    Controller -->|previewed operations| Sparks
```

The public site stores bounded recipe metadata and validation evidence. It does
not control Sparks, execute workloads, accept model uploads, or hold runtime
secrets. Container images remain in registries; model weights remain at immutable
origins and in node-local caches.

## Site map

| Route | Job |
| --- | --- |
| `/` | Define the product, show the real interface, and lead to installation |
| `/install` | Explain the signed controller and Spark installation path |
| `/architecture` | Show public, controller, network, identity, and runtime boundaries |
| `/control` | Tour the private Web Controller and equivalent `vonkctl` path |
| `/recipes` | Filter public immutable recipes by runtime, topology, and publisher |
| `/publish` | Explain and validate the recipe publishing contract |
| `/privacy` | Disclose aggregate, cookie-free website analytics |

## Run the frontend

```bash
npm --prefix web ci
npm --prefix web run dev
```

The Vite development server prints its local URL. The homepage and documentation
routes run without a global control service. Catalog routes expect the same-origin
`/v1` API unless `VITE_CATALOG_API_URL` is configured. A frontend-only deployment
can instead set `VITE_RECIPE_LIBRARY_INDEX_URL` to the public recipe library's
generated `catalog-index.json`; this enables read-only catalog browsing while
the Publish route explains the GitHub review workflow.

Run the frontend checks with:

```bash
npm --prefix web test -- --run
npm --prefix web run build
npm --prefix web run test:e2e
```

## Run the catalog API

Use Python 3.12 and [uv](https://docs.astral.sh/uv/):

```bash
uv sync --project api
VONK_DATABASE_URL=postgresql+psycopg://vonk:vonk@127.0.0.1:5432/vonk_catalog \
  uv run --project api uvicorn vonk_catalog.api:create_app --factory --reload
```

Liveness is available at `/health/live`; readiness is available at
`/health/ready`.

## Run the reference stack

The local reference stack contains PostgreSQL, a one-shot migration, the private
API, the public static gateway, and a private validation worker. Only the gateway
publishes a host port.

Create `deploy/secrets/postgres-password.txt` with a long random local password,
then run:

```bash
export VONK_POSTGRES_PASSWORD_FILE="$PWD/deploy/secrets/postgres-password.txt"
docker compose -f deploy/compose.yaml up -d --build --wait
```

The site and same-origin API are available at `http://127.0.0.1:8080`.

```bash
docker compose -f deploy/compose.yaml down
```

This stack is for development and contract testing. It is separate from the
operator-owned controller installed from `install.vonkforge.ai`.

## Deployment boundary

- Cloudflare Pages serves the static frontend at
  [`vonkforge.ai`](https://vonkforge.ai). The default Pages hostname is
  `vonk-forge-web.pages.dev`.
- GitHub Actions in `vonk-forge` publishes the signed agent package and installer
  artifacts at `packages.vonkforge.ai`.
- Caddy belongs to each operator's local controller, not to the public catalog.
- Railway is reserved for a possible future global catalog API and worker. It is
  not required for the current static product and documentation routes.

See [`docs/operations/cloudflare-pages.md`](docs/operations/cloudflare-pages.md)
for deployment setup.

## Contract verification

The JSON Schemas, canonical fixture hashes, OpenAPI document, and generated
TypeScript declarations are checked together:

```bash
npm --prefix web ci
scripts/verify-contracts
scripts/export-contract
```

The export is a deterministic `dist/vonk-contracts-v1.tar.gz` archive. Local
Vonk Forge installations pin a released archive and its SHA-256; they never load
schema authority from this repository's moving `main` branch.

## Related repositories

- [`vonk-forge`](https://github.com/CarstVaartjes/vonk-forge) — local controller,
  Web UI, native Spark agent, installers, CLI, and operator documentation.
- [`vonk-forge-recipes`](https://github.com/CarstVaartjes/vonk-forge-recipes) —
  public standard library of immutable model/runtime recipes.
