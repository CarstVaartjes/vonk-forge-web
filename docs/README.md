# Vonk Forge Web documentation

This repository owns the public product site, installation and architecture
guides, recipe discovery surface, publishing contract, and catalog API artifacts
served around [`vonkforge.ai`](https://vonkforge.ai).

It does **not** install or operate workloads. Every operator runs a private local
controller from the [`vonk-forge`](https://github.com/CarstVaartjes/vonk-forge)
repository on a laptop, NAS, or server with Docker Compose.

## System boundary

| Public web repository | Local controller | DGX Sparks |
| --- | --- | --- |
| Product docs, signed installer links, immutable recipe metadata, publisher identity, bounded evidence | Compose, PostgreSQL, policy, identity, runtime secrets, recipe imports, placement, previews, and audit | Native agent, rootless source build, model caches, NVIDIA/Docker runtime execution, telemetry |

The public service never builds or executes a submitted container, accepts model
weights, or receives controller authority. Container layers remain in registries;
weights remain at immutable origins and in node-local caches.

## Operations

- [Cloudflare Pages deployment](operations/cloudflare-pages.md)
- [Deferred global API deployment](operations/railway-deployment.md)
- [Deferred backup and restore](operations/backup-restore.md)
- [Catalog moderation](operations/moderation.md)

Cloudflare Pages serves the static site. Railway remains deferred unless a global
catalog API and validation worker are explicitly enabled. Caddy belongs to each
operator's local controller and is not part of the public website.

## Publishing flow

1. Build and test the container locally with Vonk Forge.
2. Publish it to a public registry and record the immutable digest.
3. Submit recipe JSON and bounded evidence as a private draft.
4. Review validation and publish an immutable revision explicitly.
5. Import that revision into an operator-owned local controller.

The API, schemas, generated OpenAPI document, and TypeScript declarations are
the implementation contract. Historical planning material is not authority.
