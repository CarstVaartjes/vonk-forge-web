import { describe, expect, test } from "vitest";

import { deriveCatalogStats, parseCatalogSummary, type StatsRecipe } from "./catalog-stats";
import { catalogFacts, vocabularyFixture } from "./vocabulary.fixture";


const UPDATED = "2026-11-13T00:05:47Z";

function recipe(slug: string, options: { owner?: string | null; status?: string; capabilities?: string[]; updated?: string; family?: string; nodes?: number; tested?: string; measured?: number } = {}): StatsRecipe {
  return {
    evidence: options.tested ? { tested_at: options.tested } : null,
    capacity: options.measured ? { measured_memory_bytes_per_node: options.measured } : undefined,
    publisher: "vonk-forge",
    slug,
    title: slug,
    official: true,
    content_sha256: slug.padEnd(64, "0"),
    published_at: options.updated ?? "2026-01-01",
    runtime: { adapter: "vllm" },
    catalog: catalogFacts({
      description: "",
      tags: [],
      model_publisher: "m",
      model_slug: slug,
      model_title: slug,
      model_version_publisher: "m",
      model_version_slug: slug,
      model_version_title: slug,
      model_family: options.family ?? slug,
      source_owner: options.owner === undefined ? "owner" : options.owner,
      source_repository: null,
      alignment: "standard",
      capabilities: options.capabilities ?? ["chat"],
      qualification: options.status ?? "Working",
      qualification_reason: null,
      execution_readiness: "executable",
      runtime_distribution: "vllm",
      precision: null,
      quantizations: [],
      node_count: options.nodes ?? 1,
      expected_download_bytes: 0,
    }),
  };
}


describe("home page numbers", () => {
  test("all three headline counts are over verified recipes only", () => {
    const stats = deriveCatalogStats([
      recipe("a", { family: "Qwen", owner: "NVIDIA" }),
      recipe("b", { family: "qwen ", owner: "nvidia" }),
      recipe("c", { family: "GLM", owner: "eugr" }),
      recipe("unverified-family", { family: "Hidden", owner: "hidden", status: "Not yet verified" }),
      recipe("fix", { family: "Also hidden", owner: "also-hidden", status: "Fix to verify" }),
    ], vocabularyFixture, UPDATED);
    expect(stats.verified).toBe(3);
    expect(stats.families).toBe(2);
    expect(stats.creators).toBe(2);
  });

  test("folds creators that differ only by case and names them by their commonest spelling", () => {
    const stats = deriveCatalogStats([
      recipe("a", { owner: "NVIDIA" }), recipe("b", { owner: "nvidia" }), recipe("c", { owner: "NVIDIA" }),
      recipe("d", { owner: "eugr" }), recipe("e", { owner: "eugr", status: "Not yet verified" }),
      recipe("f", { owner: null }),
    ], vocabularyFixture, UPDATED);
    expect(stats.topCreators).toEqual([{ name: "NVIDIA", verified: 3 }, { name: "eugr", verified: 1 }]);
  });

  test("ranks creators by verified recipes and leaves out those with none", () => {
    const stats = deriveCatalogStats([
      recipe("a", { owner: "many", status: "Not yet verified" }), recipe("b", { owner: "many", status: "Not yet verified" }),
      recipe("c", { owner: "few" }),
    ], vocabularyFixture, UPDATED);
    expect(stats.topCreators).toEqual([{ name: "few", verified: 1 }]);
  });

  test("counts verified recipes per type through the one capability mapping", () => {
    const stats = deriveCatalogStats([
      recipe("vlm", { capabilities: ["chat", "image-understanding"] }),
      recipe("coder", { capabilities: ["code-generation", "text-generation"] }),
      recipe("img", { capabilities: ["image-generation"] }),
      recipe("unverified-video", { capabilities: ["video-generation"], status: "Not yet verified" }),
      recipe("none", { capabilities: [] }),
    ], vocabularyFixture, UPDATED);
    expect(stats.types.map(({ id, label, verified }) => `${id}|${label}|${verified}`)).toEqual([
      "language|Language|2", "code|Code|1", "vision|Vision|1", "image|Image|1", "video|Video|0", "audio|Audio|0", "3d|3D|0", "other|Other|0",
    ]);
  });
});

