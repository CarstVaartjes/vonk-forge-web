import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { getStaticModel, getStaticRecipe, listStaticModels, listStaticRecipeCatalog, resetStaticCatalogCacheForTests } from "./static-catalog";


const index = {
  schema_version: 2,
  kind: "recipe-library-index",
  repository: "CarstVaartjes/vonk-forge-recipes",
  source_commit: "f".repeat(40),
  package_contract: {
    schema_version: 2,
    media_type: "application/vnd.vonk-forge.recipe-package.v2+tar+gzip",
    path_prefix: "packages/",
  },
  catalog_entities: [
    { content_sha256: "3".repeat(64), document: { kind: "model", schema_version: 2, identity: { publisher: "qwen", slug: "qwen-fast-nvfp4", family: { publisher: "qwen", slug: "qwen", title: "Qwen" }, model: { publisher: "qwen", slug: "qwen-fast", title: "Qwen Fast", architecture: "transformer" }, version: "1.0", variant: "nvfp4" }, metadata: { title: "Qwen Fast NVFP4", description: "Fast language model", tags: ["language"] }, source: { repository: "https://huggingface.co/Qwen/Qwen", revision: "c".repeat(40) }, format: { container: "safetensors", precision: "nvfp4", quantization: "nvfp4" }, parameters: { total: 20 }, limits: { context_tokens: 8192 }, sizes: { download_bytes: 20, installed_bytes: 20 }, license: { spdx: "Apache-2.0", url: "https://example.test/license", attribution: ["Qwen"], operator_acceptance_required: false }, files: [{ id: "weights", path: "weights.safetensors", sha256: "b".repeat(64), size_bytes: 20, roles: ["weights"] }], capabilities: { schema_version: 2, facts: [{ capability: "chat", support: "supported", evidence_status: "declared" }, { capability: "reasoning", support: "supported", evidence_status: "declared" }], provenance: { source_url: "https://example.test/evidence", source_revision: "c".repeat(40), evidence_digest: "d".repeat(64) } }, provenance: { source_url: "https://example.test/evidence", source_revision: "c".repeat(40), evidence_digest: "d".repeat(64), attribution: ["Qwen"] } } },
  ],
  recipes: [
    {
      content_sha256: "a".repeat(64),
      source_path: "recipes/qwen-fast.json",
      package: { expected_bytes: 123, media_type: "application/vnd.vonk-forge.recipe-package.v2+tar+gzip", minimum_consumer_schema: 2, path: "packages/vonk-forge-qwen-fast.tar.gz", recipe_content_sha256: "a".repeat(64), sha256: "1".repeat(64) },
      release: { version: "2.1.0", released_at: "2026-08-28", history: [{}, {}] },
      document: {
        identity: { publisher: "vonk-forge", slug: "qwen-fast" },
        metadata: { title: "Qwen Fast NVFP4", description: "Fast language model", tags: ["candidate", "executable", "reasoning", "nvfp4"], alignment: "standard" },
        kind: "recipe",
        schema_version: 2,
        models: [{ id: "primary", model: { kind: "model", publisher: "qwen", slug: "qwen-fast-nvfp4", content_sha256: "3".repeat(64) }, files: [{ id: "weights", file_id: "weights", roles: ["entrypoint"], mount: { target: "/models", read_only: true } }] }],
        interfaces: [{ adapter: "openai" }],
        runtime: { engine: "vllm", entrypoint: ["vllm", "serve"], arguments: [], environment: [], lifecycle: { pre_start: [], post_stop: [], stop_timeout_seconds: 120 } },
        execution: { mode: "build", build: { base_image: { repository: "ubuntu", digest: "e".repeat(64), platform: "linux/arm64" }, context: { path: "adapters/qwen" }, dockerfile: "Dockerfile", patches: [], target: null, arguments: [], network: { mode: "none", hosts: [] } } },
        topology: {
          name: "solo",
          node_count: 1,
          roles: [{ resources: { disk: { artifact_bytes: 20 }, memory: { startup_peak_bytes: 48 } } }],
        },
        provenance: { source_kind: "global", source_reference: "https://huggingface.co/Qwen/Qwen/tree/abc", attribution: ["Qwen"] },
        settings: { kind: "generation", context_tokens: { value: 8192, change_effect: "restart" }, concurrency: { value: 1, change_effect: "restart" }, max_batch_tokens: null, knobs: {} },
      },
    },
    {
      content_sha256: "d".repeat(64),
      source_path: "recipes/glm-dual.json",
      package: { expected_bytes: 321, media_type: "application/vnd.vonk-forge.recipe-package.v2+tar+gzip", minimum_consumer_schema: 2, path: "packages/community-glm-dual.tar.gz", recipe_content_sha256: "d".repeat(64), sha256: "2".repeat(64) },
      release: { version: "1.0.0", released_at: "2026-08-27", history: [{}] },
      document: {
        identity: { publisher: "community", slug: "glm-dual" },
        metadata: { title: "GLM Dual", tags: ["chat"] },
        kind: "recipe",
        schema_version: 2,
        models: [{ id: "primary", model: { kind: "model", publisher: "qwen", slug: "qwen-fast-nvfp4", content_sha256: "3".repeat(64) }, files: [{ id: "weights", file_id: "weights", roles: ["entrypoint"], mount: { target: "/models", read_only: true } }] }],
        runtime: { engine: "sglang", entrypoint: ["sglang", "serve"], arguments: [], environment: [], lifecycle: { pre_start: [], post_stop: [], stop_timeout_seconds: 120 } },
        execution: { mode: "build", build: { base_image: { repository: "ubuntu", digest: "f".repeat(64), platform: "linux/arm64" }, context: { path: "adapters/glm" }, dockerfile: "Dockerfile", patches: [], target: null, arguments: [], network: { mode: "none", hosts: [] } } },
        topology: { name: "dual", node_count: 2, roles: [] },
      },
    },
  ],
};

