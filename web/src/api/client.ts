import createClient from "openapi-fetch";

import type { paths } from "./schema";


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
  runtime: { family?: string; image?: string };
  artifacts?: Array<{
    kind?: string;
    repository?: string;
    revision?: string;
    expected_bytes?: number;
  }>;
  provenance?: {
    source_kind?: string;
    source_reference?: string | null;
    attribution?: string[];
  };
  workload: { family?: string; capabilities?: string[] };
  resources: {
    per_node?: {
      installed_bytes?: number;
      resident_memory_bytes?: number;
    };
    measurement?: string;
  };
  topology: {
    kind?: string;
    min_nodes?: number;
    max_nodes?: number;
    tested_node_counts?: number[];
  };
  moderation_warning?: string | null;
  facts?: {
    declared: boolean;
    registry_observed: Record<string, unknown> | null;
    publisher_tested: boolean;
    publisher_tested_label: string;
    vonk_verified: boolean;
    last_validation: string | null;
  };
  import?: { uri: string; instruction: string };
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
  const query = parameters.toString();
  return requestJson<RecipePage>(`/v1/recipes${query ? `?${query}` : ""}`, signal);
}

export function getRecipe(
  publisher: string,
  slug: string,
  signal?: AbortSignal,
): Promise<RecipeDetail> {
  return requestJson<RecipeDetail>(
    `/v1/recipes/${encodeURIComponent(publisher)}/${encodeURIComponent(slug)}`,
    signal,
  );
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
