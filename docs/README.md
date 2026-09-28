# Vonk Forge Web documentation

This repository owns the public product site, installation and architecture
guides, and the read-only model and recipe catalog at
[`vonkforge.ai`](https://vonkforge.ai). It is a static site on Cloudflare Pages
with no backend.

It does **not** install or operate workloads. Every operator runs a private local
controller from the [`vonk-forge`](https://github.com/CarstVaartjes/vonk-forge)
repository on a laptop, NAS, or server with Docker Compose.

## System boundary

| Public website (this repository) | Recipe library | Local controller | DGX Sparks |
| --- | --- | --- | --- |
| Product docs, signed installer links, read-only views of the generated catalog index | Reviewed recipe and model documents, their schemas, the generated `catalog-index.json`, and recipe packages | Compose, PostgreSQL, policy, identity, runtime secrets, recipe imports, placement, previews, and audit | Native agent, rootless source build, model caches, NVIDIA/Docker runtime execution, telemetry |

The website never builds or executes a container, accepts model weights, stores
visitor data, or receives controller authority. Container layers remain in
registries; weights remain at immutable origins and in node-local caches.

## Operations

- [Cloudflare Pages deployment](operations/cloudflare-pages.md)

## Reference

- [Repository guide](../AGENTS.md): working agreement and the checks every
  change has to pass.
- [Product context](../PRODUCT.md): who this serves and what it promises.
- [Design tokens](../DESIGN.md): the visual system the site is built from.

## Publishing flow

1. Build and test the recipe locally with Vonk Forge.
2. Open a pull request against
   [`vonk-forge-recipes`](https://github.com/CarstVaartjes/vonk-forge-recipes)
   following its authoring guide.
3. The pull request carries the regenerated `catalog-index.json`, which the
   library's CI checks against its sources before merge.
4. The website shows the new revision as soon as the library's `main` moves; no
   website deployment is needed.
5. Import that exact revision into an operator-owned local controller.
