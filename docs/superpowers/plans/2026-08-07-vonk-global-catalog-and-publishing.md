# Vonk Global Catalog and Publishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver OAuth-backed publisher workspaces, locally uploadable drafts, registry validation, immutable publication, moderation, and a searchable public recipe website without ever receiving container or model bytes.

**Architecture:** OAuth identities join publisher namespaces. Drafts are mutable with optimistic locking; publication creates an immutable canonical recipe revision only after schema, OCI, topology, security, and submitted local-test evidence checks pass. A PostgreSQL-leased worker validates public registry metadata with SSRF defenses, and the public site reads only published revisions and derived search facets.

**Tech Stack:** FastAPI, Authlib/OIDC, SQLAlchemy, PostgreSQL, Alembic, httpx, React, TypeScript 5.9, Vite, PostgreSQL full-text/trigram search, GitHub/Google OAuth, Railway.

---

## Task 1: Add secure browser sessions and standard OAuth providers

**Files:**
- Create: `api/src/vonk_catalog/auth.py`
- Create: `api/src/vonk_catalog/oauth.py`
- Create: `api/src/vonk_catalog/session.py`
- Create: `api/src/vonk_catalog/auth_api.py`
- Create: `api/tests/test_oauth.py`
- Create: `api/tests/test_session_security.py`
- Modify: `api/src/vonk_catalog/api.py`
- Modify: `api/src/vonk_catalog/settings.py`

- [x] Write failing tests for GitHub and Google authorization start/callback, PKCE/state/nonce verification, callback mismatch, linked identities, email collision without proof, session rotation, CSRF, logout, cookie flags, and disabled provider configuration.
- [x] Run `uv run --project api pytest api/tests/test_oauth.py api/tests/test_session_security.py -q`; confirm missing modules.
- [x] Implement Authorization Code + PKCE through provider discovery/configuration. Never accept an identity from query parameters or unverified profile claims.
- [x] Discard provider tokens after verified identity resolution. Store hashed opaque application sessions server-side with expiry, last use, IP/user-agent audit metadata, and rotation lineage.
- [x] Use `Secure`, `HttpOnly`, `SameSite=Lax`, `__Host-` cookie semantics in production and a synchronizer CSRF token for mutating browser requests.
- [x] Add `GET /v1/auth/providers`, provider start/callback, `GET /v1/me`, and `POST /v1/logout`; return stable problem codes.
- [x] Run OAuth/session tests with mocked providers and confirm secrets/tokens are absent from responses and persistence.
- [x] Commit: `feat(auth): add OAuth publisher sign-in`

## Task 2: Implement publisher namespaces, memberships, and official ownership

**Files:**
- Create: `api/src/vonk_catalog/publishers.py`
- Create: `api/src/vonk_catalog/publisher_api.py`
- Create: `api/tests/test_publishers.py`
- Create: `api/tests/test_publisher_authorization.py`
- Modify: `api/src/vonk_catalog/models.py`

- [x] Write failing tests for namespace claim, normalized reserved slugs, owner/editor/viewer capabilities, invitation acceptance, last-owner protection, membership removal, audit history, and denial across publishers.
- [x] Run the scoped tests; confirm missing service/routes.
- [x] Implement publisher creation and membership management with explicit role checks in the service layer and route boundary. Reserve `vonk`, `vonk-forge`, `official`, `admin`, support/lookalike variants, and provider names.
- [x] Seed the `vonk` publisher through an idempotent production administration command tied to the configured founder OAuth subject. `official` is derived only from this publisher's immutable system role; community users cannot set it in JSON.
- [x] Add append-only audit events for namespace, membership, role, and ownership changes.
- [x] Run authorization matrix tests including direct service calls, not only HTTP routes.
- [x] Commit: `feat(publishers): add publisher namespaces and roles`

## Task 3: Add versioned private drafts and local upload API

**Files:**
- Create: `api/src/vonk_catalog/drafts.py`
- Create: `api/src/vonk_catalog/draft_api.py`
- Create: `api/tests/test_drafts.py`
- Create: `api/tests/test_upload_limits.py`
- Modify: `api/src/vonk_catalog/api.py`
- Modify: `api/src/vonk_catalog/contracts.py`

- [x] Write failing tests for create/read/update/delete draft, optimistic version conflict, schema error paths, destination publisher normalization, immutable source attribution, idempotency key replay, body/field limits, and cross-publisher access denial.
- [x] Run the tests; confirm missing endpoints.
- [x] Add authenticated JSON endpoints under `/v1/publishers/{publisher}/drafts`. Accept only recipe JSON plus bounded test-report JSON; reject archives, server-fetch envelopes, multipart binaries, image layers, and weight bytes.
- [x] Canonicalize and validate on every write, store normalized validation state, increment the version under `If-Match`, and return a new ETag.
- [x] Preserve local source identifiers and attribution but force the recipe identity publisher to the authorized destination namespace.
- [x] Enforce streaming request, array, string, node-count, and nested-object limits before expensive validation.
- [x] Run tests including stale ETags and duplicate upload retries.
- [x] Commit: `feat(drafts): accept versioned local recipe drafts`

