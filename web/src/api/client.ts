import type { CatalogSummary } from "../catalog-stats";
import type { Vocabulary } from "../vocabulary";
import {
  getStaticCatalogSummary,
  peekStaticModel,
  peekStaticModels,
  peekStaticRecipe,
  peekStaticRecipeCatalog,
  peekStaticVocabulary,
  getStaticLibraryRelease,
  getStaticModel,
  getStaticRecipe,
  getStaticVocabulary,
  listStaticModels,
  listStaticRecipeCatalog,
} from "./static-catalog";

// A model's license as the catalog published it: shown for information, never a gate.
export interface License {
  spdx?: string | undefined;
  url?: string | undefined;
  // The regional notice the license carries (where it does not apply), shown as information.
  notice?: string | undefined;
}

// What a job recipe takes and gives, as the catalog published it: the slots a job fills and the options it accepts.
export interface JobSlot {
  id: string;
  label: string;
  description: string;
  media_types: string[];
  extensions: string[];
  min_files: number;
  max_files: number;
}

export interface JobOption {
  key: string;
  label: string;
  description?: string | undefined;
  unit?: string | undefined;
  default: string | number | boolean;
  minimum?: number | undefined;
  maximum?: number | undefined;
  step?: number | undefined;
  allowed_values?: (string | number | boolean)[] | undefined;
}

export interface JobContract {
  inputs: JobSlot[];
  outputs: JobSlot[];
  options: JobOption[];
}

export interface RecipeSummary {
  publisher: string;
  slug: string;
  title: string;
  official: boolean;
  content_sha256: string;
  published_at: string;
  version?: string | undefined;
  runtime: { adapter?: string };
  build?: { dockerfile?: string };
  artifacts?: Array<{
    repository?: string;
    revision?: string;
    download_bytes?: number;
  }>;
  capacity?: {
    profile_node_counts?: number[];
    maximum_installed_bytes_per_node?: number | undefined;
    maximum_runtime_memory_bytes_per_node?: number | undefined;
    // The largest per-role peak a hardware run measured; absent for a recipe with none.
    measured_memory_bytes_per_node?: number | undefined;
  };
  moderation_warning?: string | null;
  facts?: {
    source_bundle_observed: boolean;
  };
  import?: { uri: string; instruction: string };
  source?: { recipe_url?: string; bundle_url?: string | undefined };
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
  evidence: {
    tested_at: string;
    spark_count?: number | undefined;
    hardware_class?: string | undefined;
    evidence_ref?: string | undefined;
    image_digest?: string | undefined;
  } | null;
  // What the recipe's chat API serves; absent for a recipe that is not a chat API.
  chat_api?: {
    endpoints: string[];
    streaming: boolean;
    structured_output: boolean;
    image_input: boolean;
    audio_input: boolean;
  };
  // The model names the recipe's API answers to, and the people and projects it credits.
  served_names: string[];
  credits: string[];
  // The recipe's own defaults for the settings the page shows.
  settings: { context_tokens?: number | undefined; concurrency?: number | undefined };
  // Present only for a job recipe (images, video, audio, 3D): what goes in, what comes out, and its options.
  job?: JobContract | undefined;
  license: License;
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
  // This variant's own description; a Model has none of its own.
  description: string;
  model_slug: string;
  variant?: string | undefined;
  requires_token?: boolean | undefined;
  source_repository?: string | undefined;
  source_revision?: string | undefined;
  format?: { precision?: string | undefined; quantization?: string | undefined };
  sizes?: { download_bytes?: number; installed_bytes?: number };
  license?: License;
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
  // The lineage title (Qwen, GLM, DeepSeek Flash), falling back to its slug.
  family?: string | undefined;
  runs: ModelRuns;
  // The same facts for recipes that passed hardware checks on a DGX Spark.
  verified_runs: ModelRuns;
  tags: string[];
  // The model types of all its versions' capabilities.
  types: string[];
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

export function loadRecipeCatalog(signal?: AbortSignal): Promise<RecipeDetail[]> {
  return listStaticRecipeCatalog(RECIPE_LIBRARY_INDEX_URL, signal);
}

export function getRecipe(
  publisher: string,
  slug: string,
  signal?: AbortSignal,
): Promise<RecipeDetail> {
  return getStaticRecipe(RECIPE_LIBRARY_INDEX_URL, publisher, slug, signal);
}

export function listModels(signal?: AbortSignal): Promise<ModelPage> {
  return listStaticModels(RECIPE_LIBRARY_INDEX_URL, signal);
}

export function getModel(
  publisher: string,
  slug: string,
  signal?: AbortSignal,
): Promise<ModelSummary> {
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

// The same data, only when the index has already loaded; a page starts from it so that moving between
// pages draws no loading state and makes no request.
export const peekRecipeCatalog = (): RecipeDetail[] | null =>
  peekStaticRecipeCatalog(RECIPE_LIBRARY_INDEX_URL);
export const peekRecipe = (publisher: string, slug: string): RecipeDetail | null =>
  peekStaticRecipe(RECIPE_LIBRARY_INDEX_URL, publisher, slug);
export const peekModels = (): ModelSummary[] | null =>
  peekStaticModels(RECIPE_LIBRARY_INDEX_URL)?.items ?? null;
export const peekModel = (publisher: string, slug: string): ModelSummary | null =>
  peekStaticModel(RECIPE_LIBRARY_INDEX_URL, publisher, slug);
export const peekVocabulary = (): Vocabulary | null =>
  peekStaticVocabulary(RECIPE_LIBRARY_INDEX_URL);
