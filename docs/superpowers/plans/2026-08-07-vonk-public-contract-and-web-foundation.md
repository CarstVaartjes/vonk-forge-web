# Vonk Public Contract and Web Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the independently deployable `vonk-forge-web` monorepo, versioned recipe contract, PostgreSQL migration baseline, public read API, React shell, and Railway-ready containers.

**Architecture:** A FastAPI API and worker share one Python package while the React/Vite site consumes only OpenAPI. PostgreSQL stores catalog metadata and canonical JSON recipe revisions. The public recipe JSON Schema is the cross-repository contract and all immutable identities derive from RFC 8785-style canonical JSON bytes produced by one constrained serializer.

**Tech Stack:** Python 3.12, uv, FastAPI 0.116.1, SQLAlchemy 2.0.42, Alembic 1.16.4, psycopg 3.2.9, Pydantic 2, PostgreSQL 18, pytest 9, React 19, TypeScript 5.9, Vite 8, Vitest 4, Playwright, Docker, Railway.

## Global Constraints

- Repository source and schema are public; no production OAuth, database, registry, or Railway secret enters Git.
- The global service stores recipe metadata and evidence references, never image layers, model weights, local cluster data, or publisher registry credentials.
- Public recipe revisions are immutable canonical JSON identified by lowercase SHA-256.
- Initial recipes reference publicly retrievable OCI images by immutable digest and `linux/arm64` support.
- API errors use versioned `application/problem+json` bodies with stable codes.
- API and worker use PostgreSQL-backed jobs; Redis and a message broker are not introduced.
- Web and API are separate Railway services; staging and production use separate databases.
- The local product consumes published OpenAPI and JSON Schema only; no shared internal Python package crosses repositories.

---

### Task 1: Python API workspace and health contract

**Files:**
- Create: `pyproject.toml`
- Create: `api/src/vonk_catalog/__init__.py`
- Create: `api/src/vonk_catalog/api.py`
- Create: `api/src/vonk_catalog/settings.py`
- Create: `api/tests/test_health.py`
- Create: `api/tests/conftest.py`
- Create: `api/alembic.ini`
- Create: `api/migrations/env.py`
- Modify: `.gitignore`
- Modify: `README.md`

**Interfaces:**
- Produces: `create_app(settings: Settings | None = None) -> FastAPI`
- Produces: `GET /health/live` and `GET /health/ready`
- Produces: root uv workspace members `api` and `worker`

- [ ] **Step 1: Write the failing health test**

```python
from fastapi.testclient import TestClient
from vonk_catalog.api import create_app


def test_liveness_has_stable_contract() -> None:
    response = TestClient(create_app()).get("/health/live")
    assert response.status_code == 200
    assert response.json() == {"service": "vonk-catalog-api", "status": "live"}
```

- [ ] **Step 2: Run the test and verify the missing package failure**

Run: `uv run --project api pytest api/tests/test_health.py -v`

Expected: FAIL during collection with `ModuleNotFoundError: No module named 'vonk_catalog'`.

- [ ] **Step 3: Create the pinned Python workspace**

Set `requires-python = ">=3.12,<3.13"` and pin the foundation dependencies to the local product's established versions: FastAPI `0.116.1`, SQLAlchemy `2.0.42`, Alembic `1.16.4`, psycopg `3.2.9`, httpx `0.28.1`, jsonschema `4.25.1`, PyJWT `2.13.0`, uvicorn `0.35.0`, pytest `9.1.1`.

Run: `uv lock`

Expected: root `uv.lock` is created without editable dependencies outside this repository.

- [ ] **Step 4: Implement the minimal application**

```python
from fastapi import FastAPI


def create_app() -> FastAPI:
    app = FastAPI(title="Vonk Forge Catalog API", version="1.0.0")

    @app.get("/health/live", include_in_schema=False)
    def live() -> dict[str, str]:
        return {"service": "vonk-catalog-api", "status": "live"}

    return app
```

Add readiness as a separate dependency-injected database probe; it returns `503` with problem code `catalog.database_unavailable` when `SELECT 1` fails.

- [ ] **Step 5: Run the focused and package tests**

Run: `uv run --project api pytest api/tests/test_health.py -v`

Expected: PASS, 2 tests after adding liveness and readiness cases.

- [ ] **Step 6: Document local API startup**

Document `uv run --project api uvicorn vonk_catalog.api:create_app --factory --reload` and the exact required environment variable `VONK_DATABASE_URL`.

- [ ] **Step 7: Commit the API foundation**

```bash
git add .gitignore README.md pyproject.toml uv.lock api
git commit -m "feat: establish catalog API foundation"
```

