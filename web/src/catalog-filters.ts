import type { RecipeSummary } from "./api/client";


export const CAPABILITY_OPTIONS = [
  { value: "chat", label: "Chat" },
  { value: "reasoning", label: "Reasoning" },
  { value: "vision", label: "Vision" },
  { value: "image-generation", label: "Image generation" },
  { value: "image-editing", label: "Image editing" },
  { value: "video", label: "Video" },
  { value: "audio", label: "Audio" },
  { value: "3d", label: "3D" },
] as const;

export const MODEL_TYPE_OPTIONS = [
  { value: "language", label: "Language / chat" },
  { value: "vision", label: "Vision / multimodal" },
  { value: "image", label: "Image" },
  { value: "video", label: "Video" },
  { value: "audio", label: "Audio" },
  { value: "3d", label: "3D" },
] as const;

export const READINESS_OPTIONS = [
  { value: "executable", label: "Executable contract" },
  { value: "integration-required", label: "Integration required" },
  { value: "not-executable", label: "Not executable" },
  { value: "not-declared", label: "Readiness not declared" },
] as const;
export const ALIGNMENT_OPTIONS = [
  { value: "standard", label: "Standard" },
  { value: "abliterated", label: "Abliterated" },
  { value: "derisked", label: "Derisked" },
  { value: "other-modified", label: "Other modified" },
  { value: "unspecified", label: "Unspecified" },
] as const;

export type ModelType = "" | typeof MODEL_TYPE_OPTIONS[number]["value"];
export type SparkFilter = "" | "1" | "2" | "3" | "4+";
export type UpdatedFilter = "" | "7" | "30" | "90" | "365";
export type RecipeSort = "catalog" | "recipe" | "modelType" | "model" | "version" | "quantization" | "alignment" | "sparks" | "creator" | "updated" | "readiness" | "capability" | "qualification" | "repository" | "runtime" | "topology" | "download" | "disk" | "memory";
export type SortDirection = "asc" | "desc";
export type FilterFacet = "modelType" | "model" | "modelVersion" | "alignment" | "sourceOwner" | "repository" | "sparks" | "runtime" | "quantization" | "updated" | "topology" | "qualification" | "readiness" | "capability" | "download" | "disk" | "memory";

export interface CatalogFilters {
  query: string;
  modelType: ModelType;
  model: string;
  modelVersion: string;
  alignment: "" | typeof ALIGNMENT_OPTIONS[number]["value"];
  sourceOwner: string;
  repository: string;
  sparks: SparkFilter;
  runtime: string;
  quantization: string;
  updated: UpdatedFilter;
  topology: string;
  qualification: "" | "candidate" | "cataloged";
  readiness: "" | "executable" | "integration-required" | "not-executable" | "not-declared";
  download: string;
  disk: string;
  memory: string;
  sort: RecipeSort;
  direction: SortDirection;
  capabilities: string[];
}

export const EMPTY_FILTERS: CatalogFilters = {
  query: "",
  modelType: "",
  model: "",
  modelVersion: "",
  alignment: "",
  sourceOwner: "",
  repository: "",
  sparks: "",
  runtime: "",
  quantization: "",
  updated: "",
  topology: "",
  qualification: "",
  readiness: "",
  download: "",
  disk: "",
  memory: "",
  sort: "catalog",
  direction: "desc",
  capabilities: [],
};

const VALID_MODEL_TYPES = new Set<string>(MODEL_TYPE_OPTIONS.map((option) => option.value));
const VALID_SPARKS = new Set<string>(["1", "2", "3", "4+"]);
const VALID_SORTS = new Set<string>(["catalog", "recipe", "modelType", "model", "version", "quantization", "alignment", "sparks", "creator", "updated", "readiness", "capability", "qualification", "repository", "runtime", "topology", "download", "disk", "memory"]);
const VALID_DIRECTIONS = new Set<string>(["asc", "desc"]);
const VALID_QUALIFICATION = new Set<string>(["candidate", "cataloged"]);
const VALID_READINESS = new Set<string>(READINESS_OPTIONS.map((option) => option.value));
const VALID_CAPABILITIES = new Set<string>(CAPABILITY_OPTIONS.map((option) => option.value));
const VALID_UPDATED = new Set<string>(["7", "30", "90", "365"]);

