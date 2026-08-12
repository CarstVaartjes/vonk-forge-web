# Platform story refresh design

## Goal

Make the public Vonk Forge catalog accurately explain the accepted local
platform while preserving the global-catalog boundary and every existing
catalog/publishing contract.

## Direction

Use an editorial systems map rather than a generic product dashboard. The home
page remains dark and forge-like, but gains a clearer type scale, restrained
orange/ivory palette, subtle grid and glow depth, and compact technical labels.
The page should feel deliberate and operational without pretending that the
future global API is already required or hosted.

## Information architecture

1. The hero leads with local-first, reproducible AI infrastructure and links to
   recipe discovery and publishing.
2. A three-stage flow shows the public typed catalog, the operator-owned NAS
   control plane, and Spark-native NVIDIA/Docker execution.
3. A trust-boundary section states that source and evidence are
   content-addressed, runtime secrets stay in NAS files, and model weights stay
   at immutable origins and in node-local caches rather than container images.
4. A release-channel strip distinguishes accepted `main` development artifacts
   (`:dev` and signed APT `dev`) from production releases selected through the
   trusted updater. It does not present mutable `latest` as a production update
   authority.
5. The footer-level call to action returns visitors to recipes or publishing.

## Constraints

- Do not add a global control-plane claim, hosted Spark execution, telemetry,
  runtime secret upload, model upload, or image-building claim.
- Do not change API routes, catalog cards, publisher workflow, generated
  contracts, or Cloudflare Pages deployment.
- Keep navigation keyboard-accessible, semantic landmarks intact, color
  contrast strong, responsive layouts usable at 320 px, and decorative motion
  disabled under `prefers-reduced-motion`.
- Use CSS and existing code-native marks only; no new bitmap asset is needed.

## Verification

- Add home-page tests for the local boundary, Spark-native execution, and
  distinct development/production language.
- Run the full Vitest suite, TypeScript/build, and Playwright catalog suite.
- Inspect desktop and mobile screenshots for clipping, hierarchy, and contrast.
- Run repository contract verification so visual work cannot drift the public
  API/schema bundle.
