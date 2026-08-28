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

export type ModelType = "" | typeof MODEL_TYPE_OPTIONS[number]["value"];
export type SparkFilter = "" | "1" | "2" | "3" | "4+";
export type UpdatedFilter = "" | "7" | "30" | "90" | "365";
export type RecipeSort = "catalog" | "model" | "sparks" | "download";
export type FilterFacet = "modelType" | "model" | "modelVersion" | "sourceOwner" | "repository" | "sparks" | "runtime" | "quantization" | "updated" | "topology" | "qualification" | "readiness" | "capability";

export interface CatalogFilters {
  query: string;
  modelType: ModelType;
  model: string;
  modelVersion: string;
  sourceOwner: string;
  repository: string;
  sparks: SparkFilter;
  runtime: string;
  quantization: string;
  updated: UpdatedFilter;
  topology: string;
  qualification: "" | "candidate" | "cataloged";
  readiness: "" | "executable" | "integration-required" | "not-executable" | "not-declared";
  sort: RecipeSort;
  capabilities: string[];
}

export const EMPTY_FILTERS: CatalogFilters = {
  query: "",
  modelType: "",
  model: "",
  modelVersion: "",
  sourceOwner: "",
  repository: "",
  sparks: "",
  runtime: "",
  quantization: "",
  updated: "",
  topology: "",
  qualification: "",
  readiness: "",
  sort: "catalog",
  capabilities: [],
};

const VALID_MODEL_TYPES = new Set<string>(MODEL_TYPE_OPTIONS.map((option) => option.value));
const VALID_SPARKS = new Set<string>(["1", "2", "3", "4+"]);
const VALID_SORTS = new Set<string>(["catalog", "model", "sparks", "download"]);
const VALID_QUALIFICATION = new Set<string>(["candidate", "cataloged"]);
const VALID_READINESS = new Set<string>(READINESS_OPTIONS.map((option) => option.value));
const VALID_CAPABILITIES = new Set<string>(CAPABILITY_OPTIONS.map((option) => option.value));
const VALID_UPDATED = new Set<string>(["7", "30", "90", "365"]);

export function filtersFromParameters(parameters: URLSearchParams): CatalogFilters {
  const modelType = parameters.get("model_type") ?? "";
  const sparks = parameters.get("sparks") ?? "";
  const qualification = parameters.get("qualification") ?? "";
  const readiness = parameters.get("readiness") ?? "";
  const sort = parameters.get("sort") ?? "catalog";
  return {
    query: parameters.get("q") ?? "",
    modelType: VALID_MODEL_TYPES.has(modelType) ? modelType as ModelType : "",
    model: parameters.get("model") ?? "",
    modelVersion: parameters.get("model_version") ?? "",
    sourceOwner: parameters.get("creator") ?? "",
    repository: parameters.get("repository") ?? "",
    sparks: VALID_SPARKS.has(sparks) ? sparks as SparkFilter : "",
    runtime: parameters.get("runtime") ?? "",
    quantization: parameters.get("quantization") ?? "",
    updated: VALID_UPDATED.has(parameters.get("updated") ?? "") ? parameters.get("updated") as UpdatedFilter : "",
    topology: parameters.get("topology") ?? "",
    qualification: VALID_QUALIFICATION.has(qualification) ? qualification as CatalogFilters["qualification"] : "",
    readiness: VALID_READINESS.has(readiness) ? readiness as CatalogFilters["readiness"] : "",
    sort: VALID_SORTS.has(sort) ? sort as RecipeSort : "catalog",
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
    && (omitted === "sourceOwner" || !filters.sourceOwner || facts.source_owner === filters.sourceOwner)
    && (omitted === "repository" || !filters.repository || facts.source_repository === filters.repository)
    && (omitted === "sparks" || sparksMatch(recipe, filters.sparks))
    && (omitted === "runtime" || !filters.runtime || facts.runtime_distribution === filters.runtime)
    && (omitted === "quantization" || !filters.quantization || facts.quantizations.includes(filters.quantization))
    && (omitted === "updated" || updatedMatches(recipe, filters.updated))
    && (omitted === "topology" || !filters.topology || facts.topology_mode === filters.topology)
    && (omitted === "qualification" || !filters.qualification || facts.qualification === filters.qualification)
    && (omitted === "readiness" || !filters.readiness || facts.execution_readiness === filters.readiness)
    && (omitted === "capability" || filters.capabilities.every((capability) => facts.capabilities.includes(capability)));
}

export function sortRecipes(recipes: RecipeSummary[], sort: RecipeSort): RecipeSummary[] {
  return [...recipes].sort((left, right) => {
    if (sort === "model") return metadata(left).model_title.localeCompare(metadata(right).model_title) || left.title.localeCompare(right.title);
    if (sort === "sparks") return metadata(left).node_count - metadata(right).node_count || left.title.localeCompare(right.title);
    if (sort === "download") return metadata(left).expected_download_bytes - metadata(right).expected_download_bytes || left.title.localeCompare(right.title);
    return right.published_at.localeCompare(left.published_at) || left.title.localeCompare(right.title);
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
