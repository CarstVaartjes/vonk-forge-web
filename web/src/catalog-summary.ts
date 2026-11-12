// Builds catalog-summary.json from the verified index. recipe-release.mjs runs
// this under Node right after it verifies the release, using the same adapter,
// type mapping and derivation the pages use: there is no second hand-written count.
import { parseLibraryIndex, recipesFromIndex } from "./api/static-catalog.ts";
import { deriveCatalogStats, parseCatalogSummary, type CatalogSummary } from "./catalog-stats.ts";

export function buildCatalogSummary(rawIndex: unknown, rawRelease: { tag: string; catalog_index_sha256: string }): CatalogSummary {
  const index = parseLibraryIndex(rawIndex, rawRelease);
  const summary = { summary_version: 1, release: rawRelease.tag, catalog_index_sha256: rawRelease.catalog_index_sha256, ...deriveCatalogStats(recipesFromIndex(index), index.vocabulary) };
  // Round-trip through the browser's own check: a summary the site would refuse is a build failure.
  return parseCatalogSummary(JSON.parse(JSON.stringify(summary)));
}