### Task 2: React/Vite public-site shell

**Files:**
- Create: `web/package.json`
- Create: `web/tsconfig.json`
- Create: `web/vite.config.ts`
- Create: `web/index.html`
- Create: `web/src/main.tsx`
- Create: `web/src/app.tsx`
- Create: `web/src/styles.css`
- Create: `web/src/app.test.tsx`
- Create: `web/src/test-setup.ts`

**Interfaces:**
- Produces: `App` with routes `/`, `/recipes`, `/recipes/:publisher/:slug`, and `/publish`
- Consumes later: generated `web/src/api/schema.d.ts`

- [ ] **Step 1: Write a failing public-shell test**

```tsx
import { render, screen } from "@testing-library/react";
import { App } from "./app";

test("explains the public catalog boundary", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: /many sparks\. one forge/i })).toBeVisible();
  expect(screen.getByText(/images and weights stay in their registries/i)).toBeVisible();
});
```

- [ ] **Step 2: Verify RED**

Run: `npm --prefix web test -- --run src/app.test.tsx`

Expected: FAIL because `web/package.json` or `App` does not exist.

- [ ] **Step 3: Add the pinned frontend workspace**

Use React `19.2.8`, React DOM `19.2.8`, TypeScript `5.9.3`, Vite `8.2.0`, Vitest `4.1.10`, Testing Library React `16.3.2`, jest-dom `6.9.1`, jsdom `29.0.1`, and `openapi-fetch` `0.13.8`. TypeScript 5.9 is intentionally pinned because the OpenAPI generator's stable peer contract does not yet include TypeScript 7.

Run: `npm --prefix web install`

- [ ] **Step 4: Implement the accessible catalog shell**

Render a header with Vonk Forge branding, catalog search link, publisher link, and explicit text that the site stores metadata rather than payload bytes. Use semantic `<nav>`, `<main>`, and one `<h1>`; do not add a component framework.

- [ ] **Step 5: Verify test and production build**

Run: `npm --prefix web test -- --run && npm --prefix web run build`

Expected: Vitest passes and Vite creates `web/dist/index.html` with no TypeScript errors.

- [ ] **Step 6: Commit the web shell**

```bash
git add web
git commit -m "feat: add public catalog web shell"
```

### Task 3: Versioned canonical recipe contract

**Files:**
- Create: `schemas/recipe/v1.schema.json`
- Create: `schemas/problem/v1.schema.json`
- Create: `schemas/test-report/v1.schema.json`
- Create: `schemas/fixtures/recipe-v1-minimal.json`
- Create: `schemas/fixtures/recipe-v1-multinode.json`
- Create: `api/src/vonk_catalog/canonical.py`
- Create: `api/src/vonk_catalog/contracts.py`
- Create: `api/tests/test_recipe_contract.py`
- Create: `api/tests/test_canonical.py`

**Interfaces:**
- Produces: `canonical_json(value: object) -> bytes`
- Produces: `content_sha256(value: object) -> str`
- Produces: `validate_recipe(document: Mapping[str, object]) -> None`

- [ ] **Step 1: Write failing canonicalization tests**

```python
from vonk_catalog.canonical import canonical_json, content_sha256


def test_canonical_json_sorts_keys_and_has_no_whitespace() -> None:
    assert canonical_json({"z": 1, "a": [True, None]}) == b'{"a":[true,null],"z":1}'


def test_content_hash_is_lowercase_sha256() -> None:
    assert content_sha256({"a": 1}) == "015abd7f5cc57a2dd94b7590f04ad8084273905ee33ec5cebeae62276a97f862"
```

- [ ] **Step 2: Verify RED**

Run: `uv run --project api pytest api/tests/test_canonical.py -v`

Expected: FAIL because `vonk_catalog.canonical` does not exist.

- [ ] **Step 3: Implement constrained canonical JSON**

Use `json.dumps(value, ensure_ascii=False, allow_nan=False, sort_keys=True, separators=(",", ":"))`, encode UTF-8, reject duplicate object keys during parsing, and reject floats in contract documents so Python and JavaScript number formatting cannot diverge.

- [ ] **Step 4: Write the failing schema test**

```python
import json
from pathlib import Path
import jsonschema


def test_minimal_recipe_fixture_matches_v1() -> None:
    root = Path(__file__).resolve().parents[2]
    schema = json.loads((root / "schemas/recipe/v1.schema.json").read_text())
    fixture = json.loads((root / "schemas/fixtures/recipe-v1-minimal.json").read_text())
    jsonschema.Draft202012Validator(schema).validate(fixture)
```

- [ ] **Step 5: Define the complete v1 recipe shape**