export function filtersFromParameters(parameters: URLSearchParams): CatalogFilters {
  const modelType = parameters.get("model_type") ?? "";
  const sparks = parameters.get("sparks") ?? "";
  const qualification = parameters.get("qualification") ?? "";
  const readiness = parameters.get("readiness") ?? "";
  const alignment = parameters.get("alignment") ?? "";
  const requestedSort = parameters.get("sort") ?? "catalog";
  const sort = VALID_SORTS.has(requestedSort) ? requestedSort as RecipeSort : "catalog";
  const direction = parameters.get("direction") ?? (sort === "catalog" ? "desc" : "asc");
  return {
    query: parameters.get("q") ?? "",
    modelType: VALID_MODEL_TYPES.has(modelType) ? modelType as ModelType : "",
    model: parameters.get("model") ?? "",
    modelVersion: parameters.get("model_version") ?? "",
    alignment: ALIGNMENT_OPTIONS.some((option) => option.value === alignment) ? alignment as CatalogFilters["alignment"] : "",
    sourceOwner: parameters.get("creator") ?? "",
    repository: parameters.get("repository") ?? "",
    sparks: VALID_SPARKS.has(sparks) ? sparks as SparkFilter : "",
    runtime: parameters.get("runtime") ?? "",
    quantization: parameters.get("quantization") ?? "",
    updated: VALID_UPDATED.has(parameters.get("updated") ?? "") ? parameters.get("updated") as UpdatedFilter : "",
    topology: parameters.get("topology") ?? "",
    qualification: VALID_QUALIFICATION.has(qualification) ? qualification as CatalogFilters["qualification"] : "",
    readiness: VALID_READINESS.has(readiness) ? readiness as CatalogFilters["readiness"] : "",
    download: parameters.get("download") ?? "",
    disk: parameters.get("disk") ?? "",
    memory: parameters.get("memory") ?? "",
    sort,
    direction: VALID_DIRECTIONS.has(direction) ? direction as SortDirection : sort === "catalog" ? "desc" : "asc",
    capabilities: Array.from(new Set(parameters.getAll("capability").filter((value) => VALID_CAPABILITIES.has(value as typeof CAPABILITY_OPTIONS[number]["value"])))),
  };
}

export function metadata(recipe: RecipeSummary): NonNullable<RecipeSummary["catalog"]> {
  if (recipe.catalog) return recipe.catalog;
  const rawCapabilities = recipe.workload.capabilities ?? [];
  const capabilities = CAPABILITY_OPTIONS.flatMap(({ value }) => rawCapabilities.some((item) => item === value || item.endsWith(`.${value}`)) ? [value] : []);
  const nodes = recipe.capacity?.profile_node_counts?.[0] ?? recipe.deployment_profiles?.[0]?.node_count ?? 1;
  return {
    description: "",
    tags: rawCapabilities,
    model_publisher: recipe.publisher,
    model_slug: recipe.workload.family ?? recipe.slug,
    model_title: recipe.workload.family ?? recipe.title,
    model_version_publisher: recipe.publisher,
    model_version_slug: recipe.workload.family ?? recipe.slug,
    model_version_title: recipe.workload.family ?? recipe.title,
    source_owner: null,
    source_repository: null,
    alignment: "unspecified",
    capabilities,
    qualification: "candidate",
    execution_readiness: "not-declared",
    runtime_distribution: recipe.runtime.adapter ?? "unknown",
    precision: null,
    quantizations: [],
    topology_name: recipe.deployment_profiles?.[0]?.name ?? "",
    topology_mode: nodes === 1 ? "single" : "distributed",
    node_count: nodes,
    expected_download_bytes: (recipe.artifacts ?? []).reduce((total, artifact) => total + (artifact.download_bytes ?? 0), 0),
  };
}

export function modelTypeMatches(recipe: RecipeSummary, modelType: ModelType): boolean {
  if (!modelType) return true;
  const capabilities = metadata(recipe).capabilities;
  if (modelType === "language") return capabilities.includes("chat") || capabilities.includes("reasoning");
  if (modelType === "vision") return capabilities.includes("vision");
  if (modelType === "image") return capabilities.includes("image-generation") || capabilities.includes("image-editing");
  return capabilities.includes(modelType);
}

function sparksMatch(recipe: RecipeSummary, sparks: SparkFilter): boolean {
  if (!sparks) return true;
  const nodes = metadata(recipe).node_count;
  return sparks === "4+" ? nodes >= 4 : nodes === Number(sparks);
}

function exactSizeMatches(value: number | undefined, filter: string): boolean {
  if (!filter) return true;
  return filter === "unknown" ? value === undefined : String(value) === filter;
}

export function modelVersionKey(recipe: RecipeSummary): string {
  const facts = metadata(recipe);
  return `${facts.model_version_publisher}/${facts.model_version_slug}`;
}

