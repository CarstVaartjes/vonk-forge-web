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

export const usesStaticCatalog = Boolean(recipeLibraryIndexUrl) && !catalogApiUrl;

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

export interface Me {
  user: { id: string; display_name: string };
  accounts: Array<{ provider: string; email: string | null }>;
  csrf_token: string;
  session_expires_at: string;
}

export interface PublisherMembership {
  id: string;
  slug: string;
  name: string;
  role: "owner" | "editor" | "viewer";
  official: boolean;
}

export interface Draft {
  id: string;
  publisher: string;
  recipe_id: string;
  version: number;
  state: string;
  content_sha256: string;
  recipe: Record<string, unknown>;
  source_bundle_sha256?: string;
  source_bundle_available?: boolean;
  validation_problems: Array<{ path: string; rule: string; message: string }>;
  validation: null | {
    status: "passed" | "failed";
    checks: Array<{
      code: string;
      passed: boolean;
      detail: string;
      observed?: Record<string, unknown>;
    }>;
    created_at: string;
  };
}

async function browserRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<{ data: T; response: Response }> {
  const response = await fetch(`${import.meta.env.VITE_CATALOG_API_URL ?? ""}${path}`, {
    ...init,
    credentials: "include",
    headers: { Accept: "application/json", ...init.headers },
  });
  const body = response.status === 204 ? undefined : await response.json();
  if (!response.ok) throw new CatalogProblem(body as Problem);
  return { data: body as T, response };
}

export async function getProviders(): Promise<string[]> {
  const { data } = await browserRequest<{ providers: string[] }>("/v1/auth/providers");
  return data.providers;
}

export async function getMe(): Promise<Me> {
  return (await browserRequest<Me>("/v1/me")).data;
}

export async function getPublishers(): Promise<PublisherMembership[]> {
  const { data } = await browserRequest<{ items: PublisherMembership[] }>("/v1/publishers");
  return data.items;
}

export async function getDrafts(publisher: string): Promise<Draft[]> {
  const { data } = await browserRequest<{ items: Draft[] }>(`/v1/publishers/${encodeURIComponent(publisher)}/drafts`);
  return data.items;
}

export async function uploadDraft(
  publisher: string,
  envelope: Record<string, unknown>,
  csrf: string,
  idempotencyKey: string,
): Promise<Draft> {
  return (
    await browserRequest<Draft>(`/v1/publishers/${encodeURIComponent(publisher)}/drafts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf, "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(envelope),
    })
  ).data;
}

export async function uploadSourceBundle(
  publisher: string,
  sha256: string,
  archive: File,
  csrf: string,
): Promise<{sha256: string; files: string[]}> {
  return (
    await browserRequest<{sha256: string; files: string[]}>(`/v1/publishers/${encodeURIComponent(publisher)}/source-bundles/${encodeURIComponent(sha256)}`, {
      method: "PUT",
      headers: {"Content-Type": "application/vnd.vonk-forge.source-bundle.v1+tar", "X-CSRF-Token": csrf},
      body: archive,
    })
  ).data;
}

export async function updateDraft(
  draft: Draft,
  recipe: Record<string, unknown>,
  csrf: string,
): Promise<Draft> {
  return (
    await browserRequest<Draft>(`/v1/publishers/${encodeURIComponent(draft.publisher)}/drafts/${draft.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf, "If-Match": `"draft-version-${draft.version}"` },
      body: JSON.stringify({ recipe }),
    })
  ).data;
}

export async function validateDraft(draft: Draft, csrf: string): Promise<{ job_id: string; state: string }> {
  return (
    await browserRequest<{ job_id: string; state: string }>(`/v1/publishers/${encodeURIComponent(draft.publisher)}/drafts/${draft.id}/validate`, {
      method: "POST",
      headers: { "X-CSRF-Token": csrf },
    })
  ).data;
}

export async function publishDraft(draft: Draft, csrf: string, idempotencyKey: string) {
  return (
    await browserRequest<{ revision_id: string; revision_number: number; content_sha256: string; official: boolean }>(`/v1/publishers/${encodeURIComponent(draft.publisher)}/drafts/${draft.id}/publish`, {
      method: "POST",
      headers: { "X-CSRF-Token": csrf, "Idempotency-Key": idempotencyKey },
    })
  ).data;
}

export async function forkRevision(
  publisher: string,
  sourceRevisionId: string,
  slug: string,
  csrf: string,
) {
  return (
    await browserRequest<{ draft_id: string }>(`/v1/publishers/${encodeURIComponent(publisher)}/forks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf, "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({ source_revision_id: sourceRevisionId, slug }),
    })
  ).data;
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
  if (usesStaticCatalog) return listStaticModels(recipeLibraryIndexUrl, signal);
  return Promise.reject(new Error("The public model index is not available from this catalog endpoint yet."));
}

export function getModel(
  publisher: string,
  slug: string,
  signal?: AbortSignal,
): Promise<ModelSummary> {
  if (usesStaticCatalog) return getStaticModel(recipeLibraryIndexUrl, publisher, slug, signal);
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
