// What the home page shows about the catalog. The Pages build derives it once
// from the verified index (catalog-summary.json); the browser only validates
// and reads it. Loaded under Node by the release build, so runtime imports use .ts.
import type { RecipeSummary } from "./api/client";
import { foldCreators, modelFamilyTitle } from "./catalog-filters.ts";
import { isVerified } from "./qualification-status.ts";
import type { Vocabulary } from "./vocabulary.ts";

export interface CreatorCount {
  name: string;
  verified: number;
}

export interface CatalogStats {
  // All three counts are over verified recipes (published as Working).
  verified: number;
  families: number;
  creators: number;
  topCreators: CreatorCount[];
  // Verified recipes per model type, with the label the release vocabulary gives it.
  types: Array<{ id: string; label: string; verified: number }>;
}

export function deriveCatalogStats(recipes: RecipeSummary[], vocabulary: Vocabulary): CatalogStats {
  const verified = recipes.filter(isVerified);
  const creators = foldCreators(verified.map((recipe) => recipe.catalog.source_owner));
  const families = new Set(verified.map((recipe) => modelFamilyTitle(recipe).trim().toLowerCase()).filter(Boolean));
  const types = vocabulary.categories.map(({ id, label }) => ({ id, label, verified: verified.filter((recipe) => recipe.catalog.types.includes(id)).length }));
  return {
    verified: verified.length,
    families: families.size,
    creators: creators.length,
    topCreators: creators.map(({ name, count }) => ({ name, verified: count }))
      .sort((left, right) => right.verified - left.verified || left.name.localeCompare(right.name, undefined, { sensitivity: "base" }))
      .slice(0, 10),
    types,
  };
}

export interface CatalogSummary extends CatalogStats {
  summary_version: 1;
  release: string;
  catalog_index_sha256: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isCount = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0;
const isText = (value: unknown): value is string => typeof value === "string" && value.length > 0;

// Accepts only a summary this site understands; a missing or malformed one is an
// error, never zeros. A release with nothing verified is valid: the counts are
// then genuinely zero and the home page shows no numbers for it.
export function parseCatalogSummary(value: unknown): CatalogSummary {
  const fail = (): never => { throw new Error("Recipe library returned an unsupported catalog summary"); };
  if (!isRecord(value) || value.summary_version !== 1 || !isText(value.release) || !/^v\d+\.\d+\.\d+$/.test(value.release) || !isText(value.catalog_index_sha256)) return fail();
  if (!isCount(value.verified) || !isCount(value.families) || !isCount(value.creators)) return fail();
  if (!Array.isArray(value.types) || value.types.some((type) => !isRecord(type) || !isText(type.id) || !isText(type.label) || !isCount(type.verified))) return fail();
  if (!Array.isArray(value.topCreators) || value.topCreators.some((item) => !isRecord(item) || !isText(item.name) || !isCount(item.verified))) return fail();
  return value as unknown as CatalogSummary;
}
