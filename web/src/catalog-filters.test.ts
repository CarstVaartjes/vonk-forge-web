import { describe, expect, test } from "vitest";

import type { RecipeSummary } from "./api/client";
import { EMPTY_FILTERS, filtersFromParameters, recipeMatches, sortRecipes } from "./catalog-filters";


function recipe(slug: string, overrides: Partial<NonNullable<RecipeSummary["catalog"]>> = {}): RecipeSummary {
  return {
    publisher: "vonk-forge",
    slug,
    title: slug,
    official: true,
    revision_number: 1,
    revision_id: slug,
    content_sha256: slug.padEnd(64, "0").slice(0, 64),
    published_at: "2026-08-28",
    runtime: { adapter: "vllm" },
    workload: { family: slug, capabilities: [] },
    catalog: {
      description: "",
      tags: [],
      model_publisher: "models",
      model_slug: slug,
      model_title: slug,
      model_version_publisher: "models",
      model_version_slug: `${slug}-v1`,
      model_version_title: `${slug} v1`,
      source_owner: "owner",
      source_repository: "https://github.com/owner/repo",
      alignment: "standard",
      capabilities: ["chat"],
      qualification: "candidate",
      execution_readiness: "executable",
      runtime_distribution: "vllm-0-27-1",
      precision: "NVFP4",
      quantizations: ["NVFP4"],
      topology_name: "solo",
      topology_mode: "single",
      node_count: 1,
      expected_download_bytes: 100,
      ...overrides,
    },
  };
}

describe("public catalog Controller-parity filters", () => {
  test("parses the shared filter vocabulary and validates enumerated values", () => {
    const filters = filtersFromParameters(new URLSearchParams("model_family=GLM+5.3+Flash&model=models%2Fboth-v1&abliterated=true&creator=owner&quantization=NVFP4&updated=30&sparks=4%2B&capability=chat&capability=reasoning&capability=chat&download=100&disk=unknown&memory=200&sort=download&direction=desc"));
    expect(filters).toMatchObject({ modelFamily: "GLM 5.3 Flash", model: "models/both-v1", abliterated: "true", sourceOwner: "owner", quantization: "NVFP4", updated: "30", sparks: "4+", capabilities: ["chat", "reasoning"], download: "100", disk: "unknown", memory: "200", sort: "download", direction: "desc" });
    expect(filtersFromParameters(new URLSearchParams("abliterated=unknown&sort=bogus")).abliterated).toBe("");
    expect(filtersFromParameters(new URLSearchParams("capability=video-generation&capability=ocr&capability=video")).capabilities).toEqual(["video-generation", "ocr"]);
  });

  test("requires every selected capability and combines model, readiness, and Spark facets", () => {
    const both = recipe("both", { capabilities: ["chat", "reasoning"], node_count: 4, topology_mode: "distributed" });
    const chat = recipe("chat", { capabilities: ["chat"], node_count: 4, topology_mode: "distributed" });
    const filters = { ...EMPTY_FILTERS, model: "models/both-v1", quantization: "NVFP4", updated: "30" as const, sparks: "4+" as const, readiness: "executable" as const, capabilities: ["chat", "reasoning"] };
    expect(recipeMatches(both, filters)).toBe(true);
    expect(recipeMatches(chat, filters)).toBe(false);
  });

  test("keeps standard and abliterated variants independently selectable", () => {
    const standard = recipe("standard", { alignment: "standard" });
    const abliterated = recipe("abliterated", { alignment: "abliterated" });
    expect(recipeMatches(standard, { ...EMPTY_FILTERS, abliterated: "false" })).toBe(true);
    expect(recipeMatches(abliterated, { ...EMPTY_FILTERS, abliterated: "false" })).toBe(false);
  });

  test("uses the Controller sort modes", () => {
    const large = recipe("zeta", { model_title: "Zeta", node_count: 4, expected_download_bytes: 400 });
    const small = recipe("alpha", { model_title: "Alpha", node_count: 1, expected_download_bytes: 100 });
    expect(sortRecipes([large, small], "model").map((item) => item.slug)).toEqual(["alpha", "zeta"]);
    expect(sortRecipes([large, small], "sparks").map((item) => item.slug)).toEqual(["alpha", "zeta"]);
    expect(sortRecipes([large, small], "download").map((item) => item.slug)).toEqual(["alpha", "zeta"]);
    expect(sortRecipes([large, small], "model", "desc").map((item) => item.slug)).toEqual(["zeta", "alpha"]);
    expect(sortRecipes([large, small], "creator").map((item) => item.slug)).toEqual(["alpha", "zeta"]);
  });
});
