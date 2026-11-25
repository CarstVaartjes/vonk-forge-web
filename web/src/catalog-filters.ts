import type { RecipeSummary } from "./api/client";
// Loaded under Node by the release build (via catalog-summary.ts): runtime imports use .ts.
import { isVerified } from "./qualification-status.ts";
import { servedLabel } from "./served.ts";

export const READINESS_OPTIONS = [
  { value: "executable", label: "Executable contract" },
  { value: "integration-required", label: "Integration required" },
  { value: "not-executable", label: "Not executable" },
  { value: "not-declared", label: "Readiness not declared" },
] as const;
type BooleanFilter = "" | "true" | "false";
export type SparkFilter = "" | "1" | "2" | "3" | "4+";

// The Spark counts a visitor says they have. A count matches recipes that need that many or fewer
// (nodeCountMatches); "4+" matches every recipe, the library having none for more than eight.
export const SPARK_OPTIONS: ReadonlyArray<{
  value: Exclude<SparkFilter, "">;
  numeral: string;
  label: string;
}> = [
  { value: "1", numeral: "1", label: "1 Spark" },
  { value: "2", numeral: "2", label: "2 Sparks" },
  { value: "3", numeral: "3", label: "3 Sparks" },
  { value: "4+", numeral: "4+", label: "4+ Sparks" },
];

// "I have N Sparks" matches every recipe that needs N or fewer; "4+" matches them all (the library
// has no recipe for more than eight). One function for the home picker and the catalog filter.
export function nodeCountMatches(nodes: number, sparks: SparkFilter): boolean {
  if (!sparks || sparks === "4+") return true;
  return nodes <= Number(sparks);
}

const ENGINE_LABELS: Record<string, string> = {
  vllm: "vLLM",
  sglang: "SGLang",
  "tensorrt-llm": "TensorRT-LLM",
  "llama-cpp": "llama.cpp",
  tensorfold: "TensorFold",
  ds4: "ds4",
  diffusers: "Diffusers",
  comfyui: "ComfyUI",
  "pytorch-pipeline": "PyTorch pipeline",
  exllamav3: "ExLlamaV3",
};

// The visitor's Spark count as a sentence: "2 Sparks or fewer" (4+ is every recipe).
export function sparksFewerLabel(sparks: Exclude<SparkFilter, "">): string {
  return sparks === "4+"
    ? "Any number of Sparks"
    : `${sparks} ${sparks === "1" ? "Spark" : "Sparks"} or fewer`;
}

export function engineLabel(value: string): string {
  return ENGINE_LABELS[value] ?? humanize(value);
}
export type UpdatedFilter = "" | "7" | "30" | "90" | "365";
// The sorts the recipe table offers: the five sortable headers, and the newest-first default.
export const COLUMN_SORTS = ["recipe", "sparks", "memory", "runtime", "qualification"] as const;
export type RecipeSort = "catalog" | (typeof COLUMN_SORTS)[number];
export type SortDirection = "asc" | "desc";
export type FilterFacet =
  | "type"
  | "verified"
  | "modelFamily"
  | "model"
  | "abliterated"
  | "sourceOwner"
  | "repository"
  | "sparks"
  | "runtime"
  | "quantization"
  | "updated"
  | "qualification"
  | "readiness"
  | "serves"
  | "download"
  | "disk"
  | "memory";

interface CatalogFilters {
  query: string;
  // A model type (capability category) id from the release vocabulary; "" is every type.
  type: string;
  // "Verified on Spark": on unless turned off (verified=0) or an explicit qualification is chosen.
  verified: boolean;
  modelFamily: string;
  model: string;
  abliterated: BooleanFilter;
  sourceOwner: string;
  repository: string;
  sparks: SparkFilter;
  // Exactly this many Sparks per recipe (`uses=2`); 0 is any. The home picker's two choices link it.
  uses: number;
  runtime: string;
  quantization: string;
  updated: UpdatedFilter;
  qualification: string;
  readiness: "" | "executable" | "integration-required" | "not-executable" | "not-declared";
  download: string;
  disk: string;
  memory: string;
  sort: RecipeSort;
  direction: SortDirection;
  // Served facts (`ServedFact`) the recipe launch must all serve.
  serves: string[];
}

export const EMPTY_FILTERS: CatalogFilters = {
  query: "",
  type: "",
  verified: true,
  modelFamily: "",
  model: "",
  abliterated: "",
  sourceOwner: "",
  repository: "",
  sparks: "",
  uses: 0,
  runtime: "",
  quantization: "",
  updated: "",
  qualification: "",
  readiness: "",
  download: "",
  disk: "",
  memory: "",
  sort: "catalog",
  direction: "desc",
  serves: [],
};

