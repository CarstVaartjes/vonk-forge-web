import { getStaticModel, getStaticRecipe, listStaticModels, listStaticRecipeCatalog } from "./static-catalog";


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

// The public catalog is the index of the signed recipe-library release that the
// Pages build verified and copied to this site (web/scripts/recipe-release.mjs).
export const RECIPE_LIBRARY_INDEX_URL = "/catalog/catalog-index.json";

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