export function updatedMatches(recipe: RecipeSummary, updated: UpdatedFilter, now = new Date()): boolean {
  if (!updated) return true;
  if (!recipe.published_at) return false;
  const released = new Date(recipe.published_at.length === 10 ? `${recipe.published_at}T00:00:00Z` : recipe.published_at);
  if (Number.isNaN(released.getTime())) return false;
  return released.getTime() >= now.getTime() - Number(updated) * 86_400_000;
}

export function recipeMatches(recipe: RecipeSummary, filters: CatalogFilters, omitted?: FilterFacet): boolean {
  const facts = metadata(recipe);
  const normalized = filters.query.trim().toLocaleLowerCase();
  const queryMatches = !normalized || [
    recipe.title,
    recipe.slug,
    facts.description,
    facts.model_title,
    facts.model_slug,
    facts.model_version_title,
    facts.model_version_slug,
    facts.source_owner ?? "",
    facts.source_repository ?? "",
    facts.runtime_distribution,
    ...facts.quantizations,
    ...facts.capabilities,
    ...facts.tags,
  ].some((value) => value.toLocaleLowerCase().includes(normalized));
  return queryMatches
    && (omitted === "modelType" || modelTypeMatches(recipe, filters.modelType))
    && (omitted === "model" || !filters.model || `${facts.model_publisher}/${facts.model_slug}` === filters.model)
    && (omitted === "modelVersion" || !filters.modelVersion || modelVersionKey(recipe) === filters.modelVersion)
    && (omitted === "alignment" || !filters.alignment || facts.alignment === filters.alignment)
    && (omitted === "sourceOwner" || !filters.sourceOwner || facts.source_owner === filters.sourceOwner)
    && (omitted === "repository" || !filters.repository || facts.source_repository === filters.repository)
    && (omitted === "sparks" || sparksMatch(recipe, filters.sparks))
    && (omitted === "runtime" || !filters.runtime || facts.runtime_distribution === filters.runtime)
    && (omitted === "quantization" || !filters.quantization || facts.quantizations.includes(filters.quantization))
    && (omitted === "updated" || updatedMatches(recipe, filters.updated))
    && (omitted === "topology" || !filters.topology || facts.topology_mode === filters.topology)
    && (omitted === "qualification" || !filters.qualification || facts.qualification === filters.qualification)
    && (omitted === "readiness" || !filters.readiness || facts.execution_readiness === filters.readiness)
    && (omitted === "capability" || filters.capabilities.every((capability) => facts.capabilities.includes(capability)))
    && (omitted === "download" || exactSizeMatches(facts.expected_download_bytes, filters.download))
    && (omitted === "disk" || exactSizeMatches(recipe.capacity?.maximum_installed_bytes_per_node, filters.disk))
    && (omitted === "memory" || exactSizeMatches(recipe.capacity?.maximum_runtime_memory_bytes_per_node, filters.memory));
}

export function sortRecipes(recipes: RecipeSummary[], sort: RecipeSort, direction: SortDirection = sort === "catalog" ? "desc" : "asc"): RecipeSummary[] {
  const value = (recipe: RecipeSummary): string | number => {
    const facts = metadata(recipe);
    if (sort === "recipe") return recipe.title;
    if (sort === "modelType") return MODEL_TYPE_OPTIONS.filter((option) => modelTypeMatches(recipe, option.value)).map((option) => option.label).join(", ");
    if (sort === "model") return facts.model_title;
    if (sort === "creator") return facts.source_owner ?? "";
    if (sort === "version") return facts.model_version_title;
    if (sort === "quantization") return facts.quantizations.join(", ");
    if (sort === "alignment") return facts.alignment;
    if (sort === "sparks") return facts.node_count;
    if (sort === "runtime") return facts.runtime_distribution;
    if (sort === "readiness") return facts.execution_readiness;
    if (sort === "qualification") return facts.qualification;
    if (sort === "capability") return facts.capabilities.join(", ");
    if (sort === "repository") return facts.source_repository ?? "";
    if (sort === "topology") return facts.topology_mode;
    if (sort === "download") return facts.expected_download_bytes;
    if (sort === "disk") return recipe.capacity?.maximum_installed_bytes_per_node ?? 0;
    if (sort === "memory") return recipe.capacity?.maximum_runtime_memory_bytes_per_node ?? 0;
    return recipe.published_at;
  };
  return [...recipes].sort((left, right) => {
    const leftValue = value(left);
    const rightValue = value(right);
    const comparison = typeof leftValue === "number" && typeof rightValue === "number"
      ? leftValue - rightValue
      : String(leftValue).localeCompare(String(rightValue), undefined, {numeric: true, sensitivity: "base"});
    const tieBreak = left.title.localeCompare(right.title, undefined, {numeric: true, sensitivity: "base"});
    const result = comparison || tieBreak;
    return direction === "desc" ? -result : result;
  });
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
