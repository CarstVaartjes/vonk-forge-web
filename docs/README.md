# Vonk Forge Web documentation

The exported runtime policy describes the accepted workload boundary used by
Vonk Forge agents. `host_isolation: spark-docker-nvidia-compiled-helper` means
that source builds may remain rootless and isolated, while an accepted
Linux/ARM64 image is imported and started through a narrowly compiled helper
on DGX Spark's Docker/NVIDIA runtime. It does not grant the catalog, worker, or
recipe author access to a Docker socket, host devices, or runtime secrets.

The web repository owns the public recipe catalog, publishing surface, and the
static platform story served at `vonkforge.ai`. It is not the control plane that
installs or runs workloads on Sparks. Keep the boundary explicit:

| Concern | Owner |
| --- | --- |
| Public immutable recipe revisions and publisher identity | This repository |
| Registry metadata and submitted test-evidence validation | This repository's future global worker |
| Compose, runtime secret files, policy, local recipe imports, install/run admission, placement, and offline operation | Operator NAS and the `vonk-forge` local PostgreSQL catalog |
| Rootless source builds and accepted workload execution | Spark agent through the Spark-provided NVIDIA and Docker stack |
| Container layers and model weights | Publisher-controlled registries and node-local model caches |

## Deployment boundary

- Cloudflare Pages is the target host for the static `vonkforge.ai` frontend.
- Railway is deferred until the global catalog is needed; then it will host the
  API, validation worker, and PostgreSQL database, not Spark workloads.
- The local `vonk-forge` repository owns the signed agent package release to
  Cloudflare R2 at `packages.vonkforge.ai`.
- Caddy is the ingress boundary of the local NAS control host, not a required
  global-catalog component.
- Accepted `main` commits publish development images as `:dev` and agent
  packages through the signed APT `dev` channel.
- Production stays behind immutable signed releases and the trusted host
  updater. The public site never selects or activates a production workload.

## Operations

- [Cloudflare Pages deployment](operations/cloudflare-pages.md)
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