describe("per-recipe rows and series", () => {
  const stats = deriveCatalogStats([
    recipe("a", { owner: "NVIDIA", nodes: 2, tested: "2026-11-12T10:00:00Z", updated: "2026-11-13", measured: 5 }),
    recipe("b", { owner: "nvidia", status: "Re-check: worked before", tested: "2026-11-12T11:00:00Z", updated: "2026-11-06" }),
    recipe("c", { owner: null, status: "Not yet verified", nodes: 2, updated: "2020-01-01" }),
  ], vocabularyFixture, UPDATED);

  test("one row per recipe: verified from the vocabulary flag, passed-before from the evidence, creators folded (tie: alphabetical)", () => {
    expect(stats.total).toBe(3);
    expect(stats.recipes.map((row) => [row.slug, row.creator, row.sparks, row.verified, row.passedBefore, row.measuredBytes])).toEqual([
      ["a", "nvidia", 2, true, false, 5], ["b", "nvidia", 1, false, true, null], ["c", null, 2, false, false, null],
    ]);
  });

  test("statuses in vocabulary order and shelves per Spark count", () => {
    expect(stats.statuses).toEqual([{ status: "Working", count: 1 }, { status: "Re-check: worked before", count: 1 }, { status: "Not yet verified", count: 1 }]);
    expect(stats.bySparks).toEqual([{ sparks: 1, total: 1, verified: 0 }, { sparks: 2, total: 2, verified: 1 }]);
  });

  test("16 weekly and 28 daily buckets end on the release day; older recipes fall outside", () => {
    expect(stats.releasedPerWeek).toHaveLength(16);
    expect(stats.releasedPerWeek.at(-1)).toEqual({ start: "2026-11-07", count: 1 });
    expect(stats.releasedPerWeek.at(-2)).toEqual({ start: "2026-10-31", count: 1 });
    expect(stats.releasedPerWeek.reduce((total, week) => total + week.count, 0)).toBe(2);
    expect(stats.passesPerDay).toHaveLength(28);
    expect(stats.passesPerDay.find((day) => day.day === "2026-11-12")).toEqual({ day: "2026-11-12", count: 2 });
  });
});

describe("catalog summary file", () => {
  const good = { summary_version: 2, release: "v3.1.0", catalog_index_sha256: "a".repeat(64), ...deriveCatalogStats([recipe("a", { updated: "2026-11-05" })], vocabularyFixture, UPDATED) };

  test("accepts what the build writes", () => {
    expect(parseCatalogSummary(JSON.parse(JSON.stringify(good)))).toMatchObject({ verified: 1, families: 1, creators: 1 });
  });

  test("a release with nothing verified is a valid summary of zeros", () => {
    const empty = { summary_version: 2, release: "v3.1.0", catalog_index_sha256: "a".repeat(64), ...deriveCatalogStats([recipe("a", { status: "Not yet verified" })], vocabularyFixture, UPDATED) };
    expect(parseCatalogSummary(JSON.parse(JSON.stringify(empty)))).toMatchObject({ verified: 0, families: 0, creators: 0, topCreators: [] });
  });

  test.each([
    ["no object", null],
    ["the retired version", { ...good, summary_version: 1 }],
    ["rows that do not add up to the total", { ...good, total: 5 }],
    ["a row without a status", { ...good, recipes: [{ ...good.recipes[0], status: "" }] }],
    ["a week without a count", { ...good, releasedPerWeek: [{ start: "2026-11-01" }] }],
    ["a missing count", { ...good, families: undefined }],
    ["a fractional count", { ...good, creators: 1.5 }],
    ["types that are not a list", { ...good, types: { language: 1 } }],
    ["a type without a label", { ...good, types: [{ id: "code", verified: 1 }] }],
  ])("refuses %s rather than rendering zeros", (_name, value) => {
    expect(() => parseCatalogSummary(value)).toThrow("unsupported catalog summary");
  });
});
