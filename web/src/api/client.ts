import createClient from "openapi-fetch";

import type { paths } from "./schema";
import { getStaticModel, getStaticRecipe, listStaticModels, listStaticRecipeCatalog, listStaticRecipes } from "./static-catalog";


export interface Problem {
  type: string;
  title: string;
  status: number;
  code: string;
  detail: string;
  request_id: string;
}

export class CatalogProblem extends Error {
  readonly problem: Problem;

  constructor(problem: Problem) {
    super(problem.detail);
    this.name = "CatalogProblem";
    this.problem = problem;
  }
}

export const catalogClient = createClient<paths>({
  baseUrl: import.meta.env.VITE_CATALOG_API_URL ?? "",
  headers: { Accept: "application/json" },
});

export interface RecipeSummary {
  publisher: string;
  slug: string;
  title: string;
  official: boolean;
  revision_number: number;
  revision_id: string;
  content_sha256: string;
  published_at: string;
  version?: string;
  runtime: { adapter?: string; entrypoint?: string[] };
  build?: { context?: { sha256?: string; expected_bytes?: number }; dockerfile?: string };
  artifacts?: Array<{
    kind?: string;
    repository?: string;
    revision?: string;
    download_bytes?: number;
    installed_bytes?: number;
  }>;
  provenance?: {
    source_kind?: string;
    source_reference?: string | null;
    attribution?: string[];
  };
  workload: { family?: string; capabilities?: string[] };
  deployment_profiles?: Array<{ name?: string; node_count?: number }>;
  capacity?: {
    profile_node_counts?: number[];
    maximum_installed_bytes_per_node?: number;
    maximum_runtime_memory_bytes_per_node?: number;
  };
  moderation_warning?: string | null;
  facts?: {
    declared: boolean;
    source_bundle_observed: boolean;
    publisher_tested: boolean;
    publisher_tested_label: string;
    vonk_verified: boolean;
    last_validation: string | null;
  };
  import?: { uri: string; instruction: string };
  source?: { recipe_url?: string; bundle_url?: string };
  package?: { url: string; sha256: string; bytes: number; media_type: string };
  catalog?: {
    description: string;
    tags: string[];
    model_publisher: string;
    model_slug: string;
    model_title: string;
    model_version_publisher: string;
    model_version_slug: string;
    model_version_title: string;
    model_version_content_sha256?: string | null;
    source_owner: string | null;
    source_repository: string | null;
    alignment: "standard" | "abliterated" | "derisked" | "other-modified" | "unspecified";
    capabilities: string[];
    qualification: "candidate" | "cataloged";
    execution_readiness: "executable" | "integration-required" | "not-executable" | "not-declared";
    runtime_distribution: string;
    precision: string | null;
    quantizations: string[];
    topology_name: string;
    topology_mode: string;
    node_count: number;
    expected_download_bytes: number;
  };
}

export interface RecipeDetail extends RecipeSummary {
  latest_revision: {
    revision_number: number;
    content_sha256: string;
    document: Record<string, unknown>;
  };
}

export interface RecipePage {
  items: RecipeSummary[];
  next_cursor: string | null;
}

export interface ModelVersionSummary {
  publisher: string;
  slug: string;
  title: string;
  version: string;
  revision_id: string;
  model_publisher: string;
  model_slug: string;
  model_title: string;
  variant?: string;
  access?: { visibility?: string; gated?: boolean; authentication?: string };
  source_repository?: string;
  source_revision?: string;
  format?: { container?: string; precision?: string; quantization?: string };
  parameters?: { total?: number | null; active?: number | null };
  limits?: { context_tokens?: number | null; resolution_pixels?: number | null; frames?: number | null; sample_rate_hz?: number | null };
  sizes?: { download_bytes?: number; installed_bytes?: number };
  license?: { spdx?: string; url?: string; attribution?: string[]; operator_acceptance_required?: boolean };
  availability?: "active" | "withdrawn" | "superseded";
  tags: string[];
  capabilities: Array<{ name: string; support: "supported" | "unsupported" | "unknown"; evidence_status: "declared" | "tested" | "contradicted" | "unknown"; evidence_digest?: string | null }>;
  capability_evidence: "declared" | "unknown";
  recipe_slugs: string[];
}