const VALID_SPARKS = new Set<string>(["1", "2", "3", "4+"]);
const VALID_SORTS = new Set<string>(["catalog", ...COLUMN_SORTS]);
const VALID_DIRECTIONS = new Set<string>(["asc", "desc"]);

const VALID_READINESS = new Set<string>(READINESS_OPTIONS.map((option) => option.value));
const VALID_UPDATED = new Set<string>(["7", "30", "90", "365"]);

export function filtersFromParameters(parameters: URLSearchParams): CatalogFilters {
  const sparks = parameters.get("sparks") ?? "";
  const qualification = parameters.get("qualification") ?? "";
  const readiness = parameters.get("readiness") ?? "";
  const abliterated = parameters.get("abliterated") ?? "";
  const requestedSort = parameters.get("sort") ?? "catalog";
  const sort = VALID_SORTS.has(requestedSort) ? (requestedSort as RecipeSort) : "catalog";
  const direction = parameters.get("direction") ?? (sort === "catalog" ? "desc" : "asc");
  return {
    query: parameters.get("q") ?? "",
    type: parameters.get("type") ?? "",
    verified: parameters.get("verified") !== "0" && !qualification,
    modelFamily: parameters.get("model_family") ?? "",
    model: parameters.get("model") ?? "",
    abliterated: abliterated === "true" || abliterated === "false" ? abliterated : "",
    sourceOwner: parameters.get("creator") ?? "",
    repository: parameters.get("repository") ?? "",
    sparks: VALID_SPARKS.has(sparks) ? (sparks as SparkFilter) : "",
    uses: /^[1-9]\d?$/.test(parameters.get("uses") ?? "") ? Number(parameters.get("uses")) : 0,
    runtime: parameters.get("runtime") ?? "",
    quantization: parameters.get("quantization") ?? "",
    updated: VALID_UPDATED.has(parameters.get("updated") ?? "")
      ? (parameters.get("updated") as UpdatedFilter)
      : "",
    qualification,
    readiness: VALID_READINESS.has(readiness) ? (readiness as CatalogFilters["readiness"]) : "",
    download: capacityParameter(parameters.get("download")),
    disk: capacityParameter(parameters.get("disk")),
    memory: capacityParameter(parameters.get("memory")),
    sort,
    direction: VALID_DIRECTIONS.has(direction)
      ? (direction as SortDirection)
      : sort === "catalog"
        ? "desc"
        : "asc",
    serves: Array.from(new Set(parameters.getAll("serves").filter(Boolean))),
  };
}

export function modelFamilyTitle(recipe: RecipeSummary): string {
  if (recipe.catalog.model_family) return recipe.catalog.model_family;
  const title = recipe.catalog.model_title
    .replace(/\s+[0-9a-f]{8}$/i, "")
    .replace(/^NVIDIA\s+/i, "");
  const variant =
    /\s+(?:NVFP4|BF16|FP16|FP8|FP4|INT8|INT4|EXL3|AQLM|AWQ|GPTQ|GGUF|TorchAO|DFlash\d*|Abliterated)(?:\s|$)/i.exec(
      title,
    );
  return (variant ? title.slice(0, variant.index) : title).trim();
}

// GitHub owners differ only by case between recipes ("NVIDIA", "nvidia"); one creator.
export function sameCreator(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  return Boolean(left && right) && String(left).toLowerCase() === String(right).toLowerCase();
}

// One entry per creator regardless of letter case, named by its most common
// spelling (ties: alphabetical), with how many of the given owners it covers.
export function foldCreators(
  owners: ReadonlyArray<string | null | undefined>,
): Array<{ name: string; count: number }> {
  const groups = new Map<string, Map<string, number>>();
  for (const value of owners) {
    const owner = value?.trim();
    if (!owner) continue;
    const spellings = groups.get(owner.toLowerCase()) ?? new Map<string, number>();
    spellings.set(owner, (spellings.get(owner) ?? 0) + 1);
    groups.set(owner.toLowerCase(), spellings);
  }
  return Array.from(groups.values()).map((spellings) => ({
    name: [...spellings.entries()].sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
    )[0]![0],
    count: [...spellings.values()].reduce((total, count) => total + count, 0),
  }));
}

