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
