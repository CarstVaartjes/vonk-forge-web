import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { catalogIndexFixture } from "./catalog.fixture";
import type { CatalogIndex } from "./catalog-types";
import { displayTitle, getStaticLibraryRelease, getStaticModel, getStaticVocabulary, getStaticRecipe, listStaticModels, listStaticRecipeCatalog, resetStaticCatalogCacheForTests } from "./static-catalog";


// Real entries of the signed library (see catalog.fixture.ts): two single-Spark Working
// gemma recipes, a Working 3D recipe and an eight-Spark recipe that needs more Sparks.
const index = catalogIndexFixture as CatalogIndex;
const release = { repository: index.repository, tag: "v4.8.0", contract_version: index.contract_version, updated_at: index.updated_at, source_commit: index.source_commit, catalog_index_sha256: "a".repeat(64) };
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
    // The index's own `families` document is the oracle: one row per hierarchy Model.
    expect(models.items).toHaveLength(index.families!.flatMap((family) => family.lines.flatMap((line) => line.models)).length);
  });

  test("one caller aborting never cancels the shared index fetch", async () => {
    const fetchMock = serve(index);
    const signals: Array<AbortSignal | undefined> = [];
    const served = fetchMock.getMockImplementation()!;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => { signals.push(init?.signal ?? undefined); return served(url); }));
    const first = new AbortController();
    const aborted = listStaticModels(indexUrl, first.signal);
    const kept = listStaticModels(indexUrl, new AbortController().signal);
    first.abort(new Error("page left"));
    await expect(aborted).rejects.toThrow("page left");
    expect((await kept).items.length).toBeGreaterThan(0);
    expect(signals).toEqual([undefined, undefined]);
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
    expect((await listStaticModels(indexUrl)).items).toHaveLength(3);
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
        model_publisher: "gemma",
        model_slug: "gemma-e2b--gemma-4-e2b",
        model_title: "Gemma 4 E2B",
        model_version_slug: "gemma-4-e2b-it-4adf1574",
        model_family: "Gemma",
        source_owner: "NVIDIA",
        source_repository: "https://github.com/NVIDIA/dgx-spark-playbooks",
        alignment: "unspecified",
        capabilities: ["audio-understanding", "chat", "image-understanding", "reasoning", "text-generation", "tool-use"],
        types: ["language", "vision", "audio"],
        qualification: "Working",
        verified: true,
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
    expect(recipe.catalog).toMatchObject({ node_count: 8, runtime_distribution: "sglang", qualification: "Not yet verified", verified: false, qualification_reason: "needs more Sparks" });
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

  test("a recipe with measured memory carries the largest role peak per node; one without carries none", async () => {
    const measured = index.recipes.find((item) => item.measured_memory)!;
    const peak = Math.max(...measured.measured_memory!.roles.map((role) => role.measured_peak_bytes));
    const recipes = await listStaticRecipeCatalog(indexUrl);
    expect(recipes.find((item) => item.slug === measured.document.identity.slug)!.capacity?.measured_memory_bytes_per_node).toBe(peak);
    expect(recipes.filter((item) => item.capacity?.measured_memory_bytes_per_node !== undefined)).toHaveLength(index.recipes.filter((item) => item.measured_memory).length);
  });

  test("detail carries the newest hardware pass, the chat API, the setting defaults and the license from the index", async () => {
    const recipe = await getStaticRecipe(indexUrl, "vonk-forge", nvidia);
    const pass = index.recipes[0]!.qualification.last_pass!;
    expect(recipe.evidence).toEqual({
      tested_at: "2026-11-03T23:29:07.790267Z", spark_count: 1, hardware_class: pass.platform.hardware_class,
      evidence_ref: pass.evidence_refs![0], image_digest: pass.identity.runtime_image!.image_digest,
    });
    expect(recipe.chat_api).toEqual({ endpoints: ["/v1/chat/completions", "/v1/completions", "/v1/responses", "/v1/messages"], streaming: true, structured_output: true, image_input: true, audio_input: true });
    expect(recipe.settings).toEqual({ context_tokens: 131072 });
    expect(recipe.served_names).toEqual(["gemma-4-e2b-it"]);
    expect(recipe.credits).toEqual(["NVIDIA", "vLLM contributors", "Google DeepMind"]);
    expect(recipe.license).toEqual({ spdx: "Apache-2.0", url: "https://ai.google.dev/gemma/docs/gemma_4_license" });
  });

  // The fixture's 3D job recipe (SkinTokens) given the H3 recipe's real knobs and display labels, and its model the
  // H3 regional notice, in the shapes the published index uses.
  function withH3Options(): CatalogIndex {
    const copy = structuredClone(index);
    const recipe = copy.recipes.find((entry) => entry.document.identity.slug === "skintokens-pytorch-single")!;
    if (recipe.document.settings.kind !== "job") throw new Error("fixture recipe is not a job");
    recipe.document.settings.knobs = {
      "num-frames": { change_effect: "none", maximum: 345, minimum: 124, step: 17, value: 124 },
      "num-inference-steps": { change_effect: "none", maximum: 51, minimum: 2, value: 31 },
    };
    recipe.display.knobs = { "num-frames": { label: "Frames", unit: "frames", description: "Video length at 24 fps." } };
    const model = copy.catalog_entities.find((entity) => entity.document.identity.slug === "skintokens")!;
    model.display.license.territorial_restrictions = { denied_jurisdictions: ["EU", "GB", "KR", "US"], notice: "The MiniMax H3 Community License Agreement excludes the European Union, United Kingdom, Republic of Korea, and United States of America from its Applicable Territory." };
    return copy;
  }

  test("a job recipe carries its input and output slots and typed options with the display labels; a chat recipe carries none", async () => {
    serve(withH3Options());
    const recipe = await getStaticRecipe(indexUrl, "vonk-forge", "skintokens-pytorch-single");
    expect(recipe.job!.inputs).toEqual([{ id: "mesh", label: "Character mesh", description: "One GLB character mesh to rig with SkinTokens.", media_types: ["model/gltf-binary"], extensions: [".glb"], min_files: 1, max_files: 1 }]);
    expect(recipe.job!.outputs).toEqual([{ id: "mesh", label: "Rigged mesh", description: "The rigged SkinTokens binary glTF mesh.", media_types: ["model/gltf-binary"], extensions: [".glb"], min_files: 1, max_files: 1 }]);
    expect(recipe.job!.options).toEqual([
      { key: "num-frames", label: "Frames", description: "Video length at 24 fps.", unit: "frames", default: 124, minimum: 124, maximum: 345, step: 17 },
      { key: "num-inference-steps", label: "num-inference-steps", default: 31, minimum: 2, maximum: 51 },
    ]);
    expect(recipe.settings).toEqual({});
    expect((await getStaticRecipe(indexUrl, "vonk-forge", nvidia)).job).toBeUndefined();
  });

  test("the regional license notice reaches the recipe and the model version", async () => {
    serve(withH3Options());
    const notice = "The MiniMax H3 Community License Agreement excludes the European Union, United Kingdom, Republic of Korea, and United States of America from its Applicable Territory.";
    expect((await getStaticRecipe(indexUrl, "vonk-forge", "skintokens-pytorch-single")).license.notice).toBe(notice);
    const versions = (await listStaticModels(indexUrl)).items.flatMap((model) => model.versions);
    expect(versions.find((version) => version.slug === "skintokens")!.license!.notice).toBe(notice);
    expect((await getStaticRecipe(indexUrl, "vonk-forge", nvidia)).license.notice).toBeUndefined();
  });

  test("a model whose quantization is the literal none has no quantization, not one called NONE", async () => {
    const recipe = await getStaticRecipe(indexUrl, "vonk-forge", "skintokens-pytorch-single");
    expect(recipe.catalog.quantizations).toEqual([]);
    const versions = (await listStaticModels(indexUrl)).items.flatMap((model) => model.versions);
    expect(versions.find((version) => version.slug === "skintokens")!.format?.quantization).toBeUndefined();
    expect((await getStaticRecipe(indexUrl, "vonk-forge", eight)).catalog.quantizations).toEqual(["NVFP4"]);
  });

  test("links model versions to recipes and preserves declared capabilities, license and file sizes", async () => {
    const page = await listStaticModels(indexUrl);
    expect(page.items.map((item) => `${item.publisher}/${item.slug}`)).toEqual(["gemma/gemma-e2b--gemma-4-e2b", "inkling/inkling-975b-a41b--inkling-975b-a41b", "skintokens/skintokens--skintokens"]);
    expect(page.items[0]).toMatchObject({
      title: "Gemma 4 E2B",
      family: "Gemma",
      tags: ["google", "gemma", "language", "instruction-tuned", "candidate"],
      // The ggml-org variant of the same lineage model sits inside it, not beside it.
      recipe_count: 2,
      runs: { spark_counts: [1], engines: ["llama-cpp", "vllm"], creators: ["NVIDIA", "ggml-org"] },
      versions: [{
        slug: "gemma-4-e2b-it-4adf1574",
        description: "Exact public Google Gemma 4 E2B instruction-tuned checkpoint.",
        requires_token: false,
        variant: "IT 4adf1574",
        source_repository: "https://huggingface.co/google/gemma-4-E2B-it",
        source_revision: "4adf15748de9e1a0097b6274cee9c15836c41c37",
        capabilities: ["audio-understanding", "chat", "image-understanding", "reasoning", "text-generation", "tool-use"],
        license: { spdx: "Apache-2.0" },
        recipe_slugs: [`vonk-forge/${nvidia}`],
      }, { slug: "gemma-4-e2b-it-q8-0-63f6c6f2" }],
    });
    // The eight-Spark model has a recipe but none verified.
    const inkling = page.items.find((item) => item.publisher === "inkling")!;
    expect(inkling).toMatchObject({ recipe_count: 1, verified_recipe_count: 0, verified_runs: { spark_counts: [], engines: [], creators: [] }, runs: { spark_counts: [8] } });
    expect(inkling.versions[0]!.sizes).toEqual({ download_bytes: expect.any(Number), installed_bytes: expect.any(Number) });
    await expect(getStaticModel(indexUrl, "gemma", "missing")).rejects.toThrow("Model not found");
  });

  test("reads the words of the release from the same index", async () => {
    const fetchMock = serve(index);
    await listStaticRecipeCatalog(indexUrl);
    await expect(getStaticVocabulary(indexUrl)).resolves.toEqual(index.vocabulary);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((await listStaticModels(indexUrl)).items.map((item) => item.types)).toEqual([["language", "vision", "audio"], ["language", "vision", "audio"], ["3d"]]);
  });

  test("a variant without lineage is in no Model: no row, no duplicate title", async () => {
    const helper = structuredClone(index.catalog_entities[0]!);
    helper.content_sha256 = "a".repeat(64);
    helper.display.lineage = null;
    helper.document.identity = { ...helper.document.identity, publisher: "helper", slug: "helper-drafter" };
    serve({ ...index, catalog_entities: [...index.catalog_entities, helper] });
    const page = await listStaticModels(indexUrl);
    expect(page.items).toHaveLength(index.families!.flatMap((family) => family.lines.flatMap((line) => line.models)).length);
    const titles = page.items.map((item) => item.title);
    expect(new Set(titles).size).toBe(titles.length);
    expect(page.items.flatMap((item) => item.versions.map((version) => version.slug))).not.toContain("helper-drafter");
  });

  test("two lineage Models whose variants share a logical model keep separate addresses", async () => {
    const entity = structuredClone(index.catalog_entities[0]!);
    entity.content_sha256 = "c".repeat(64);
    entity.document.identity = { ...entity.document.identity, publisher: "other", slug: "other-variant" };
    entity.display.lineage = { ...entity.display.lineage!, model: "gemma-4-e2b-next" };
    // The same logical model as the first Gemma variant, a different hierarchy Model.
    const body = { ...index, catalog_entities: [entity, ...index.catalog_entities] };
    serve(body);
    const page = await listStaticModels(indexUrl);
    const addresses = page.items.map((item) => `${item.publisher}/${item.slug}`);
    expect(new Set(addresses).size).toBe(addresses.length);
    expect(addresses).toContain("gemma/gemma-e2b--gemma-4-e2b-next");
    expect((await getStaticModel(indexUrl, "gemma", "gemma-e2b--gemma-4-e2b")).versions).toHaveLength(2);
    const recipes = await listStaticRecipeCatalog(indexUrl);
    expect(recipes.find((recipe) => recipe.slug === nvidia)!.catalog).toMatchObject({ model_publisher: "gemma", model_slug: "gemma-e2b--gemma-4-e2b" });
  });

  test("does not join same-slug entities when their immutable digests differ", async () => {
    const wrong = structuredClone(index.catalog_entities[0]!);
    wrong.content_sha256 = "9".repeat(64);
    wrong.display.model_title = "Wrong model";
    serve({ ...index, catalog_entities: [wrong, ...index.catalog_entities] });
    const recipe = await getStaticRecipe(indexUrl, "vonk-forge", nvidia);
    expect(recipe.catalog).toMatchObject({ model_title: "Gemma 4 E2B", capabilities: ["audio-understanding", "chat", "image-understanding", "reasoning", "text-generation", "tool-use"] });
  });

  test("a recipe counts for its first model only, not for a companion model it also lists", async () => {
    const copy = structuredClone(index);
    const gemma = copy.recipes.find((recipe) => recipe.document.identity.slug === nvidia)!;
    const skin = copy.recipes.find((recipe) => recipe.document.identity.slug === "skintokens-pytorch-single")!;
    gemma.document.models.push(skin.document.models[0]!);
    serve(copy);
    const skintokens = (await listStaticModels(indexUrl)).items.find((item) => item.publisher === "skintokens")!;
    expect(skintokens.recipe_count).toBe(1);
    expect(skintokens.versions.flatMap((version) => version.recipe_slugs)).toEqual(["vonk-forge/skintokens-pytorch-single"]);
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

  test("rejects an index without catalog entities", async () => {
    serve({ ...index, catalog_entities: [] });
    await expect(listStaticModels(indexUrl)).rejects.toThrow("unsupported catalog index");
  });

  test("reads the library version and update time from the release manifest alone", async () => {
    const fetchMock = serve(index);
    await expect(getStaticLibraryRelease(indexUrl)).resolves.toEqual({ version: "v4.8.0", updated_at: index.updated_at, index_sha256: "a".repeat(64) });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["https://example.test/catalog/release.json"]);
  });
});
