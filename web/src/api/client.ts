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
    { headers: { Accept: "application/json" }, signal },
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