export interface ModelSummary {
  publisher: string;
  slug: string;
  title: string;
  description: string;
  family?: string;
  tags: string[];
  revision_id: string;
  versions: ModelVersionSummary[];
  recipe_count: number;
}

export interface ModelPage {
  items: ModelSummary[];
}

const catalogApiUrl = import.meta.env.VITE_CATALOG_API_URL ?? "";
const recipeLibraryIndexUrl = import.meta.env.VITE_RECIPE_LIBRARY_INDEX_URL ?? "";

// Public Models and Recipes share the immutable generated index. The API origin
// is reserved for publisher and private Controller operations.
export const usesStaticCatalog = Boolean(recipeLibraryIndexUrl);

export type PublicModelSource = "static-index" | "unavailable";

/** Models are public immutable facts, so the generated public index remains their source when an API origin is also configured. */
export function selectPublicModelSource(config: { apiUrl: string; indexUrl: string }): PublicModelSource {
  return config.indexUrl ? "static-index" : "unavailable";
}

export const usesStaticModelCatalog = selectPublicModelSource({ apiUrl: catalogApiUrl, indexUrl: recipeLibraryIndexUrl }) === "static-index";

export async function loadRecipeCatalog(signal?: AbortSignal): Promise<RecipeSummary[]> {
  if (usesStaticCatalog) return listStaticRecipeCatalog(recipeLibraryIndexUrl, signal);

  const items: RecipeSummary[] = [];
  let cursor: string | null = null;
  do {
    const parameters = new URLSearchParams({ limit: "100" });
    if (cursor) parameters.set("cursor", cursor);
    const page = await requestJson<RecipePage>(`/v1/recipes?${parameters}`, signal);
    items.push(...page.items);
    cursor = page.next_cursor;
  } while (cursor && items.length < 1_000);
  return items;
}

async function requestJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(
    `${import.meta.env.VITE_CATALOG_API_URL ?? ""}${path}`,
    { headers: { Accept: "application/json" }, signal, credentials: "include" },
  );
  const body = (await response.json()) as T | Problem;
  if (!response.ok) {
    throw new CatalogProblem(body as Problem);
  }
  return body as T;
}

export function listRecipes(
  parameters: URLSearchParams,
  signal?: AbortSignal,
): Promise<RecipePage> {
  if (usesStaticCatalog) return listStaticRecipes(recipeLibraryIndexUrl, parameters, signal);
  const query = parameters.toString();
  return requestJson<RecipePage>(`/v1/recipes${query ? `?${query}` : ""}`, signal);
}

export function getRecipe(
  publisher: string,
  slug: string,
  signal?: AbortSignal,
): Promise<RecipeDetail> {
  if (usesStaticCatalog) return getStaticRecipe(recipeLibraryIndexUrl, publisher, slug, signal);
  return requestJson<RecipeDetail>(
    `/v1/recipes/${encodeURIComponent(publisher)}/${encodeURIComponent(slug)}`,
    signal,
  );
}

export function listModels(signal?: AbortSignal): Promise<ModelPage> {
  if (usesStaticModelCatalog) return listStaticModels(recipeLibraryIndexUrl, signal);
  return Promise.reject(new Error("The public model index is not available from this catalog endpoint yet."));
}

export function getModel(
  publisher: string,
  slug: string,
  signal?: AbortSignal,
): Promise<ModelSummary> {
  if (usesStaticModelCatalog) return getStaticModel(recipeLibraryIndexUrl, publisher, slug, signal);
  return Promise.reject(new Error("The public model index is not available from this catalog endpoint yet."));
}

export async function unwrap<T>(
  result: { data?: T; error?: unknown; response: Response },
): Promise<T> {
  if (result.error !== undefined) {
    throw new CatalogProblem(result.error as Problem);
  }
  if (result.data === undefined) {
    throw new Error(`Catalog returned ${result.response.status} without a body`);
  }
  return result.data;
}