## Task 4: Validate OCI images and test evidence safely in the worker

**Files:**
- Create: `worker/src/vonk_catalog_worker/__init__.py`
- Create: `worker/src/vonk_catalog_worker/main.py`
- Create: `worker/src/vonk_catalog_worker/leases.py`
- Create: `worker/src/vonk_catalog_worker/registry.py`
- Create: `worker/src/vonk_catalog_worker/validation.py`
- Create: `worker/tests/test_registry.py`
- Create: `worker/tests/test_validation.py`
- Create: `api/src/vonk_catalog/jobs.py`
- Modify: `pyproject.toml`

- [x] Write failing registry tests for public OCI digest resolution, manifest list with `linux/arm64`, missing ARM64, mutable tag, authentication challenge, redirect to loopback/private/link-local/metadata IP, DNS rebinding, oversized response, timeout, rate limit, and retry-after handling.
- [x] Run `uv run --project worker pytest worker/tests/test_registry.py -q`; confirm missing package.
- [x] Implement PostgreSQL job claiming with `FOR UPDATE SKIP LOCKED`, lease renewal, idempotency keys, bounded attempts, and stable retryable/terminal problem codes.
- [x] Build a registry client that permits HTTPS public registries only, revalidates every resolved/redirected address, disables ambient proxy credentials, streams within redirect/body/time caps, and never accepts publisher registry credentials.
- [x] Resolve and byte-verify the submitted digest, require ARM64 support, capture media types/layer sizes/config labels, and read only bounded config metadata—not layer blobs.
- [x] Validate submitted local test evidence against `schemas/test-report/v1.schema.json`, recipe hash, image digest, tested node count, runtime identity, timestamps, and minimum required checks. Label evidence as publisher-submitted rather than Vonk-certified.
- [x] Persist every check and evidence summary; retry transient registry failures without converting them into schema or trust success.
- [x] Run worker tests covering network isolation policy.
- [x] Commit: `feat(validation): verify public image metadata and evidence`

## Task 5: Publish immutable revisions and forks

**Files:**
- Create: `api/src/vonk_catalog/publication.py`
- Create: `api/src/vonk_catalog/publication_api.py`
- Create: `api/tests/test_publication.py`
- Create: `api/tests/test_revision_immutability.py`
- Modify: `api/src/vonk_catalog/repositories.py`

- [x] Write failing tests for publish-before-validation denial, changed-draft revalidation, successful publication, canonical hash/idempotency, revision numbering, byte mutation rejection, deletion rejection, publisher authorization, fork attribution, and official derivation.
- [x] Run the tests; confirm missing publication service.
- [x] Implement explicit `POST .../drafts/{id}/validate` and `POST .../drafts/{id}/publish`. Publication locks the draft and recipe, rehashes canonical JSON, verifies validation binds that hash/version, and inserts one immutable revision transactionally.
- [x] Return an existing revision for a repeated idempotent publish of identical content; reject reuse of an idempotency key for different content.
- [x] Implement fork creation as a new draft in the caller's publisher, retaining source revision ID/hash and attribution while requiring its own validation and publication.
- [x] Enforce immutability in ORM services and PostgreSQL/SQLite database triggers so bypass cannot update or delete revision bytes.
- [x] Run publication, migration, and authorization tests.
- [x] Commit: `feat(publication): publish immutable recipe revisions`

## Task 6: Add moderation without rewriting history

**Files:**
- Create: `api/src/vonk_catalog/moderation.py`
- Create: `api/src/vonk_catalog/moderation_api.py`
- Create: `api/tests/test_moderation.py`
- Create: `docs/operations/moderation.md`
- Modify: `api/src/vonk_catalog/public_api.py`

- [x] Write failing tests for report submission, rate limits, moderator role, hide/unhide, malware/compromise warning, publisher suspension, appeal note, audit details, and inability to mutate revision bytes.
- [x] Run the test; confirm missing service.
- [x] Implement sequenced append-only moderation events whose effective state is projected for anonymous list/detail responses. Hidden content remains in immutable storage and internal audit but not anonymous catalog responses.
- [x] Use separate system-administrator identities, recent reauthentication, and explicit step-up confirmation for publisher suspension or official-recipe changes.
- [x] Document evidence capture, notice text, reversibility, appeals, and emergency compromised-image response.
- [x] Run moderation plus revision-immutability tests.
- [x] Commit: `feat(moderation): add reversible catalog controls`

## Task 7: Build faceted search and public recipe detail pages

**Files:**
- Create: `api/src/vonk_catalog/search.py`
- Create: `api/tests/test_search.py`
- Create: `web/src/api/client.ts`
- Create: `web/src/pages/home.tsx`
- Create: `web/src/pages/recipes.tsx`
- Create: `web/src/pages/recipe-detail.tsx`
- Create: `web/src/pages/publisher.tsx`
- Create: `web/src/pages/recipes.test.tsx`
- Modify: `web/src/app.tsx`
- Modify: `web/src/styles.css`

