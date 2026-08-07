# Vonk Forge Global Review Remediation Design

## Purpose

The global service publishes immutable recipe content but must keep mutable trust decisions effective, validate the exact runtime the local Spark agent can execute, and remain safe and consistent when horizontally scaled on Railway.

## Runtime validation

The exported container policy is a versioned public contract. Runtime v1 requires a digest-pinned Linux/ARM64 image, `ai.vonkforge.runtime-interface=v1`, and an explicit numeric non-root image user. The local agent adds rootless Podman and a subordinate-UID mapping as a second isolation boundary. The worker validates every policy field and verifies that observed image and artifact byte counts fit the recipe's declared resource envelope.

## Network boundary

Registry discovery resolves only credential-free HTTPS endpoints and rejects every non-global IP. The connection is then made to the selected validated IP while the original hostname is retained for HTTP Host, TLS SNI, and certificate verification. Redirects repeat resolution and pinning independently. DNS changes between policy validation and use cannot redirect a request to a private service.

## Mutable trust over immutable content

Recipe bytes and their ETag remain immutable, but a public response must revalidate with the origin because publisher suspension and revision hiding can change. Fork creation uses the same effective-visibility decision as public reads. A hidden or suspended source cannot be copied through an authenticated endpoint.

## Shared availability controls

Request-rate counters are stored in PostgreSQL and incremented atomically per trusted client IP and fixed time bucket. Cookies never select an anonymous key. This makes limits consistent across Railway replicas. Search applies all supported filters, stable cursor ordering, and `limit + 1` pagination in SQL; no arbitrary candidate cap can hide valid later rows.

## Signed Railway deployment

CI builds one multi-stage application image, pushes it by digest to GHCR, signs that digest, verifies the signature and provenance, and then updates each Railway service to the exact digest. Railway does not rebuild production from the repository. Migrations remain a separate pre-deploy step using the same immutable image.

## Acceptance

Each reviewed bug receives a failing regression test before implementation. Completion requires the API, worker, deployment, contract, web, lint, migration, and staging-smoke checks to pass with a clean diff.
