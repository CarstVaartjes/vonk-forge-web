# Vonk Forge Product Context
<!-- impeccable:product-schema 1 -->

## Platform

Web. This repository is the public Vonk Forge website, recipe catalog, publishing surface, and installation documentation.

## Users

- Primary: NVIDIA DGX Spark owners and operators evaluating a private, self-hosted way to discover, install, and operate AI workloads.
- Secondary: teams operating several Sparks from one NAS, automation-oriented operators using `vonkctl`, and recipe publishers sharing reproducible runtime definitions.

## Product Purpose

Make Vonk Forge immediately understandable and give a new operator a safe, credible path from evaluation to their first local installation. The site should explain what the system is, show what operating it feels like, and expose the exact installer and trust boundaries without implying a hosted control plane.

## Positioning

Vonk Forge is an open-source local control plane for DGX Spark. It combines a public catalog of reproducible recipes with an operator-owned NAS controller and Spark-native execution. Catalog metadata may be public; runtime authority, secrets, model caches, and fleet state remain on infrastructure the operator controls.

## Operating Context

A workstation retrieves the signed installer, a Docker-capable NAS hosts the controller and database, and one or more Ubuntu 24.04 aarch64 DGX Sparks run workloads. Operators use the private Web Controller for guided work or the local `vonkctl` CLI for the same API-backed operations.

## Capabilities and Constraints

- Browse typed, immutable recipe revisions with source, capacity, compatibility, and evidence facts.
- Install the NAS control plane and enroll Sparks through signed, auditable installers.
- Inspect Fleet state, find and compare recipes in Library, preview changes, apply operations, and review Activity.
- Keep model weights at immutable upstream revisions or in node-local caches rather than uploading them to this public site.
- This static public website does not control customer Sparks, execute workloads, accept model uploads, store runtime secrets, or replace the operator-owned NAS authority.
- Do not invent adoption numbers, testimonials, performance claims, hardware support, or certification status.

## Brand Commitments

- Keep the established dark forge visual world: near-black surfaces, warm ivory type, disciplined NVIDIA-adjacent green, and restrained orange heat accents.
- Sound precise, capable, and plain-spoken. Prefer concrete system behavior over infrastructure theater.
- “Open source,” “local,” and “operator owned” are product facts, not decoration.

## Evidence on Hand

- Repository README and architecture, install, control, recipe, publishing, and privacy pages.
- Public source and MIT license on GitHub.
- Exact NAS and Spark installer commands documented in this repository.
- No approved customer logos, testimonials, usage metrics, benchmark comparisons, or broad hardware compatibility claims.

## Product Principles

1. Explain the product before explaining the architecture.
2. Make installation the primary action for an evaluating operator.
3. Demonstrate ease with the real operating loop, not vague “simple” claims.
4. Keep the public catalog and private authority boundary unmistakable.
5. Reveal advanced trust and release details progressively rather than front-loading them.
6. Preserve a complete browser and CLI path without making both compete in the first decision.

## Accessibility

Target WCAG 2.2 AA contrast and keyboard operation, preserve visible focus, support 320 px layouts, respect reduced-motion preferences, use semantic landmarks, and never make color the only carrier of status.