- [x] Write backend and frontend tests first for text search, publisher, official/community, runtime/workload/capability, topology, tested nodes, disk/memory, sort, pagination, hidden state, and URL-preserved filters.
- [x] Run scoped pytest and Vitest; confirm missing search/page behavior.
- [x] Implement a typed PostgreSQL search projection using a maintained generated `tsvector`, trigram and facet indexes, opaque keyset cursors, deterministic tie-breaking, and bounded ranges.
- [x] Show immutable revision/hash, publisher status, source/fork, runtime/image digest, weight references, observed ARM64 metadata, declared disk/RAM, topology, capabilities, publisher-submitted evidence, last validation, and exact local import instructions.
- [x] Clearly separate declared, registry-observed, publisher-tested, and future Vonk-verified facts. Never display community evidence as an endorsement.
- [x] Add structured data, accessible filter controls, desktop/mobile layouts, loading/empty/error states, and canonical public URLs.
- [x] Run API, component, production-build, desktop Playwright, and mobile Playwright tests.
- [x] Commit: `feat(web): add searchable public recipe catalog`

## Task 8: Add publisher workspace and local-first publication UX

**Files:**
- Create: `web/src/pages/sign-in.tsx`
- Create: `web/src/pages/publisher-workspace.tsx`
- Create: `web/src/pages/draft-editor.tsx`
- Create: `web/src/components/validation-report.tsx`
- Create: `web/src/pages/publisher-workspace.test.tsx`
- Modify: `web/src/api/client.ts`
- Modify: `web/src/app.tsx`

- [x] Write tests first for OAuth provider choice, namespace context, uploaded draft, ETag conflict, schema problem paths, validation pending/retry/failure/success, evidence provenance, explicit publish confirmation, resulting immutable revision, and fork workflow.
- [x] Run Vitest; confirm missing pages/components.
- [x] Implement the workspace around the expected flow: build/test in local Vonk Forge, push the public digest-pinned image to the publisher's registry, upload recipe/evidence as a private draft, inspect validation, then explicitly publish.
- [x] Provide a JSON editor for corrections but do not imply that the global site can test the workload or build/push the image. Show registry and test failures with stable codes and repair guidance.
- [x] Require the user to confirm publisher, recipe slug, immutable image digest, content hash, and public visibility immediately before publish.
- [x] Run component and Playwright tests using mocked OAuth and worker completion.
- [x] Commit: `feat(web): add publisher draft and publication workspace`

## Task 9: Production hardening, backups, and Railway deployment

**Files:**
- Create: `Dockerfile.api`
- Create: `Dockerfile.worker`
- Create: `Dockerfile.web`
- Create: `railway.toml`
- Create: `scripts/backup-database`
- Create: `scripts/restore-database`
- Create: `tests/test_containers.py`
- Create: `docs/operations/railway-deployment.md`
- Create: `docs/operations/backup-restore.md`
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/deploy.yml`

- [ ] Write container tests first for non-root users, read-only root filesystem compatibility, health endpoints, no baked secrets, migration job, API/worker separation, web immutable assets, and outbound worker restrictions.
- [ ] Run the container test; confirm failure because images are absent.
- [ ] Build pinned multi-stage images. The API never needs registry egress; worker egress is limited at the platform/network layer to DNS and public HTTPS. Web serves static assets only.
- [ ] Configure separate Railway API, worker, web, migration, PostgreSQL, staging, and production resources. Use platform secrets for database/session/OAuth settings and environment protection for production deploys.
- [ ] Add rate limits, request IDs, structured redacted logs, security headers, CORS allowlist, database statement timeouts, connection caps, dependency scanning, secret scanning, SBOMs, and image signatures.
- [ ] Implement encrypted daily PostgreSQL backups to an independent object store, retention policy, and a monthly automated restore into an isolated database with row/hash counts and a sampled canonical revision verification.
- [ ] Run staging migration, smoke, OAuth, registry-validation, publish, search, backup, and restore tests before production promotion.
- [ ] Commit: `build: deploy hardened catalog services to Railway`

## Verification

```bash
uv run --project api pytest api/tests -q
uv run --project worker pytest worker/tests -q
npm --prefix web test -- --run
npm --prefix web run build
npm --prefix web run test:e2e
docker build -f Dockerfile.api -t vonk-catalog-api:test .
docker build -f Dockerfile.worker -t vonk-catalog-worker:test .
docker build -f Dockerfile.web -t vonk-catalog-web:test .
uv run pytest tests/test_containers.py -q
git diff --check
```

Completion requires a staging OAuth sign-in, publisher namespace, local draft upload, public-registry metadata validation, immutable publication, anonymous search/download, moderation hide/unhide, and successful database restore drill.
