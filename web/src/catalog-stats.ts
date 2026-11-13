// What the home page shows about the catalog. The Pages build derives it once
// from the verified index (catalog-summary.json); the browser only validates
// and reads it. Loaded under Node by the release build, so runtime imports use .ts.
import type { RecipeDetail, RecipeSummary } from "./api/client";
import { foldCreators, modelFamilyTitle } from "./catalog-filters.ts";
import { isVerified } from "./qualification-status.ts";
import type { Vocabulary } from "./vocabulary.ts";

export interface CreatorCount {
  name: string;
  verified: number;
}

// One recipe as the wall and the picker need it. Everything is a catalog fact; the status is the
// word the release published, and `verified` is the vocabulary's flag for it.
export interface RecipeRow {
  publisher: string;
  slug: string;
  title: string;
  creator: string | null;
  sparks: number;
  status: string;
  verified: boolean;
  // Not verified now, but the catalog holds an earlier hardware pass.
  passedBefore: boolean;
  types: string[];
  engine: string | null;
  // Declared runtime memory per Spark; absent when the recipe declares none.
  memoryBytes: number | null;
  // Peak measured on hardware per Spark; present only for a recipe that has one.
  measuredBytes: number | null;
  released: string;
  // When its newest hardware pass ran.
  tested: string | null;
}

// The facts of one hardware pass, as the receipt shows them. Every field is optional in the
// catalog, so each is null when the release does not carry it and the receipt then leaves it out.
export interface ReceiptFacts {
  title: string;
  creator: string | null;
  status: string;
  tested: string;
  sparks: number | null;
  hardwareClass: string | null;
  measuredBytes: number | null;
  contentSha256: string;
  imageDigest: string | null;
  evidenceRef: string | null;
}

// A recipe's newest hardware pass as a receipt; null for a recipe with no pass on record. One owner:
// the home page's receipt and the recipe page's both come from here.
export function receiptFacts(recipe: StatsRecipe, creator: string | null): ReceiptFacts | null {
  const { evidence } = recipe;
  if (!evidence) return null;
  return {
    title: recipe.title,
    creator,
    status: recipe.catalog.qualification,
    tested: evidence.tested_at,
    sparks: evidence.spark_count ?? null,
    hardwareClass: evidence.hardware_class ?? null,
    measuredBytes: recipe.capacity?.measured_memory_bytes_per_node ?? null,
    contentSha256: recipe.content_sha256,
    imageDigest: evidence.image_digest ?? null,
    evidenceRef: evidence.evidence_ref ?? null,
  };
}

export interface CatalogStats {
  total: number;
  // Every status present in the release, with its count, in vocabulary order; `verified` is the
  // vocabulary's flag and `meaning` the sentence it publishes for the status.
  statuses: Array<{ status: string; count: number; verified: boolean; meaning: string }>;
  // Recipes per number of Sparks they need, ascending, with how many are verified.
  bySparks: Array<{ sparks: number; total: number; verified: number }>;
  recipes: RecipeRow[];
  // Recipes released per week: 16 weeks, oldest first, the last ending on the release's day.
  releasedPerWeek: Array<{ start: string; count: number }>;
  // Recipes whose newest hardware pass ran on each of the last 28 days, oldest first.
  passesPerDay: Array<{ day: string; count: number }>;
  // The receipt shown on the home page: the newest verified recipe on more than one Spark that has a
  // measured peak (chosen by that rule, not by name); null when no recipe qualifies.
  receipt: ReceiptFacts | null;
  // The three counts below are over verified recipes (published as Working).
  verified: number;
  families: number;
  creators: number;
  topCreators: CreatorCount[];
  // Verified recipes per model type, with the label the release vocabulary gives it.
  types: Array<{ id: string; label: string; verified: number }>;
}

// Newest release first, then by title: the order of the wall's shelves and of "newest that fit".
export const newestFirst = (left: RecipeRow, right: RecipeRow): number => right.released.localeCompare(left.released) || left.title.localeCompare(right.title);

