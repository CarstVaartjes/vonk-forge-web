import type { ModelSummary, RecipeSummary } from "./api/client";
import { MODEL_TYPES, hasModelType, type ModelTypeId } from "./model-types";
import { WORKING_STATUS } from "./qualification-status";

export interface CreatorCount {
  name: string;
  verified: number;
}

export interface CatalogStats {
  recipes: number;
  verified: number;
  families: number;
  creators: number;
  topCreators: CreatorCount[];
  typeCounts: Record<ModelTypeId, number>;
  newest: RecipeSummary[];
  // True when `newest` all fall inside the last seven days; false when the
  // catalog has nothing that recent and shows its latest releases instead.
  newestThisWeek: boolean;
  newThisWeek: number;
}

const DAY = 86_400_000;

function releasedAt(recipe: RecipeSummary): number {
  const value = recipe.published_at;
  if (!value) return Number.NaN;
  return new Date(value.length === 10 ? `${value}T00:00:00Z` : value).getTime();
}

export const isVerified = (recipe: RecipeSummary): boolean => recipe.catalog.qualification === WORKING_STATUS;

// Creators differ only by letter case in the catalog ("NVIDIA", "nvidia"). One
// creator each, named by its most common spelling.
function creatorCounts(recipes: RecipeSummary[]): Array<{ name: string; total: number; verified: number }> {
  const groups = new Map<string, { spellings: Map<string, number>; total: number; verified: number }>();
  for (const recipe of recipes) {
    const owner = recipe.catalog.source_owner?.trim();
    if (!owner) continue;
    const key = owner.toLowerCase();
    const group = groups.get(key) ?? { spellings: new Map<string, number>(), total: 0, verified: 0 };
    group.spellings.set(owner, (group.spellings.get(owner) ?? 0) + 1);
    group.total += 1;
    if (isVerified(recipe)) group.verified += 1;
    groups.set(key, group);
  }
  return Array.from(groups.values()).map((group) => ({
    name: [...group.spellings.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]![0],
    total: group.total,
    verified: group.verified,
  }));
}

// Everything the home page shows about the catalog, derived from the two lists
// the single catalog adapter returns. Nothing here is typed in by hand.
export function deriveCatalogStats(recipes: RecipeSummary[], models: ModelSummary[], now = new Date(), newestLimit = 6): CatalogStats {
  const verifiedRecipes = recipes.filter(isVerified);
  const creators = creatorCounts(recipes);
  const families = new Set(models.map((model) => (model.family ?? "").trim().toLowerCase()).filter(Boolean));
  const typeCounts = Object.fromEntries(
    MODEL_TYPES.map((type) => [type.id, verifiedRecipes.filter((recipe) => hasModelType(recipe.catalog.capabilities, type.id)).length]),
  ) as Record<ModelTypeId, number>;
  const dated = recipes.filter((recipe) => !Number.isNaN(releasedAt(recipe)))
    .sort((left, right) => releasedAt(right) - releasedAt(left) || left.title.localeCompare(right.title));
  const recent = dated.filter((recipe) => releasedAt(recipe) >= now.getTime() - 7 * DAY);
  const shown = recent.length ? recent : dated;
  return {
    recipes: recipes.length,
    verified: verifiedRecipes.length,
    families: families.size,
    creators: creators.length,
    topCreators: creators.filter((creator) => creator.verified > 0)
      .sort((left, right) => right.verified - left.verified || left.name.localeCompare(right.name, undefined, { sensitivity: "base" }))
      .map(({ name, verified }) => ({ name, verified })),
    typeCounts,
    newest: shown.slice(0, newestLimit),
    newestThisWeek: recent.length > 0,
    newThisWeek: recent.length,
  };
}