Require these top-level fields and set `additionalProperties: false` at every object boundary:

```json
{
  "schema_version": 1,
  "identity": {"publisher": "vonk", "slug": "qwen3-vllm"},
  "metadata": {"title": "Qwen3 on vLLM", "description": "...", "tags": ["text"]},
  "workload": {"family": "qwen3", "capabilities": ["openai.chat"]},
  "artifacts": [{"kind": "huggingface.snapshot", "repository": "Qwen/Qwen3", "revision": "0123456789abcdef0123456789abcdef01234567", "expected_bytes": 1}],
  "runtime": {"family": "vllm", "image": "ghcr.io/example/vllm@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "architecture": "linux/arm64", "arguments": []},
  "resources": {"per_node": {"download_bytes": 1, "installed_bytes": 1, "staging_bytes": 1, "resident_memory_bytes": 1, "activation_memory_bytes": 1}, "measurement": "declared"},
  "topology": {"kind": "single", "min_nodes": 1, "max_nodes": 1, "tested_node_counts": [1]},
  "endpoint": {"protocol": "openai", "port": 8000, "model_aliases": ["qwen3"], "health_path": "/v1/models"},
  "security": {"devices": ["nvidia.com/gpu=all"], "capabilities": [], "host_network": false, "privileged": false, "mounts": []},
  "provenance": {"source_kind": "local", "source_reference": null, "attribution": []}
}
```

The multi-node fixture uses `kind: "gang"`, two rank records, and an explicit fabric requirement. The schema rejects shell strings, `command`, `install`, `mods`, `privileged: true`, host root mounts, mutable image tags, and non-positive unknown resource values.

- [ ] **Step 6: Verify schema positive and negative fixtures**

Run: `uv run --project api pytest api/tests/test_recipe_contract.py api/tests/test_canonical.py -v`

Expected: PASS for both valid fixtures and rejection tests for mutable image, raw command, missing sizes, and undeclared multi-node ranks.

- [ ] **Step 7: Commit public contracts**

```bash
git add schemas api/src/vonk_catalog/canonical.py api/src/vonk_catalog/contracts.py api/tests
git commit -m "feat: publish recipe contract v1"
```

### Task 4: Initial catalog database and migration

**Files:**
- Create: `api/src/vonk_catalog/db.py`
- Create: `api/src/vonk_catalog/models.py`
- Create: `api/migrations/versions/0001_catalog_foundation.py`
- Create: `api/tests/test_migration.py`
- Create: `api/tests/test_models.py`

**Interfaces:**
- Produces tables: `users`, `oauth_accounts`, `publishers`, `publisher_memberships`, `recipes`, `recipe_drafts`, `recipe_revisions`, `validation_results`, `test_reports`, `recipe_forks`, `moderation_events`, `catalog_jobs`
- Produces: `build_engine(database_url: str) -> Engine`
- Produces: `session_factory(engine: Engine) -> sessionmaker[Session]`

- [ ] **Step 1: Write the failing migration-head test**

```python
from alembic.script import ScriptDirectory


def test_catalog_has_one_migration_head(alembic_config) -> None:
    assert ScriptDirectory.from_config(alembic_config).get_heads() == ["0001_catalog_foundation"]
```

- [ ] **Step 2: Verify RED**

Run: `uv run --project api pytest api/tests/test_migration.py -v`

Expected: FAIL because no revision exists.

- [ ] **Step 3: Create relational identity and immutable revision models**

Use UUID strings for internal IDs, lowercase publisher/recipe slugs, timezone-aware timestamps, JSONB on PostgreSQL with SQLAlchemy `JSON` fallback for SQLite tests, and these invariants:

- `(publisher_id, slug)` uniquely identifies a recipe;
- `(recipe_id, revision_number)` and `(recipe_id, content_sha256)` are unique;
- published revision canonical JSON, hash, schema version, and publication timestamp are non-null;
- draft `version` is an integer optimistic-lock fence;
- official status is absent from recipe rows and derived from publisher role;
- moderation is append-only and cannot overwrite revision bytes;
- jobs use unique idempotency key, lease deadline, attempt, and stable problem code.

- [ ] **Step 4: Implement reversible migration**

Create all indexes needed for publisher slug, recipe slug, runtime family, workload family, topology kind, node count, memory, disk, state, updated time, and content hash. Downgrade drops only the objects created in `0001_catalog_foundation` in reverse dependency order.

- [ ] **Step 5: Verify upgrade, constraints, and downgrade**

Run: `uv run --project api pytest api/tests/test_migration.py api/tests/test_models.py -v`