export type StatsRecipe = RecipeSummary & { evidence?: RecipeDetail["evidence"] };

const DAY = 86_400_000;
const dayKey = (time: number) => new Date(time).toISOString().slice(0, 10);
const dayTime = (day: string) => Date.parse(`${day.slice(0, 10)}T00:00:00Z`);

// A fixed window of `count` buckets of `span` days ending on `end` (a date), oldest first.
function windows(end: string, count: number, span: number): Array<{ start: string; from: number; to: number }> {
  const last = dayTime(end);
  return Array.from({ length: count }, (_, index) => {
    const to = last - (count - 1 - index) * span * DAY;
    const from = to - (span - 1) * DAY;
    return { start: dayKey(from), from, to };
  });
}

function newestReceipt(verified: StatsRecipe[], nameOf: (owner: string | null | undefined) => string | null): ReceiptFacts | null {
  const candidates = verified
    .filter((recipe) => recipe.catalog.node_count > 1 && recipe.capacity?.measured_memory_bytes_per_node !== undefined && recipe.evidence)
    .sort((left, right) => right.evidence!.tested_at.localeCompare(left.evidence!.tested_at) || left.title.localeCompare(right.title));
  return candidates[0] ? receiptFacts(candidates[0], nameOf(candidates[0].catalog.source_owner)) : null;
}

export function deriveCatalogStats(recipes: StatsRecipe[], vocabulary: Vocabulary, updatedAt: string): CatalogStats {
  const verified = recipes.filter(isVerified);
  // One fold over every recipe names each creator once, so the ledger and the rows spell it the same.
  const names = new Map(foldCreators(recipes.map((recipe) => recipe.catalog.source_owner)).map(({ name }) => [name.toLowerCase(), name]));
  const nameOf = (owner: string | null | undefined) => names.get(owner?.trim().toLowerCase() ?? "") ?? null;
  const creators = new Map<string, number>();
  for (const recipe of verified) {
    const name = nameOf(recipe.catalog.source_owner);
    if (name) creators.set(name, (creators.get(name) ?? 0) + 1);
  }
  const families = new Set(verified.map((recipe) => modelFamilyTitle(recipe).trim().toLowerCase()).filter(Boolean));
  const types = vocabulary.categories.map(({ id, label }) => ({ id, label, verified: verified.filter((recipe) => recipe.catalog.types.includes(id)).length }));
  const rows: RecipeRow[] = recipes.map((recipe) => {
    return {
      publisher: recipe.publisher,
      slug: recipe.slug,
      title: recipe.title,
      creator: nameOf(recipe.catalog.source_owner),
      sparks: recipe.catalog.node_count,
      status: recipe.catalog.qualification,
      verified: recipe.catalog.verified,
      passedBefore: !recipe.catalog.verified && Boolean(recipe.evidence),
      types: recipe.catalog.types,
      engine: recipe.runtime.adapter ?? null,
      memoryBytes: recipe.capacity?.maximum_runtime_memory_bytes_per_node ?? null,
      measuredBytes: recipe.capacity?.measured_memory_bytes_per_node ?? null,
      released: recipe.published_at,
      tested: recipe.evidence?.tested_at ?? null,
    };
  });
  const endDay = updatedAt.slice(0, 10);
  const perWeek = windows(endDay, 16, 7);
  const perDay = windows(endDay, 28, 1);
  const releasedTimes = rows.map((row) => dayTime(row.released));
  const testedTimes = rows.flatMap((row) => (row.tested ? [dayTime(row.tested)] : []));
  return {
    total: recipes.length,
    statuses: vocabulary.statuses
      .map(({ status, verified, meaning }) => ({ status, count: recipes.filter((recipe) => recipe.catalog.qualification === status).length, verified, meaning }))
      .filter(({ count }) => count > 0),
    bySparks: Array.from(new Set(rows.map((row) => row.sparks))).sort((left, right) => left - right)
      .map((sparks) => ({ sparks, total: rows.filter((row) => row.sparks === sparks).length, verified: rows.filter((row) => row.sparks === sparks && row.verified).length })),
    recipes: rows,
    releasedPerWeek: perWeek.map(({ start, from, to }) => ({ start, count: releasedTimes.filter((time) => time >= from && time <= to).length })),
    passesPerDay: perDay.map(({ start, from }) => ({ day: start, count: testedTimes.filter((time) => time === from).length })),
    receipt: newestReceipt(verified, nameOf),
    verified: verified.length,
    families: families.size,
    creators: creators.size,
    topCreators: [...creators].map(([name, count]) => ({ name, verified: count }))
      .sort((left, right) => right.verified - left.verified || left.name.localeCompare(right.name, undefined, { sensitivity: "base" }))
      .slice(0, 10),
    types,
  };
}