// A release date from the index as epoch milliseconds (NaN when unreadable).
export function releaseTime(value: string | undefined): number {
  if (!value) return Number.NaN;
  return new Date(value.length === 10 ? `${value}T00:00:00Z` : value).getTime();
}

function sparksMatch(recipe: RecipeSummary, sparks: SparkFilter): boolean {
  return nodeCountMatches(recipe.catalog.node_count, sparks);
}

// Memory, disk and download sizes are filtered by capacity bucket ("at most N GiB"), never by exact
// bytes. The bucket bounds live here and nowhere else; a bucket holds everything up to its bound.
export const CAPACITY_BUCKETS_GIB = [16, 32, 64, 128, 256, 512, 1024] as const;
const VALID_CAPACITY = new Set<string>(["unknown", ...CAPACITY_BUCKETS_GIB.map(String)]);

// The URL value of a bucket parameter, or "" when it is not one of the buckets (an old exact-byte link).
function capacityParameter(value: string | null): string {
  return value !== null && VALID_CAPACITY.has(value) ? value : "";
}

export function capacityLabel(bucket: string): string {
  return bucket === "unknown" ? "Not declared" : `≤ ${Number(bucket)} GiB`;
}

export function capacityBucketMatches(value: number | undefined, bucket: string): boolean {
  if (!bucket) return true;
  if (bucket === "unknown") return value === undefined;
  return value !== undefined && value <= Number(bucket) * 1024 ** 3;
}

// The buckets worth offering for these sizes: every bound up to the first one that covers the largest
// size, plus "unknown" when some size is not declared. Labels are unique by construction.
export function capacityBuckets(values: ReadonlyArray<number | undefined>): string[] {
  const known = values.filter((value): value is number => value !== undefined);
  const largest = Math.max(0, ...known);
  const buckets: string[] = [];
  for (const bound of CAPACITY_BUCKETS_GIB) {
    buckets.push(String(bound));
    if (largest <= bound * 1024 ** 3) break;
  }
  if (values.some((value) => value === undefined)) buckets.push("unknown");
  return buckets;
}

// The `model` parameter names a Model (all of its variants), not one variant.
export function modelKey(recipe: RecipeSummary): string {
  const facts = recipe.catalog;
  return `${facts.model_publisher}/${facts.model_slug}`;
}

export function recipeIsAbliterated(recipe: RecipeSummary): boolean {
  return recipe.catalog.alignment === "abliterated";
}

export function updatedMatches(
  recipe: RecipeSummary,
  updated: UpdatedFilter,
  now = new Date(),
): boolean {
  if (!updated) return true;
  const released = releaseTime(recipe.published_at);
  return !Number.isNaN(released) && released >= now.getTime() - Number(updated) * 86_400_000;
}

export function recipeMatches(
  recipe: RecipeSummary,
  filters: CatalogFilters,
  omitted?: FilterFacet,
): boolean {
  const facts = recipe.catalog;
  const normalized = filters.query.trim().toLocaleLowerCase();
  const queryMatches =
    !normalized ||
    [
      recipe.title,
      recipe.slug,
      facts.description,
      modelFamilyTitle(recipe),
      facts.model_title,
      facts.model_slug,
      facts.model_version_title,
      facts.model_version_slug,
      facts.source_owner ?? "",
      facts.source_repository ?? "",
      facts.runtime_distribution,
      ...facts.quantizations,
      ...facts.served.map(servedLabel),
      ...facts.tags,
    ].some((value) => value.toLocaleLowerCase().includes(normalized));
  return (
    queryMatches &&
    (omitted === "verified" || !filters.verified || isVerified(recipe)) &&
    (omitted === "type" || !filters.type || facts.types.includes(filters.type)) &&
    (omitted === "modelFamily" ||
      !filters.modelFamily ||
      modelFamilyTitle(recipe) === filters.modelFamily) &&
    (omitted === "model" || !filters.model || modelKey(recipe) === filters.model) &&
    (omitted === "abliterated" ||
      !filters.abliterated ||
      recipeIsAbliterated(recipe) === (filters.abliterated === "true")) &&
    (omitted === "sourceOwner" ||
      !filters.sourceOwner ||
      sameCreator(facts.source_owner, filters.sourceOwner)) &&
    (omitted === "repository" ||
      !filters.repository ||
      facts.source_repository === filters.repository) &&
    (omitted === "sparks" || sparksMatch(recipe, filters.sparks)) &&
    (!filters.uses || facts.node_count === filters.uses) &&
    (omitted === "runtime" || !filters.runtime || facts.runtime_distribution === filters.runtime) &&
    (omitted === "quantization" ||
      !filters.quantization ||
      facts.quantizations.includes(filters.quantization)) &&
    (omitted === "updated" || updatedMatches(recipe, filters.updated)) &&
    (omitted === "qualification" ||
      !filters.qualification ||
      facts.qualification === filters.qualification) &&
    (omitted === "readiness" ||
      !filters.readiness ||
      facts.execution_readiness === filters.readiness) &&
    (omitted === "serves" ||
      filters.serves.every((fact) => facts.served.some((s) => s === fact))) &&
    (omitted === "download" ||
      capacityBucketMatches(facts.expected_download_bytes, filters.download)) &&
    (omitted === "disk" ||
      capacityBucketMatches(recipe.capacity?.maximum_installed_bytes_per_node, filters.disk)) &&
    (omitted === "memory" ||
      capacityBucketMatches(recipe.capacity?.maximum_runtime_memory_bytes_per_node, filters.memory))
  );
}