Expected: PASS, including rejection of duplicate immutable revision content, revision mutation, duplicate OAuth identity, and membership outside a publisher.

- [ ] **Step 6: Commit database foundation**

```bash
git add api/src/vonk_catalog/db.py api/src/vonk_catalog/models.py api/migrations api/tests
git commit -m "feat: add global catalog database"
```

### Task 5: Public read API and OpenAPI artifact

**Files:**
- Create: `api/src/vonk_catalog/problems.py`
- Create: `api/src/vonk_catalog/repositories.py`
- Create: `api/src/vonk_catalog/public_api.py`
- Create: `api/tests/test_public_api.py`
- Create: `api/tools/export_openapi.py`
- Create: `openapi/openapi.json`
- Create: `web/src/api/client.ts`
- Create: `web/src/api/schema.d.ts`

**Interfaces:**
- Produces: `GET /v1/recipes`
- Produces: `GET /v1/recipes/{publisher}/{slug}`
- Produces: `GET /v1/recipes/{publisher}/{slug}/revisions/{revision}`
- Produces: `GET /v1/schemas/recipe/v1`
- Produces cursor format: URL-safe base64 of canonical `{"published_at": ..., "id": ...}`

- [ ] **Step 1: Write the failing immutable-revision API test**

```python
def test_revision_response_is_immutable_and_etagged(client, published_recipe) -> None:
    response = client.get("/v1/recipes/vonk/qwen3/revisions/1")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "public, max-age=31536000, immutable"
    assert response.headers["etag"] == f'"sha256:{published_recipe.content_sha256}"'
    assert response.json()["content_sha256"] == published_recipe.content_sha256
```

- [ ] **Step 2: Verify RED**

Run: `uv run --project api pytest api/tests/test_public_api.py -v`

Expected: FAIL with `404` because public routes are absent.

- [ ] **Step 3: Implement repository and public API**

Search accepts bounded `q`, `runtime`, `workload_family`, `topology`, `min_nodes`, `max_nodes`, `max_memory_bytes`, `max_installed_bytes`, `publisher`, `trust`, `limit <= 100`, and opaque cursor. Search returns only published, non-unlisted revisions. Direct immutable revision retrieval remains available after deprecation and returns `410` plus moderation metadata only after explicit revocation.

- [ ] **Step 4: Implement stable problem documents**

Every API error has:

```json
{"type":"https://api.vonkforge.ai/problems/catalog.not_found","title":"Recipe not found","status":404,"code":"catalog.not_found","detail":"The requested published recipe does not exist.","request_id":"..."}
```

No exception string, SQL, token, URL credential, or registry response body enters `detail`.

- [ ] **Step 5: Export and verify OpenAPI**

Run: `uv run --project api python api/tools/export_openapi.py && git diff --exit-code openapi/openapi.json`

Expected after staging the intended artifact: exporter is deterministic and a second invocation produces no diff.

- [ ] **Step 6: Generate TypeScript declarations and client wrapper**

Use `openapi-typescript openapi/openapi.json -o web/src/api/schema.d.ts`. The wrapper sets `Accept: application/json`, forwards ETags, and throws a typed `Problem` without interpreting unknown codes.

- [ ] **Step 7: Verify API, schema, and web types**

Run: `uv run --project api pytest api/tests/test_public_api.py -v && npm --prefix web run build`

Expected: PASS with deterministic OpenAPI and no TypeScript errors.

- [ ] **Step 8: Commit public API**

```bash
git add api openapi web/src/api
git commit -m "feat: expose public recipe catalog API"
```

### Task 6: Container and Railway deployment foundation

**Files:**
- Create: `api/Dockerfile`
- Create: `web/Dockerfile`
- Create: `worker/Dockerfile`
- Create: `worker/src/vonk_worker/__init__.py`
- Create: `worker/src/vonk_worker/main.py`
- Create: `worker/tests/test_worker_health.py`
- Create: `deploy/compose.yaml`
- Create: `deploy/railway/api.toml`
- Create: `deploy/railway/web.toml`
- Create: `deploy/railway/worker.toml`
- Create: `deploy/Caddyfile`
- Create: `deploy/tests/test_compose.py`
- Modify: `pyproject.toml`
- Modify: `README.md`

**Interfaces:**
- Produces images: `vonk-catalog-api`, `vonk-catalog-web`, `vonk-catalog-worker`
- Produces worker loop: `claim -> lease -> execute -> result/retry`
- Requires secret: `VONK_DATABASE_URL`

- [ ] **Step 1: Write failing Compose structure test**