const release = { repository: "CarstVaartjes/vonk-forge-recipes", tag: "v1.2.3", source_commit: "f".repeat(40) };
const indexUrl = "https://example.test/catalog/catalog-index.json";

// Serve the verified release the Pages build writes: the index and its manifest.
function serve(indexBody: unknown, releaseBody: unknown = release) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url === "https://example.test/catalog/release.json") return { ok: true, json: async () => releaseBody };
    if (url === indexUrl) return { ok: true, json: async () => indexBody };
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  resetStaticCatalogCacheForTests();
  serve(index);
});

afterEach(() => vi.unstubAllGlobals());

describe("static recipe library adapter", () => {
  test("reads one verified release from this origin and links packages to its signed assets", async () => {
    const fetchMock = serve(index);
    const [recipe, models] = await Promise.all([
      getStaticRecipe(indexUrl, "vonk-forge", "qwen-fast"),
      listStaticModels(indexUrl),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(recipe.package?.url).toBe("https://github.com/CarstVaartjes/vonk-forge-recipes/releases/download/v1.2.3/vonk-forge-qwen-fast.tar.gz");
    expect(models.items[0]?.recipe_count).toBe(2);
  });

  test("resolves the default same-origin index path against the page", async () => {
    const fetchMock = vi.fn(async (url: string) => ({ ok: true, json: async () => (url.endsWith("release.json") ? release : index) }));
    vi.stubGlobal("fetch", fetchMock);
    await listStaticModels("/catalog/catalog-index.json");
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["/catalog/catalog-index.json", `${window.location.origin}/catalog/release.json`]);
  });

  test("rejects an index that does not belong to its release manifest", async () => {
    serve(index, { ...release, source_commit: "0".repeat(40) });
    await expect(listStaticModels(indexUrl)).rejects.toThrow("does not match its release");
    resetStaticCatalogCacheForTests();
    serve(index, { ...release, tag: "main" });
    await expect(listStaticModels(indexUrl)).rejects.toThrow("does not match its release");
  });

  test("retries a failed load without caching it", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, json: async () => release })
      .mockImplementation(async (url: string) => ({ ok: true, json: async () => (url.endsWith("release.json") ? release : index) }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(listStaticModels(indexUrl)).rejects.toThrow("returned 503");
    expect((await listStaticModels(indexUrl)).items).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  test("maps the immutable library index into public recipe cards", async () => {
    const recipes = await listStaticRecipeCatalog(indexUrl);

    expect(recipes).toHaveLength(2);
    expect(recipes.find((recipe) => recipe.slug === "qwen-fast")).toMatchObject({
      publisher: "vonk-forge",
      slug: "qwen-fast",
      title: "Qwen Fast NVFP4",
      version: "2.1.0",
      runtime: { adapter: "vllm" },
      capacity: { profile_node_counts: [1], maximum_installed_bytes_per_node: 20, maximum_runtime_memory_bytes_per_node: 48 },
      catalog: {
        model_publisher: "qwen",
        model_slug: "qwen-fast",
        model_title: "Qwen Fast",
        model_version_publisher: "qwen",
        model_version_slug: "qwen-fast-nvfp4",
        model_version_title: "Qwen Fast NVFP4",
        source_owner: "Qwen",
        source_repository: "https://huggingface.co/Qwen/Qwen",
        alignment: "standard",
        capabilities: ["chat", "reasoning"],
        qualification: "candidate",
        execution_readiness: "executable",
        precision: "nvfp4",
        quantizations: ["NVFP4"],
      },
    });
  });

  test("provides immutable detail, import, and source links without an API", async () => {
    const recipe = await getStaticRecipe(indexUrl, "vonk-forge", "qwen-fast");

    expect(recipe.import?.uri).toBe(`vonk://catalog/vonk-forge/qwen-fast@sha256:${"a".repeat(64)}`);
    expect(recipe.import?.instruction).toBe("Use this exact recipe in your local Controller.");
    expect(recipe.source?.recipe_url).toBe(`https://github.com/CarstVaartjes/vonk-forge-recipes/blob/${"f".repeat(40)}/recipes/qwen-fast.json`);
    expect(recipe.source?.bundle_url).toBe(`https://github.com/CarstVaartjes/vonk-forge-recipes/tree/${"f".repeat(40)}/adapters/qwen`);
    expect(recipe.package).toMatchObject({ url: "https://github.com/CarstVaartjes/vonk-forge-recipes/releases/download/v1.2.3/vonk-forge-qwen-fast.tar.gz", sha256: "1".repeat(64), bytes: 123 });
    expect(recipe.latest_revision.document).toMatchObject({ identity: { slug: "qwen-fast" } });
  });

  test("links model versions to recipes and preserves declared capability facts", async () => {
    const page = await listStaticModels(indexUrl);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      publisher: "qwen",
      slug: "qwen-fast",
      title: "Qwen Fast",
      recipe_count: 2,
      versions: [{
        slug: "qwen-fast-nvfp4",
        model_slug: "qwen-fast",
        capabilities: [
          { name: "chat", support: "supported" },
          { name: "reasoning", support: "supported" },
        ],
        capability_evidence: "declared",
        recipe_slugs: ["community/glm-dual", "vonk-forge/qwen-fast"],
      }],
    });
    await expect(getStaticModel(indexUrl, "qwen", "missing")).rejects.toThrow("Model not found");
  });

  test("keeps published model entities visible when no recipe selects them", async () => {
    const standaloneModel = {
      content_sha256: "4".repeat(64),
      document: {
        kind: "model",
        schema_version: 2,
        identity: { publisher: "standalone", slug: "standalone-v1", family: { publisher: "standalone", slug: "standalone", title: "Standalone" }, model: { publisher: "standalone", slug: "standalone", title: "Standalone" }, version: "1", variant: "bf16" },
        metadata: { title: "Standalone", tags: [] },
      },
    };
    resetStaticCatalogCacheForTests();
    serve({ ...index, catalog_entities: [...index.catalog_entities, standaloneModel] });
    const page = await listStaticModels(indexUrl);
    expect(page.items).toHaveLength(2);
    expect(page.items.find((item) => item.publisher === "standalone")).toMatchObject({ slug: "standalone", recipe_count: 0, versions: [{ recipe_slugs: [] }] });
  });

  test("does not join same-slug entities when their immutable digests differ", async () => {
    const adversarialIndex = {
      ...index,
      catalog_entities: [
        { content_sha256: "9".repeat(64), document: { kind: "model", schema_version: 2, identity: { publisher: "qwen", slug: "qwen-fast-wrong", family: { publisher: "qwen", slug: "qwen", title: "Qwen" }, model: { publisher: "qwen", slug: "qwen-fast", title: "Wrong model", architecture: "transformer" }, version: "1.0", variant: "wrong" }, metadata: { title: "Wrong version", description: "Wrong", tags: [] } } },
        ...index.catalog_entities,
      ],
    };
    resetStaticCatalogCacheForTests();
    serve(adversarialIndex);
    const recipe = await getStaticRecipe(indexUrl, "vonk-forge", "qwen-fast");
    expect(recipe.catalog).toMatchObject({ model_title: "Qwen Fast", model_version_title: "Qwen Fast NVFP4", capabilities: ["chat", "reasoning"] });
  });

  test("rejects an index without immutable catalog entities", async () => {
    resetStaticCatalogCacheForTests();
    serve({ ...index, catalog_entities: [] });
    await expect(listStaticModels(indexUrl)).rejects.toThrow("unsupported catalog index");
  });
});