export interface CatalogSummary extends CatalogStats {
  summary_version: 2;
  release: string;
  catalog_index_sha256: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isCount = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0;
const isList = (value: unknown, check: (item: Record<string, unknown>) => boolean): boolean => Array.isArray(value) && value.every((item) => isRecord(item) && check(item));
const isNullable = (value: unknown, check: (value: unknown) => boolean): boolean => value === null || check(value);
const isRow = (row: Record<string, unknown>): boolean =>
  isText(row.publisher) && isText(row.slug) && isText(row.title) && isNullable(row.creator, isText) && isCount(row.sparks) && row.sparks > 0
  && isText(row.status) && typeof row.verified === "boolean" && typeof row.passedBefore === "boolean"
  && Array.isArray(row.types) && row.types.every(isText) && isNullable(row.engine, isText)
  && isNullable(row.memoryBytes, isCount) && isNullable(row.measuredBytes, isCount) && isText(row.released) && isNullable(row.tested, isText);
const isReceipt = (receipt: Record<string, unknown>): boolean =>
  isText(receipt.title) && isNullable(receipt.creator, isText) && isText(receipt.status) && isText(receipt.tested) && isNullable(receipt.sparks, isCount)
  && isNullable(receipt.hardwareClass, isText) && isNullable(receipt.measuredBytes, isCount) && isText(receipt.contentSha256)
  && isNullable(receipt.imageDigest, isText) && isNullable(receipt.evidenceRef, isText);
const isText = (value: unknown): value is string => typeof value === "string" && value.length > 0;

// Accepts only a summary this site understands; a missing or malformed one is an
// error, never zeros. A release with nothing verified is valid: the counts are
// then genuinely zero and the home page shows no numbers for it.
export function parseCatalogSummary(value: unknown): CatalogSummary {
  const fail = (): never => { throw new Error("Recipe library returned an unsupported catalog summary"); };
  if (!isRecord(value) || value.summary_version !== 2 || !isText(value.release) || !/^v\d+\.\d+\.\d+$/.test(value.release) || !isText(value.catalog_index_sha256)) return fail();
  if (!isCount(value.verified) || !isCount(value.families) || !isCount(value.creators)) return fail();
  if (!isCount(value.total) || !isList(value.statuses, (item) => isText(item.status) && isCount(item.count) && typeof item.verified === "boolean" && isText(item.meaning))) return fail();
  if (!isList(value.bySparks, (item) => isCount(item.sparks) && isCount(item.total) && isCount(item.verified))) return fail();
  if (!isList(value.releasedPerWeek, (item) => isText(item.start) && isCount(item.count))) return fail();
  if (!isList(value.passesPerDay, (item) => isText(item.day) && isCount(item.count))) return fail();
  if (!isList(value.recipes, isRow) || (value.recipes as unknown[]).length !== value.total) return fail();
  if (!isNullable(value.receipt, (receipt) => isRecord(receipt) && isReceipt(receipt))) return fail();
  if (!Array.isArray(value.types) || value.types.some((type) => !isRecord(type) || !isText(type.id) || !isText(type.label) || !isCount(type.verified))) return fail();
  if (!Array.isArray(value.topCreators) || value.topCreators.some((item) => !isRecord(item) || !isText(item.name) || !isCount(item.verified))) return fail();
  return value as unknown as CatalogSummary;
}
