// What the home page shows about the catalog. The Pages build derives it once
// from the verified index (catalog-summary.json); the browser only validates
// and reads it. Loaded under Node by the release build, so runtime imports use .ts.
import type { RecipeSummary } from "./api/client";
import { foldCreators, modelFamilyTitle, releaseTime } from "./catalog-filters.ts";
import { MODEL_TYPES, hasModelType, isModelTypeId, type ModelTypeId } from "./model-types.ts";
import { isVerified } from "./qualification-status.ts";

export interface CreatorCount {
  name: string;
  verified: number;
}

// A recipe refreshed in the library. The date is the recipe's `released_at`,
// which the library moves forward on every refresh: it says "updated", not "new".
export interface UpdatedRecipe {
  publisher: string;
  slug: string;
  title: string;
  creator: string | null;
  status: string;
  date: string;
}

export interface CatalogStats {
  // All three counts are over verified recipes (published as Working).
  verified: number;
  families: number;
  creators: number;
  topCreators: CreatorCount[];
  // Verified recipes per model type.
  types: Record<ModelTypeId, number>;
  // Recipes (any status) per update date, for the 30 days up to the newest one.
  updatedByDate: Record<string, number>;
  newest: UpdatedRecipe[];
}

const DAY = 86_400_000;
const NEWEST = 12;

function day(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

export function deriveCatalogStats(recipes: RecipeSummary[]): CatalogStats {
  const verified = recipes.filter(isVerified);
  const creators = foldCreators(verified.map((recipe) => recipe.catalog.source_owner));
  const families = new Set(verified.map((recipe) => modelFamilyTitle(recipe).trim().toLowerCase()).filter(Boolean));
  const types = Object.fromEntries(
    MODEL_TYPES.map((type) => [type.id, verified.filter((recipe) => hasModelType(recipe.catalog.capabilities, type.id)).length]),
  ) as Record<ModelTypeId, number>;
  const dated = recipes.map((recipe) => ({ recipe, time: releaseTime(recipe.published_at) })).filter((item) => !Number.isNaN(item.time))
    .sort((left, right) => right.time - left.time || left.recipe.title.localeCompare(right.recipe.title));
  const updatedByDate: Record<string, number> = {};
  const newestTime = dated[0]?.time;
  for (const item of dated) {
    if (newestTime !== undefined && item.time >= newestTime - 30 * DAY) updatedByDate[day(item.time)] = (updatedByDate[day(item.time)] ?? 0) + 1;
  }
  return {
    verified: verified.length,
    families: families.size,
    creators: creators.length,
    topCreators: creators.map(({ name, count }) => ({ name, verified: count }))
      .sort((left, right) => right.verified - left.verified || left.name.localeCompare(right.name, undefined, { sensitivity: "base" }))
      .slice(0, 10),
    types,
    updatedByDate,
    newest: dated.slice(0, NEWEST).map(({ recipe, time }) => ({
      publisher: recipe.publisher,
      slug: recipe.slug,
      title: recipe.title,
      creator: recipe.catalog.source_owner,
      status: recipe.catalog.qualification,
      date: day(time),
    })),
  };
}

// Recipes refreshed in the last seven days, judged against the visitor's clock
// so a page that was built days ago does not call old updates fresh.
export function updatedThisWeek(stats: CatalogStats, now = new Date()): { count: number; recipes: UpdatedRecipe[] } {
  const since = now.getTime() - 7 * DAY;
  const within = (date: string) => releaseTime(date) >= since;
  return {
    count: Object.entries(stats.updatedByDate).filter(([date]) => within(date)).reduce((total, [, count]) => total + count, 0),
    recipes: stats.newest.filter((recipe) => within(recipe.date)),
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
  const types = value.types;
  if (!isRecord(types) || MODEL_TYPES.some((type) => !isCount(types[type.id])) || Object.keys(types).some((key) => !isModelTypeId(key))) return fail();
  const byDate = value.updatedByDate;
  if (!isRecord(byDate) || Object.entries(byDate).some(([date, count]) => !/^\d{4}-\d{2}-\d{2}$/.test(date) || !isCount(count))) return fail();
  if (!Array.isArray(value.topCreators) || value.topCreators.some((item) => !isRecord(item) || !isText(item.name) || !isCount(item.verified))) return fail();
  if (!Array.isArray(value.newest) || value.newest.some((item) => !isRecord(item) || !isText(item.publisher) || !isText(item.slug) || !isText(item.title) || !(item.creator === null || isText(item.creator)) || !isText(item.status) || !/^\d{4}-\d{2}-\d{2}$/.test(String(item.date)))) return fail();
  return value as unknown as CatalogSummary;
}
