import { getStaticLibraryRelease, getStaticModel, getStaticRecipe, listStaticModels, listStaticRecipeCatalog } from "./static-catalog";


export interface RecipeSummary {
  publisher: string;
  slug: string;
  title: string;
  official: boolean;
  content_sha256: string;
  published_at: string;
  version?: string;
  runtime: { adapter?: string };
  build?: { dockerfile?: string };
  artifacts?: Array<{
    repository?: string;
    revision?: string;
    download_bytes?: number;
  }>;
  capacity?: {
    profile_node_counts?: number[];
    maximum_installed_bytes_per_node?: number;
    maximum_runtime_memory_bytes_per_node?: number;
  };
  moderation_warning?: string | null;
  facts?: {
    source_bundle_observed: boolean;
    publisher_tested: boolean;
  };
  import?: { uri: string; instruction: string };
  source?: { recipe_url?: string; bundle_url?: string };
  package?: { member: string; sha256: string; bytes: number; media_type: string };
  catalog: {
    description: string;
    tags: string[];
    model_publisher: string;
    model_slug: string;
    model_title: string;
    model_version_publisher: string;
    model_version_slug: string;
    model_version_title: string;
    // The lineage title from the model document (Qwen, GLM, DeepSeek Flash).
    model_family: string;
    source_owner: string | null;
    source_repository: string | null;
    alignment: "standard" | "abliterated" | "derisked" | "other-modified" | "unspecified";
    capabilities: string[];
    qualification: "candidate" | "cataloged";
    execution_readiness: "executable" | "integration-required" | "not-executable" | "not-declared";
    runtime_distribution: string;
    precision: string | null;
    quantizations: string[];
    node_count: number;
    expected_download_bytes: number;
  };
}

export interface RecipeDetail extends RecipeSummary {
  latest_revision: {
    content_sha256: string;
    document: Record<string, unknown>;
  };
}

export interface ModelVersionSummary {
  publisher: string;
  slug: string;
  title: string;
  version: string;
  revision_id: string;
  model_slug: string;
  variant?: string;
  requires_token?: boolean;
  source_repository?: string;
  source_revision?: string;
  format?: { precision?: string; quantization?: string };
  sizes?: { download_bytes?: number; installed_bytes?: number };
  license?: { spdx?: string; url?: string };
  capabilities: string[];
  recipe_slugs: string[];
}

// What a model's public recipes cover: the Spark counts they are written for,
// the engines that run them, and who authored them. Empty when it has no recipe.
export interface ModelRuns {
  spark_counts: number[];
  engines: string[];
  creators: string[];
}

export interface ModelSummary {
  publisher: string;
  slug: string;
  title: string;
  description: string;
  // The lineage title (Qwen, GLM, DeepSeek Flash), falling back to its slug.
  family?: string;
  runs: ModelRuns;
  tags: string[];
  revision_id: string;
  versions: ModelVersionSummary[];
  recipe_count: number;
}

export interface LibraryCatalogCounts {
  recipes: number;
  models: number;
  families: number;
  spark_counts: number[];
}

export interface LibraryRelease {
  version: string;
  updated_at: string;
  // Library size facts the Pages build counted from the verified index; absent
  // when the manifest predates them, in which case the site shows no counts.
  catalog?: LibraryCatalogCounts;
}

export interface ModelPage {
  items: ModelSummary[];
}

// The public catalog is the index of the signed recipe-library release that the
// Pages build verified and copied to this site (web/scripts/recipe-release.mjs).
const RECIPE_LIBRARY_INDEX_URL = "/catalog/catalog-index.json";

export function loadRecipeCatalog(signal?: AbortSignal): Promise<RecipeSummary[]> {
  return listStaticRecipeCatalog(RECIPE_LIBRARY_INDEX_URL, signal);
}

export function getRecipe(publisher: string, slug: string, signal?: AbortSignal): Promise<RecipeDetail> {
  return getStaticRecipe(RECIPE_LIBRARY_INDEX_URL, publisher, slug, signal);
}

export function listModels(signal?: AbortSignal): Promise<ModelPage> {
  return listStaticModels(RECIPE_LIBRARY_INDEX_URL, signal);
}

export function getModel(publisher: string, slug: string, signal?: AbortSignal): Promise<ModelSummary> {
  return getStaticModel(RECIPE_LIBRARY_INDEX_URL, publisher, slug, signal);
}

export function getLibraryRelease(signal?: AbortSignal): Promise<LibraryRelease> {
  return getStaticLibraryRelease(RECIPE_LIBRARY_INDEX_URL, signal);
}
