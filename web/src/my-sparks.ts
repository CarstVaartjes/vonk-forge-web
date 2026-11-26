import { useState } from "react";

import { filtersFromParameters, nodeCountMatches, type SparkFilter } from "./catalog-filters";
import { newestFirst, type CatalogSummary, type RecipeRow } from "./catalog-stats";

// What the visitor said about their setup: how many Sparks, and the kind of model. It lives in the
// URL (`?sparks=2&type=code`, so a state can be shared) and is remembered in localStorage, so the
// catalog link and the next visit start from it. The catalog reads the same two parameters.
export interface MySparks {
  sparks: SparkFilter;
  type: string;
}

const KEY = "vonk-my-sparks";
// The one URL parser is the catalog's own (`filtersFromParameters`), so the home page and the catalog
// read `sparks` and `type` identically.
function parse(parameters: URLSearchParams): MySparks | null {
  const { sparks, type } = filtersFromParameters(parameters);
  return sparks || type ? { sparks, type } : null;
}

// The URL wins; otherwise what was remembered; otherwise nothing picked.
export function readMySparks(search: string): MySparks {
  const fromUrl = parse(new URLSearchParams(search));
  if (fromUrl) return fromUrl;
  try {
    return parse(new URLSearchParams(localStorage.getItem(KEY) ?? "")) ?? { sparks: "", type: "" };
  } catch {
    return { sparks: "", type: "" };
  }
}

// Remember the pick on this device, for the next visit and for the other page that reads it.
export function saveMySparks({ sparks, type }: MySparks): void {
  const parameters = new URLSearchParams();
  if (sparks) parameters.set("sparks", sparks);
  if (type) parameters.set("type", type);
  try {
    localStorage.setItem(KEY, parameters.toString());
  } catch {
    // Blocked storage: the URL still carries the choice.
  }
}

export function useMySparks(): [MySparks, (next: Partial<MySparks>) => void] {
  const [value, setValue] = useState(() => readMySparks(window.location.search));
  const update = (next: Partial<MySparks>) => {
    const merged = { ...value, ...next };
    const parameters = new URLSearchParams();
    if (merged.sparks) parameters.set("sparks", merged.sparks);
    if (merged.type) parameters.set("type", merged.type);
    const query = parameters.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
    saveMySparks(merged);
    setValue(merged);
  };
  return [value, update];
}

// Does the recipe fit the pick: it needs that many Sparks or fewer, and is of the chosen type.
export function fitsPick(row: Pick<RecipeRow, "sparks" | "types">, pick: MySparks): boolean {
  return nodeCountMatches(row.sparks, pick.sparks) && (!pick.type || row.types.includes(pick.type));
}

export interface FitAnswer {
  // Every recipe that fits, whatever its status: the catalog it links to lists them all.
  count: number;
  // Of those, how many are verified on a DGX Spark.
  verified: number;
  // How many need each Spark count, ascending.
  byUse: Array<{ sparks: number; count: number; newest: RecipeRow }>;
  // The newest recipes that fit, verified ones first.
  newest: RecipeRow[];
}

// Verified recipes lead the shortlists; within each, newest first.
const verifiedThenNewest = (left: RecipeRow, right: RecipeRow): number =>
  Number(right.verified) - Number(left.verified) || newestFirst(left, right);

export function fitAnswer(summary: CatalogSummary, pick: MySparks, newest = 5): FitAnswer {
  const fitting = summary.recipes.filter((row) => fitsPick(row, pick));
  return {
    count: fitting.length,
    verified: fitting.filter((row) => row.verified).length,
    byUse: Array.from(new Set(fitting.map((row) => row.sparks)))
      .sort((left, right) => left - right)
      .map((sparks) => {
        const group = fitting.filter((row) => row.sparks === sparks).sort(verifiedThenNewest);
        return { sparks, count: group.length, newest: group[0]! };
      }),
    newest: [...fitting].sort(verifiedThenNewest).slice(0, newest),
  };
}
