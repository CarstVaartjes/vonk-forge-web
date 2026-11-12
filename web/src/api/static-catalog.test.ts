import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { catalogIndexFixture } from "./catalog.fixture";
import type { CatalogIndex } from "./catalog-types";
import { displayTitle, getStaticLibraryRelease, getStaticModel, getStaticRecipe, listStaticModels, listStaticRecipeCatalog, resetStaticCatalogCacheForTests } from "./static-catalog";


// Real entries of the signed library (see catalog.fixture.ts): two single-Spark Working
// gemma recipes, a Working 3D recipe and an eight-Spark recipe that needs more Sparks.
const index = catalogIndexFixture as CatalogIndex;
const release = { repository: index.repository, tag: "v4.8.0", contract_version: index.contract_version, updated_at: index.updated_at, source_commit: index.source_commit };
const indexUrl = "https://example.test/catalog/catalog-index.json";
const nvidia = "gemma-4-e2b-it-nvidia-vllm-single";
const eight = "inkling-975b-a41b-nvfp4-sglang-eight";

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
  test("reads one verified release from this origin and offers no package download", async () => {
    const fetchMock = serve(index);
    const [recipe, models] = await Promise.all([
      getStaticRecipe(indexUrl, "vonk-forge", nvidia),
      listStaticModels(indexUrl),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(recipe.package).not.toHaveProperty("url");
    expect(models.items).toHaveLength(4);
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
    expect((await listStaticModels(indexUrl)).items).toHaveLength(4);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  test("maps a Working single-Spark recipe, projecting peak memory without the informational reserve", async () => {
    const recipes = await listStaticRecipeCatalog(indexUrl);

    expect(recipes.map((recipe) => recipe.slug)).toEqual([nvidia, "gemma-4-e2b-it-q8-0-ggml-org-llamacpp-single", eight, "skintokens-pytorch-single"]);
    expect(recipes[0]).toMatchObject({
      publisher: "vonk-forge",
      title: "Gemma 4 E2B IT vLLM single Spark (NVIDIA playbook)",
      version: "1.0.6",
      published_at: "2026-11-03",
      runtime: { adapter: "vllm" },
      // peak 119063746765 per node; the 8 GB reserve is not added. Disk is the sum of the four disk fields.
      capacity: { profile_node_counts: [1], maximum_installed_bytes_per_node: 60278835678, maximum_runtime_memory_bytes_per_node: 119063746765 },
      catalog: {
        description: index.recipes[0]!.display.description,
        model_publisher: "google",
        model_slug: "gemma-4-e2b",
        model_title: "Gemma 4 E2B",
        model_version_slug: "gemma-4-e2b-it-4adf1574",
        model_family: "Google Gemma",
        source_owner: "NVIDIA",
        source_repository: "https://github.com/NVIDIA/dgx-spark-playbooks",
        alignment: "unspecified",
        capabilities: ["audio-understanding", "chat", "image-understanding", "reasoning", "text-generation", "tool-use"],
        qualification: "Working",
        qualification_reason: null,
        execution_readiness: "executable",
        runtime_distribution: "vllm",
        precision: "bf16",
        node_count: 1,
      },
    });
  });

  test("an eight-Spark recipe keeps the largest role peak and its published reason", async () => {
    const recipe = (await listStaticRecipeCatalog(indexUrl)).find((item) => item.slug === eight)!;
    expect(recipe.capacity).toMatchObject({ profile_node_counts: [8], maximum_runtime_memory_bytes_per_node: 119000000000, maximum_installed_bytes_per_node: 1916112011354 });
    expect(recipe.catalog).toMatchObject({ node_count: 8, runtime_distribution: "sglang", qualification: "Not yet verified", qualification_reason: "needs more Sparks" });
    expect(recipe.runtime.adapter).toBe("sglang");
  });

  test.each(["Working", "Re-check: worked before", "Fix to verify", "Failed: recipe", "Not yet verified"] as const)("renders the published status %s as written, ignoring tags", async (status) => {
    const fixture = structuredClone(index);
    // Tags that used to drive the status must have no effect now.
    fixture.recipes[0]!.display.tags = ["accepted", "executable"];
    fixture.recipes[0]!.qualification = { ...fixture.recipes[0]!.qualification, status };
    serve(fixture);

    const summary = (await listStaticRecipeCatalog(indexUrl)).find((recipe) => recipe.slug === nvidia)!;
    const detail = await getStaticRecipe(indexUrl, "vonk-forge", nvidia);
    for (const recipe of [summary, detail]) {
      expect(recipe.catalog.qualification).toBe(status);
      expect(recipe.facts).toEqual({ source_bundle_observed: true });
    }
  });

  test("provides immutable detail, import, and source links without an API", async () => {
    const recipe = await getStaticRecipe(indexUrl, "vonk-forge", nvidia);

    expect(recipe.import?.uri).toBe(`vonk://catalog/vonk-forge/${nvidia}@sha256:${index.recipes[0]!.content_sha256}`);
    expect(recipe.import?.instruction).toBe("Use this exact recipe in your local Controller.");
    expect(recipe.source?.recipe_url).toBe(`https://github.com/CarstVaartjes/vonk-forge-recipes/blob/${index.source_commit}/recipes/${nvidia}.json`);
    expect(recipe.source?.bundle_url).toBe(`https://github.com/CarstVaartjes/vonk-forge-recipes/tree/${index.source_commit}/adapters/nvidia/${nvidia}`);
    expect(recipe.package).toMatchObject({ member: `${nvidia}.tar.gz`, sha256: index.recipes[0]!.package.sha256, bytes: index.recipes[0]!.package.expected_bytes });
    expect(recipe.latest_revision.document).toMatchObject({ identity: { slug: nvidia } });
    await expect(getStaticRecipe(indexUrl, "vonk-forge", "missing")).rejects.toThrow("Recipe not found");
  });

  test("links model versions to recipes and preserves declared capabilities, licence and file sizes", async () => {
    const page = await listStaticModels(indexUrl);
    expect(page.items.map((item) => `${item.publisher}/${item.slug}`)).toEqual(["google/gemma-4-e2b", "ggml-org/gemma-4-e2b", "thinkingmachines/inkling-975b-a41b", "vast-ai/skintokens"]);
    expect(page.items[0]).toMatchObject({
      title: "Gemma 4 E2B",
      description: "Exact public Google Gemma 4 E2B instruction-tuned checkpoint.",
      family: "Google Gemma",
      tags: ["google", "gemma", "language", "instruction-tuned", "candidate"],
      recipe_count: 1,
      verified_recipe_count: 1,
      runs: { spark_counts: [1], engines: ["vllm"], creators: ["NVIDIA"] },
      versions: [{
        slug: "gemma-4-e2b-it-4adf1574",
        model_slug: "gemma-4-e2b",
        requires_token: false,
        variant: "IT 4adf1574",
        source_repository: "https://huggingface.co/google/gemma-4-E2B-it",
        source_revision: "4adf15748de9e1a0097b6274cee9c15836c41c37",
        capabilities: ["audio-understanding", "chat", "image-understanding", "reasoning", "text-generation", "tool-use"],
        license: { spdx: "Apache-2.0" },
        recipe_slugs: [`vonk-forge/${nvidia}`],
      }],
    });
    // The eight-Spark model has a recipe but none verified.
    const inkling = page.items.find((item) => item.slug === "inkling-975b-a41b")!;
    expect(inkling).toMatchObject({ recipe_count: 1, verified_recipe_count: 0, verified_runs: { spark_counts: [], engines: [], creators: [] }, runs: { spark_counts: [8] } });
    expect(inkling.versions[0]!.sizes).toEqual({ download_bytes: expect.any(Number), installed_bytes: expect.any(Number) });
    await expect(getStaticModel(indexUrl, "google", "missing")).rejects.toThrow("Model not found");
  });

  test("keeps published model entities visible when no recipe selects them", async () => {
    const standalone = structuredClone(index.catalog_entities[3]!);
    standalone.content_sha256 = "4".repeat(64);
    standalone.document.identity = { ...standalone.document.identity, publisher: "standalone", slug: "standalone-v1", model: { publisher: "standalone", slug: "standalone" } };
    serve({ ...index, catalog_entities: [...index.catalog_entities, standalone] });
    const page = await listStaticModels(indexUrl);
    expect(page.items).toHaveLength(5);
    expect(page.items.find((item) => item.publisher === "standalone")).toMatchObject({ slug: "standalone", recipe_count: 0, versions: [{ recipe_slugs: [] }] });
  });

  test("does not join same-slug entities when their immutable digests differ", async () => {
    const wrong = structuredClone(index.catalog_entities[0]!);
    wrong.content_sha256 = "9".repeat(64);
    wrong.display.model_title = "Wrong model";
    serve({ ...index, catalog_entities: [wrong, ...index.catalog_entities] });
    const recipe = await getStaticRecipe(indexUrl, "vonk-forge", nvidia);
    expect(recipe.catalog).toMatchObject({ model_title: "Gemma 4 E2B", capabilities: ["audio-understanding", "chat", "image-understanding", "reasoning", "text-generation", "tool-use"] });
  });

  test("drops a dangling separator from a catalog title and keeps real names whole", async () => {
    expect(displayTitle("SkinTokens /")).toBe("SkinTokens");
    expect(displayTitle("GLM 5.3 Flash - ")).toBe("GLM 5.3 Flash");
    expect(displayTitle("Qwen3.8 27B-A3B")).toBe("Qwen3.8 27B-A3B");
    expect(displayTitle("  ", "fallback")).toBe("fallback");
    expect(displayTitle(undefined, "slug")).toBe("slug");
    // The published SkinTokens recipe title has a mid-title slash, which stays.
    const recipe = (await listStaticRecipeCatalog(indexUrl)).find((item) => item.slug === "skintokens-pytorch-single")!;
    expect(recipe.title).toBe("SkinTokens / TokenRig pytorch-pipeline single Spark");
  });

  test("rejects an index for another contract major or without catalog entities", async () => {
    serve({ ...index, contract_version: "3.2.0" });
    await expect(listStaticModels(indexUrl)).rejects.toThrow("unsupported catalog index");
    resetStaticCatalogCacheForTests();
    serve({ ...index, catalog_entities: [] });
    await expect(listStaticModels(indexUrl)).rejects.toThrow("unsupported catalog index");
  });

  test("reads the library version and update time from the release manifest alone", async () => {
    const fetchMock = serve(index);
    await expect(getStaticLibraryRelease(indexUrl)).resolves.toEqual({ version: "v4.8.0", updated_at: index.updated_at });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["https://example.test/catalog/release.json"]);
  });
});
