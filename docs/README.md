# Vonk Forge Web documentation

The web repository is the future global catalog and publishing service. It is
not the control plane that installs workloads on Sparks, and it is not required
for the initial local release. Keep the boundary explicit:

| Concern | Owner |
| --- | --- |
| Public immutable recipe revisions and publisher identity | This repository |
| Registry metadata and submitted test-evidence validation | This repository's worker |
| Local recipe authoring, SparkRun import, install/run admission, placement, and offline operation | `vonk-forge` local PostgreSQL catalog |
| Container layers and model weights | Publisher-controlled artifact registries |

## Deployment boundary

- Cloudflare Pages is the target host for the static `vonkforge.ai` frontend.
- Railway is deferred until the global catalog is needed; then it will host the
  API, validation worker, and PostgreSQL database, not Spark workloads.
- The local `vonk-forge` repository owns the signed agent package release to
  Cloudflare R2 at `packages.vonkforge.ai`.
- Caddy is the ingress boundary of the local NAS control host, not a required
  global-catalog component.

## Operations

- [Deferred Railway global-backend deployment](operations/railway-deployment.md)
- [Deferred independent backup and restore](operations/backup-restore.md)
- [Moderation](operations/moderation.md)

The API, schema files, and generated OpenAPI/TypeScript artifacts are the
implementation contract. Historical planning material is not part of the
operator documentation and may be removed without changing that contract.

## Publishing flow

1. Build and test the container locally in Vonk Forge.
2. Push the image to a public registry and record its immutable digest.
3. Upload recipe JSON and bounded test evidence as a private draft.
4. Review validation results and explicitly publish an immutable revision.
5. Import that revision into a local Vonk Forge PostgreSQL catalog.

The global service never builds or executes a submitted container and never
accepts model-weight uploads.