```python
def test_compose_has_separate_public_and_private_services(rendered_compose) -> None:
    services = rendered_compose["services"]
    assert set(services) == {"postgres", "api", "web", "worker"}
    assert "ports" not in services["postgres"]
    assert "ports" not in services["worker"]
```

- [ ] **Step 2: Verify RED**

Run: `uv run --project api pytest deploy/tests/test_compose.py -v`

Expected: FAIL because `deploy/compose.yaml` does not exist.

- [ ] **Step 3: Build non-root, health-checked images**

API and worker use the locked Python environment, run as UID/GID `10001`, have read-only roots and writable `/tmp` tmpfs. Web builds static assets and serves them with an unprivileged server. No image contains `.git`, tests, OAuth secrets, database URLs, or developer caches.

- [ ] **Step 4: Add PostgreSQL-backed worker heartbeat**

The worker claims no external validation behavior yet. It records a process heartbeat and safely sleeps when no job is available, proving the service topology without inventing a queue backend.

- [ ] **Step 5: Add provider-neutral local Compose and Railway configs**

Compose uses PostgreSQL 18 with a health check and named volume. Railway configs specify one start command and `/health/ready` for API, static health for web, and worker restart policy. Migrations run as an explicit release command, not concurrently in every API replica.

- [ ] **Step 6: Verify images and services**

Run: `docker compose -f deploy/compose.yaml config && docker compose -f deploy/compose.yaml build && docker compose -f deploy/compose.yaml up -d --wait`

Then run: `curl --fail http://127.0.0.1:8080/health/ready && docker compose -f deploy/compose.yaml exec -T postgres pg_isready`

Expected: both commands succeed; worker and PostgreSQL publish no host port.

- [ ] **Step 7: Tear down test deployment without deleting its volume**

Run: `docker compose -f deploy/compose.yaml down`

Expected: containers and networks stop; no `--volumes` is used.

- [ ] **Step 8: Commit deployment foundation**

```bash
git add api web worker deploy pyproject.toml uv.lock README.md
git commit -m "feat: add catalog deployment foundation"
```

### Task 7: Continuous integration and contract release gate

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/dependabot.yml`
- Create: `api/tests/test_repository_boundaries.py`
- Create: `scripts/verify-contracts`
- Modify: `README.md`

**Interfaces:**
- Produces required checks: `python`, `web`, `contracts`, `containers`
- Produces release artifact: `vonk-contracts-v1.tar.gz`

- [ ] **Step 1: Write repository-boundary tests**

Assert no file outside fixtures contains a token-like secret, no schema permits `command` or privileged recipes, no API module imports `docker`, no worker imports web code, and no model/image payload extension (`.safetensors`, `.gguf`, `.tar`) is tracked.

- [ ] **Step 2: Verify the boundary tests fail before the verifier exists**

Run: `uv run --project api pytest api/tests/test_repository_boundaries.py -v`

Expected: FAIL because `scripts/verify-contracts` is absent or not executable.

- [ ] **Step 3: Implement deterministic contract verification**

The script validates all schemas against Draft 2020-12, validates every fixture, recalculates fixture canonical hashes, exports OpenAPI twice and compares bytes, and checks the TypeScript declaration is current.

- [ ] **Step 4: Add GitHub Actions jobs**

Use pinned action revisions, Python 3.12, Node version compatible with Vite 8, PostgreSQL 18 service, uv cache keyed by `uv.lock`, npm cache keyed by `web/package-lock.json`, and Docker BuildKit. Workflows receive no production environment and use only GitHub's ephemeral token with `contents: read` unless a release job explicitly needs more.

- [ ] **Step 5: Run the complete local CI equivalent**

Run:

```bash
uv run --project api pytest api/tests worker/tests deploy/tests -q
npm --prefix web test -- --run
npm --prefix web run build
scripts/verify-contracts
docker compose -f deploy/compose.yaml config --quiet
```

Expected: all commands exit `0` with no skipped security or contract test.

- [ ] **Step 6: Commit CI foundation**

```bash
git add .github scripts api/tests README.md
git commit -m "ci: enforce catalog contracts and boundaries"
```

## Plan acceptance

Run from a clean clone:

```bash
uv sync --all-packages --locked
npm --prefix web ci
uv run --project api pytest api/tests worker/tests deploy/tests -q
npm --prefix web test -- --run
npm --prefix web run build
scripts/verify-contracts
docker compose -f deploy/compose.yaml config --quiet
```

The foundation is accepted when the commands pass, `git status --short` is empty, the public API serves only seeded fixture revisions, the web site builds, PostgreSQL upgrade/downgrade is proven, and the generated contract artifact can be pinned by `vonk-forge` without importing this repository's Python code.