const SORT_WORDS: Record<
  (typeof COLUMN_SORTS)[number],
  [name: string, ascending: string, descending: string]
> = {
  recipe: ["Recipe", "A to Z", "Z to A"],
  sparks: ["Sparks", "fewest first", "most first"],
  memory: ["Memory", "low to high", "high to low"],
  runtime: ["Engine", "A to Z", "Z to A"],
  qualification: ["Status", "A to Z", "Z to A"],
};

// Every sort the table can be in, in both directions, as "sort:direction" values with their words:
// the phone's Sort select lists exactly these, so it always reflects the URL.
export const SORT_CHOICES: ReadonlyArray<{ value: string; label: string }> = [
  { value: "catalog:desc", label: "Newest" },
  ...COLUMN_SORTS.flatMap((sort) =>
    (["asc", "desc"] as const).map((direction) => ({
      value: `${sort}:${direction}`,
      label: `${SORT_WORDS[sort][0]} ${SORT_WORDS[sort][direction === "asc" ? 1 : 2]}`,
    })),
  ),
];

export function sortRecipes(
  recipes: RecipeSummary[],
  sort: RecipeSort,
  direction: SortDirection = sort === "catalog" ? "desc" : "asc",
): RecipeSummary[] {
  const value = (recipe: RecipeSummary): string | number => {
    const facts = recipe.catalog;
    if (sort === "recipe") return recipe.title;
    if (sort === "sparks") return facts.node_count;
    if (sort === "runtime") return facts.runtime_distribution;
    if (sort === "qualification") return facts.qualification;
    if (sort === "memory") return recipe.capacity?.maximum_runtime_memory_bytes_per_node ?? 0;
    return recipe.published_at;
  };
  return [...recipes].sort((left, right) => {
    const leftValue = value(left);
    const rightValue = value(right);
    const comparison =
      typeof leftValue === "number" && typeof rightValue === "number"
        ? leftValue - rightValue
        : String(leftValue).localeCompare(String(rightValue), undefined, {
            numeric: true,
            sensitivity: "base",
          });
    const tieBreak = left.title.localeCompare(right.title, undefined, {
      numeric: true,
      sensitivity: "base",
    });
    const result = comparison || tieBreak;
    return direction === "desc" ? -result : result;
  });
}

// Memory and disk sizes in GiB, as the catalog tables and the showcase show them.
// `decimals` fixes the digits after the point (the recipe page shows one); without it a size of
// 10 GiB or more is a whole number.
export function gibLabel(value: number | undefined, decimals?: number): string {
  if (value === undefined) return "Not declared";
  const gib = value / 1024 ** 3;
  return `${gib.toFixed(decimals ?? (gib >= 10 ? 0 : 1))} GiB`;
}

export function humanize(value: string): string {
  if (value.startsWith("vllm-")) return `vLLM ${value.slice(5).replaceAll("-", ".")}`;
  if (value.startsWith("diffusers-")) return `Diffusers ${value.slice(10).replaceAll("-", ".")}`;
  if (value.startsWith("pytorch-")) return `PyTorch ${value.slice(8).replaceAll("-", ".")}`;
  return value.replaceAll("_", " ").replaceAll("-", " ");
}

export function sourceLabel(value: string): string {
  try {
    const parsed = new URL(value);
    return parsed.pathname.replace(/^\//, "").replace(/\.git$/, "") || parsed.hostname;
  } catch {
    return value;
  }
}
