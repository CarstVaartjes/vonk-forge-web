// A real summary of the fixture release (catalog.fixture.ts), for tests of what the home page draws.
import { catalogIndexFixture } from "./api/catalog.fixture";
import type { CatalogIndex } from "./api/catalog-types";
import { parseLibraryIndex, recipesFromIndex } from "./api/static-catalog";
import { deriveCatalogStats, type CatalogSummary } from "./catalog-stats";

const index = catalogIndexFixture as CatalogIndex;
const release = { repository: index.repository, tag: "v4.8.0", contract_version: index.contract_version, updated_at: index.updated_at, source_commit: index.source_commit, catalog_index_sha256: "a".repeat(64) };

export const summaryFixture: CatalogSummary = {
  summary_version: 2,
  release: "v4.8.0",
  catalog_index_sha256: "a".repeat(64),
  ...deriveCatalogStats(recipesFromIndex(parseLibraryIndex(index, release)), index.vocabulary, index.updated_at),
};
