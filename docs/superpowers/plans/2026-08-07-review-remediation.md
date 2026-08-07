# Vonk Forge Global Review Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every global catalog, worker, scaling, and deployment issue from the joint repository review.

**Architecture:** Export one machine-readable runtime policy, use a DNS-pinned TLS transport for registry metadata, and move replica-sensitive request state into PostgreSQL. Keep recipe bytes immutable while requiring origin revalidation for mutable moderation, and deploy the already signed OCI digest to Railway.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2, PostgreSQL, httpx/httpcore, Alembic, pytest, Docker Buildx, Cosign, GitHub Actions, Railway GraphQL/CLI.

## Global Constraints

- Runtime v1 is Linux/ARM64, digest-pinned, labeled `ai.vonkforge.runtime-interface=v1`, and configured as root inside the local rootless user namespace.
- Outbound registry endpoints and redirects are credential-free public HTTPS and connect only to the validated IP.
- Anonymous rate-limit identity is the trusted client IP; counters are shared in PostgreSQL.
- Public revision responses always revalidate mutable moderation state.
- Railway deploys the signed GHCR digest and never rebuilds source for production.
- Every production behavior change starts with a focused failing regression test.

---

### Task 1: Export and enforce runtime policy

**Files:** `schemas/container-runtime-policy/v1.json`, `scripts/export-contract`, `scripts/verify-contracts`, `worker/src/vonk_catalog_worker/validation.py`, `worker/tests/test_validation.py`, contract fixtures/tests.

**Interfaces:** Produces an exported runtime-policy JSON consumed by both repositories; worker image checks consume its exact architecture, interface label, and accepted root-user encodings.

- [ ] Add tests proving root-configured v1 images pass and non-root, missing-label, and wrong-label images fail.
- [ ] Run the focused tests and confirm the old non-root rule and missing label check fail.
- [ ] Add/export the policy and update validation to use it; verify declared resource bytes cover observed image layers and artifact sizes.
- [ ] Run worker and contract tests to green.
- [ ] Commit runtime policy alignment.

### Task 2: DNS-pinned registry transport

**Files:** `worker/src/vonk_catalog_worker/registry.py`, `worker/tests/test_registry.py`, and dependency lockfiles if a public transport API requires them.

**Interfaces:** Produces a transport that accepts the original hostname plus one validated IP and preserves TLS SNI/certificate checks while connecting to that IP.

- [ ] Add a network-boundary test whose DNS answer changes to a private address after validation and prove the actual connection still targets the original public IP.
- [ ] Run it and confirm the current httpx transport performs a fresh unpinned lookup.
- [ ] Implement a supported httpcore network backend or equivalent pinned HTTPS transport; repeat pinning per redirect and authentication endpoint.
- [ ] Run registry tests including TLS-hostname, redirect, timeout, oversize, and rate-limit cases.
- [ ] Commit registry transport hardening.

### Task 3: Moderation-safe reads and forks

**Files:** `api/src/vonk_catalog/public_api.py`, `publication.py`, repositories/moderation helpers, `api/tests/test_public_api.py`, `test_publication.py`, `test_moderation.py`.

**Interfaces:** Produces one effective-visibility check used by public reads and fork creation; revision responses use `public, max-age=0, must-revalidate` with their stable ETag.

- [ ] Add tests proving a previously cached revision revalidates to hidden and hidden/suspended sources cannot be forked.
- [ ] Run the tests and confirm immutable caching and fork bypass fail.
- [ ] Centralize the visibility decision, change cache policy, and enforce visibility in the fork transaction.
- [ ] Run public API, publication, and moderation tests to green.
- [ ] Commit moderation enforcement.

### Task 4: Shared abuse limits

**Files:** `api/src/vonk_catalog/security.py`, `models.py`, Alembic migration, application wiring, and `api/tests/test_security_middleware.py`, `test_migration.py`.

**Interfaces:** Produces `DatabaseRateLimiter.consume(key, bucket, maximum) -> bool`; middleware keys it with `request.state.client_ip`.

- [ ] Add tests proving cookie rotation cannot bypass a limit and two app instances sharing one database share counters.
- [ ] Run them and confirm the process-local/cookie-keyed limiter fails.
- [ ] Add the rate-limit bucket table and atomic upsert, wire it into middleware, and bound retention cleanup.
- [ ] Run security and migration tests to green.
- [ ] Commit distributed rate limiting.

### Task 5: SQL-native search pagination

**Files:** `api/src/vonk_catalog/search.py`, repositories/query helpers, `api/tests/test_search.py`.

**Interfaces:** Search produces stable `(sort_value, revision_id)` cursors and fetches `requested_limit + 1` filtered rows directly from SQL.

- [ ] Add a test with more than 1,000 preceding nonmatches and later matching rows for every supported sort direction.
- [ ] Run it and confirm the hard candidate cap loses results.
- [ ] Translate text, capability, tested-state, publisher, and cursor predicates to SQL with a deterministic tie-breaker; remove the cap.
- [ ] Run search tests on SQLite and PostgreSQL CI paths.
- [ ] Commit scalable search.

### Task 6: Deploy the signed digest to Railway

**Files:** `.github/workflows/deploy.yml`, `deploy/railway/*.toml`, `docs/operations/railway-deployment.md`, and deployment tests.

**Interfaces:** The build job outputs `image_digest`; deployment updates API, worker, migration, and backup services to `ghcr.io/...@sha256:...` after Cosign verification.

- [ ] Add a workflow/deployment test proving no `railway up` source build remains and every service consumes the build job digest.
- [ ] Run it and confirm the current workflow rebuilds source.
- [ ] Use Railway's supported image-source deployment API/CLI, pin the CLI/action version, and document required project/service IDs and token scopes.
- [ ] Run workflow lint and deployment tests.
- [ ] Commit signed-image deployment.

### Task 7: Repository verification

**Files:** All changed global files.

**Interfaces:** Produces a clean, reviewable feature branch and reproducible signed deployment path.

- [ ] Run Ruff, Mypy if configured, all API/worker/deploy tests, Alembic upgrade checks, contract export/verification, OpenAPI freshness, web unit/build/e2e smoke, and `git diff --check`.
- [ ] Inspect the complete diff, generated artifacts, and dependency locks for unrelated changes.
- [ ] Commit verification corrections and push the feature branch.
