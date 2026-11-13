import type { CatalogSummary } from "../catalog-stats";
import type { Vocabulary } from "../vocabulary";
import { getStaticCatalogSummary, getStaticLibraryRelease, getStaticModel, getStaticRecipe, getStaticVocabulary, listStaticModels, listStaticRecipeCatalog } from "./static-catalog";


// A model's licence as the catalog published it: shown for information, never a gate.
export interface Licence {
  spdx?: string;
  url?: string;
}

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
    // As published (standard, abliterated, ...); a value a newer contract adds is shown as is.
    alignment: string;
    capabilities: string[];
    // The model types (capability categories) of those capabilities, in vocabulary order.
    types: string[];
    // Published by the recipe library, shown as written.
    qualification: string;
    // The release vocabulary says this status counts as verified on a Spark.
    verified: boolean;
    qualification_reason: string | null;
    execution_readiness: "executable" | "integration-required" | "not-executable" | "not-declared";
    runtime_distribution: string;
    precision: string | null;
    quantizations: string[];
    node_count: number;
    expected_download_bytes: number;
  };
}

export interface RecipeDetail extends RecipeSummary {
  // The newest hardware pass the library recorded for this recipe: when, and on how many Sparks.
  evidence: { tested_at: string; spark_count?: number } | null;
  // What the recipe's chat API serves; absent for a recipe that is not a chat API.
  chat_api?: { endpoints: string[]; streaming: boolean; structured_output: boolean; image_input: boolean; audio_input: boolean };
  // The recipe's own defaults for the settings the page shows.
  settings: { context_tokens?: number; concurrency?: number };
  license: Licence;
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
  license?: Licence;
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
  // The same facts for recipes that passed hardware checks on a DGX Spark.
  verified_runs: ModelRuns;
  tags: string[];
  // The model types of all its versions' capabilities.
  types: string[];
  revision_id: string;
  versions: ModelVersionSummary[];
  recipe_count: number;
  // The same count over recipes that passed hardware checks on a DGX Spark.
  verified_recipe_count: number;
}

export interface LibraryRelease {
  version: string;
  updated_at: string;
  index_sha256: string;
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

export function getVocabulary(signal?: AbortSignal): Promise<Vocabulary> {
  return getStaticVocabulary(RECIPE_LIBRARY_INDEX_URL, signal);
}

export function getCatalogSummary(signal?: AbortSignal): Promise<CatalogSummary> {
  return getStaticCatalogSummary(RECIPE_LIBRARY_INDEX_URL, signal);
}

export function getLibraryRelease(signal?: AbortSignal): Promise<LibraryRelease> {
  return getStaticLibraryRelease(RECIPE_LIBRARY_INDEX_URL, signal);
}
