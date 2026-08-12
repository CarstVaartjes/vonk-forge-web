# Platform Story Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the public catalog an accurate, polished home page that explains the catalog, NAS control, and Spark-native runtime boundaries.

**Architecture:** Keep the existing route-free React shell and replace only `HomePage`'s semantic sections plus shared presentation CSS. Existing recipe, publisher, API, and deployment code remains unchanged; tests assert product claims while Playwright screenshots verify responsive presentation.

**Tech Stack:** React 19, TypeScript 5.9, Vite 8, CSS, Vitest/Testing Library, Playwright.

## Global Constraints

- The global catalog never controls Sparks, executes workloads, stores runtime secrets, or accepts model uploads.
- Development uses accepted `main` artifacts through `:dev` and signed APT `dev`; production remains behind signed releases and the trusted updater.
- Preserve all existing routes, API/schema contracts, Cloudflare Pages behavior, keyboard navigation, 320 px usability, and reduced-motion support.
- Add no bitmap assets or runtime dependency.

---

### Task 1: Accurate platform story

**Files:**
- Modify: `web/src/app.test.tsx`
- Modify: `web/src/pages/home.tsx`

**Interfaces:**
- Consumes: the existing `HomePage(): JSX.Element`, `/recipes`, and `/publish` routes.
- Produces: semantic `hero`, `system-map`, `trust-boundary`, `release-lanes`, and final call-to-action sections.

- [x] **Step 1: Add failing home-page contract tests**

Assert visible text for `Catalog`, `NAS control`, `Spark runtime`, `NVIDIA + Docker`, `Secrets stay local`, `:dev`, and `Trusted updater`, while retaining the recipes and publish links.

- [x] **Step 2: Run the focused test and verify RED**

Run `npm --prefix web test -- --run src/app.test.tsx`.
Expected: failure because the new architecture and channel text is absent.

- [x] **Step 3: Implement semantic home-page sections**

Replace the two-section home page with an accessible hero, a numbered three-card flow, a trust-boundary panel, two release-lane cards, and a final CTA. Keep claims literal: content-addressed source/evidence in the catalog; Compose and file secrets on the operator NAS; rootless build plus Spark-provided Docker/NVIDIA runtime and node-local model cache.

- [x] **Step 4: Run focused and full unit tests**

Run `npm --prefix web test -- --run src/app.test.tsx` and `npm --prefix web test -- --run`.
Expected: 3 test files and all tests pass.

- [x] **Step 5: Commit the semantic change**

```bash
git add web/src/app.test.tsx web/src/pages/home.tsx
git commit -m "feat(web): explain the local-first platform"
```

### Task 2: Visual system and responsive proof

**Files:**
- Modify: `web/src/app.tsx`
- Modify: `web/src/styles.css`
- Modify: `web/e2e/catalog.spec.ts`
- Modify: `README.md`
- Modify: `docs/README.md`

**Interfaces:**
- Consumes: Task 1's section class names and existing catalog/publisher selectors.
- Produces: polished responsive layout, focus states, reduced-motion behavior, home smoke coverage, and current deployment-boundary documentation.

- [x] **Step 1: Add a failing responsive home E2E test**

Visit `/`, require the `Build where the models live` hero, the three-stage map, both release lanes, and working recipe/publish links in Chromium and Pixel 7 projects.

- [x] **Step 2: Run the home E2E test and verify RED**

Run `npm --prefix web run test:e2e -- --grep "platform story"`.
Expected: failure until the styled semantic contract is complete.

- [x] **Step 3: Implement the visual system**

Refine global tokens, body grid/glow, sticky translucent header, brand mark, display type, buttons, flow cards, boundary panel, release cards, focus-visible states, hover states, mobile breakpoints, and `prefers-reduced-motion`. Reuse those tokens across existing catalog and publisher screens without changing their structure.

- [x] **Step 4: Update repository boundary documentation**

Describe the static site as the public recipe/publishing surface and link its story to local NAS/Spark execution, while retaining the explicit deferred-global-backend boundary.

- [x] **Step 5: Verify all frontend and contract gates**

Run:

```bash
npm --prefix web test -- --run
npm --prefix web run build
npm --prefix web run test:e2e
scripts/verify-contracts
git diff --check
```

Expected: all unit/E2E tests pass, Vite build exits zero, contract artifacts remain synchronized, and no whitespace errors exist.

- [x] **Step 6: Inspect desktop and mobile screenshots**

Capture `/` at 1440×1000 and 393×852, then verify no clipping, horizontal overflow, illegible contrast, or accidental above-the-fold overlap.

- [x] **Step 7: Commit**

```bash
git add web/src/app.tsx web/src/styles.css web/e2e/catalog.spec.ts README.md docs/README.md
git commit -m "style(web): forge a clearer catalog experience"
```

### Task 3: Review and publication

**Files:**
- Verify only; fix any actionable review findings in the smallest owning file.

**Interfaces:**
- Consumes: Tasks 1 and 2's tested branch.
- Produces: reviewed PR, green CI, merged main, and successful Cloudflare Pages deployment.

- [x] **Step 1: Request independent review and resolve every Critical or Important finding.**
- [x] **Step 2: Re-run the complete Task 2 verification commands on the final diff.**
- [x] **Step 3: Push, open a PR, and merge only after required CI is green.**
- [x] **Step 4: Verify the main-branch Pages workflow succeeds and `https://vonkforge.ai` serves the new hero.**

Publication completed through [PR #24](https://github.com/CarstVaartjes/vonk-forge-web/pull/24),
merged as `a97b1fac4a6f5cea1a9bfbd4d640ebce366b441e` after Python, web,
contracts, containers, security, and Trivy checks passed. The exact merge was
deployed by [Pages run 31650693658](https://github.com/CarstVaartjes/vonk-forge-web/actions/runs/31650693658),
and the live domain served the reviewed asset identities and hero over HTTPS.
