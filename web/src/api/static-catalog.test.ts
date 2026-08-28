import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { getStaticRecipe, listStaticRecipes, resetStaticCatalogCacheForTests } from "./static-catalog";


const index = {
  schema_version: 2,
  repository: "CarstVaartjes/vonk-forge-recipes",
  catalog_entities: [
    { document: { kind: "model-version", identity: { publisher: "qwen", slug: "qwen-fast-v1" }, model: { publisher: "qwen", slug: "qwen-fast" } } },
    { document: { kind: "model", identity: { publisher: "qwen", slug: "qwen-fast" }, metadata: { title: "Qwen Fast Model" } } },
  ],
  recipes: [
    {
      content_sha256: "a".repeat(64),
      source_path: "recipes/qwen-fast.json",
      release: { version: "2.1.0", released_at: "2026-08-28", history: [{}, {}] },
      document: {
        identity: { publisher: "vonk-forge", slug: "qwen-fast" },
        metadata: { title: "Qwen Fast NVFP4", description: "Fast language model", tags: ["candidate", "executable", "reasoning", "nvfp4"] },
        model: { publisher: "qwen", slug: "qwen-fast-v1" },
        interfaces: [{ adapter: "openai" }],
        runtime: { distribution: { slug: "vllm" }, entrypoint: ["vllm", "serve"] },
        execution: { harness: { slug: "openai-chat" } },
        topology: {
          name: "solo",
          node_count: 1,
          roles: [{ resources: { disk: { artifact_bytes: 20 }, memory: { startup_peak_bytes: 48 } } }],
        },
        build: { context: { path: "adapters/qwen", sha256: "b".repeat(64), expected_bytes: 10 }, dockerfile: "Dockerfile" },
        artifacts: [{ kind: "huggingface.snapshot", repository: "Qwen/Qwen", revision: "c".repeat(40), download_bytes: 20 }],
        provenance: { source_kind: "global", source_reference: "https://huggingface.co/Qwen/Qwen-Fast/tree/abc", attribution: ["Qwen"] },
      },
    },
    {
      content_sha256: "d".repeat(64),
      source_path: "recipes/glm-dual.json",
      release: { version: "1.0.0", released_at: "2026-08-27", history: [{}] },
      document: {
        identity: { publisher: "community", slug: "glm-dual" },
        metadata: { title: "GLM Dual", tags: ["chat"] },
        runtime: { distribution: { slug: "sglang" }, entrypoint: ["sglang", "serve"] },
        topology: { name: "dual", node_count: 2, roles: [] },
        build: { context: { path: "adapters/glm", sha256: "e".repeat(64) }, dockerfile: "Dockerfile" },
      },
    },
  ],
};

beforeEach(() => {
  resetStaticCatalogCacheForTests();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => index }));
});

afterEach(() => vi.unstubAllGlobals());

describe("static recipe library adapter", () => {
  test("maps the immutable library index into public recipe cards", async () => {
    const page = await listStaticRecipes("https://example.test/catalog-index.json", new URLSearchParams("runtime=vllm&topology=single"));

    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      publisher: "vonk-forge",
      slug: "qwen-fast",
      title: "Qwen Fast NVFP4",
      version: "2.1.0",
      runtime: { adapter: "vllm" },
      capacity: { profile_node_counts: [1], maximum_installed_bytes_per_node: 20, maximum_runtime_memory_bytes_per_node: 48 },
      catalog: {
        model_publisher: "qwen",
        model_slug: "qwen-fast",
        model_title: "Qwen Fast Model",
        model_version_publisher: "qwen",
        model_version_slug: "qwen-fast-v1",
        model_version_title: "qwen-fast-v1",
        source_owner: "Qwen",
        source_repository: "https://huggingface.co/Qwen/Qwen-Fast",
        capabilities: ["chat", "reasoning"],
        qualification: "candidate",
        execution_readiness: "executable",
        precision: "NVFP4",
        quantizations: ["NVFP4"],
      },
    });
  });

  test("provides immutable detail, import, and source links without an API", async () => {
    const recipe = await getStaticRecipe("https://example.test/catalog-index.json", "vonk-forge", "qwen-fast");

    expect(recipe.import?.uri).toBe(`vonk://catalog/vonk-forge/qwen-fast@sha256:${"a".repeat(64)}`);
    expect(recipe.source?.recipe_url).toBe("https://github.com/CarstVaartjes/vonk-forge-recipes/blob/main/recipes/qwen-fast.json");
    expect(recipe.source?.bundle_url).toBe("https://github.com/CarstVaartjes/vonk-forge-recipes/tree/main/adapters/qwen");
    expect(recipe.latest_revision.document).toMatchObject({ identity: { slug: "qwen-fast" } });
  });
});
