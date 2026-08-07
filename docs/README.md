# Vonk Forge Web documentation

The web repository is the global catalog and publishing service. It is not the
control plane that installs workloads on Sparks. Keep the boundary explicit:

| Concern | Owner |
| --- | --- |
| Public immutable recipe revisions and publisher identity | This repository |
| Registry metadata and submitted test-evidence validation | This repository's worker |
| Local recipe authoring, SparkRun import, install/run admission, placement, and offline operation | `vonk-forge` local PostgreSQL catalog |
| Container layers and model weights | Publisher-controlled artifact registries |

## Documents

The API and schema are the source of truth for implementation. Keep this page
and the endpoint behavior self-contained; historical planning material is not
part of the operator documentation and may be removed without changing the
public contract.

## Publishing flow

1. Build and test the container locally in Vonk Forge.
2. Push the image to a public registry and record its immutable digest.
3. Upload recipe JSON and bounded test evidence as a private draft.
4. Review validation results and explicitly publish an immutable revision.
5. Import that revision into a local Vonk Forge PostgreSQL catalog.

The global service never builds or executes a submitted container and never
accepts model-weight uploads.
