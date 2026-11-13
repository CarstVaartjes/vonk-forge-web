import type { Page } from "@playwright/test";

import { e2eCatalogIndex as catalogIndex, sourceCommit } from "../src/api/e2e-catalog.fixture.ts";
import { buildCatalogSummary } from "../src/catalog-summary.ts";

export { catalogIndex };

// The production build reads the verified recipe release that the Pages build
// writes to /catalog on this origin. Serve a fixture release at those paths so the
// static build is exercised end to end without reaching GitHub.
export const release = { repository: catalogIndex.repository, tag: "v4.8.0", contract_version: catalogIndex.contract_version, updated_at: catalogIndex.updated_at, source_commit: sourceCommit, catalog_index_sha256: "d".repeat(64) };
// What the Pages build writes beside release.json, derived by the same code from the same index.
export const catalogSummary = buildCatalogSummary(catalogIndex, release);

export async function routeRelease(page: Page): Promise<void> {
  // Block every other origin: the catalog must be served from this site.
  await page.route((url) => !["127.0.0.1", "localhost"].includes(url.hostname), (route) => route.abort());
  await page.route("**/catalog/catalog-index.json", (route) => route.fulfill({ json: catalogIndex }));
  await page.route("**/catalog/release.json", (route) => route.fulfill({ json: release }));
  await page.route("**/catalog/catalog-summary.json", (route) => route.fulfill({ json: catalogSummary }));
}
