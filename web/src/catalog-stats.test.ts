import { describe, expect, test } from "vitest";

import type { RecipeSummary } from "./api/client";
import { deriveCatalogStats, parseCatalogSummary, updatedThisWeek } from "./catalog-stats";


function recipe(slug: string, options: { owner?: string | null; status?: string; capabilities?: string[]; updated?: string; family?: string } = {}): RecipeSummary {
  return {
    publisher: "vonk-forge",
    slug,
    title: slug,
    official: true,
    content_sha256: slug.padEnd(64, "0"),
    published_at: options.updated ?? "2026-01-01",
    runtime: { adapter: "vllm" },
    catalog: {
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
      node_count: 1,
      expected_download_bytes: 0,
    },
  };
}

const now = new Date("2026-11-06T12:00:00Z");

describe("home page numbers", () => {
  test("all three headline counts are over verified recipes only", () => {
    const stats = deriveCatalogStats([
      recipe("a", { family: "Qwen", owner: "NVIDIA" }),
      recipe("b", { family: "qwen ", owner: "nvidia" }),
      recipe("c", { family: "GLM", owner: "eugr" }),
      recipe("unverified-family", { family: "Hidden", owner: "hidden", status: "Not yet verified" }),
      recipe("fix", { family: "Also hidden", owner: "also-hidden", status: "Fix to verify" }),
    ]);
    expect(stats.verified).toBe(3);
    expect(stats.families).toBe(2);
    expect(stats.creators).toBe(2);
  });

  test("folds creators that differ only by case and names them by their commonest spelling", () => {
    const stats = deriveCatalogStats([
      recipe("a", { owner: "NVIDIA" }), recipe("b", { owner: "nvidia" }), recipe("c", { owner: "NVIDIA" }),
      recipe("d", { owner: "eugr" }), recipe("e", { owner: "eugr", status: "Not yet verified" }),
      recipe("f", { owner: null }),
    ]);
    expect(stats.topCreators).toEqual([{ name: "NVIDIA", verified: 3 }, { name: "eugr", verified: 1 }]);
  });

  test("ranks creators by verified recipes and leaves out those with none", () => {
    const stats = deriveCatalogStats([
      recipe("a", { owner: "many", status: "Not yet verified" }), recipe("b", { owner: "many", status: "Not yet verified" }),
      recipe("c", { owner: "few" }),
    ]);
    expect(stats.topCreators).toEqual([{ name: "few", verified: 1 }]);
  });

  test("counts verified recipes per type through the one capability mapping", () => {
    const stats = deriveCatalogStats([
      recipe("vlm", { capabilities: ["chat", "image-understanding"] }),
      recipe("coder", { capabilities: ["code-generation", "text-generation"] }),
      recipe("img", { capabilities: ["image-generation"] }),
      recipe("unverified-video", { capabilities: ["video-generation"], status: "Not yet verified" }),
      recipe("none", { capabilities: [] }),
    ]);
    expect(stats.types).toEqual({ language: 2, code: 1, vision: 1, image: 1, video: 0, audio: 0, "3d": 0 });
  });

  test("the update date is the recipe's published_at (released_at), and any status counts", () => {
    const stats = deriveCatalogStats([
      recipe("old", { updated: "2026-10-01" }),
      recipe("fresh", { updated: "2026-11-05", status: "Not yet verified" }),
      recipe("same-day", { updated: "2026-11-05T09:00:00Z" }),
    ]);
    expect(stats.updatedByDate).toEqual({ "2026-11-05": 2 });
    expect(stats.newest.map((item) => [item.slug, item.date, item.status])).toEqual([["same-day", "2026-11-05", "Working"], ["fresh", "2026-11-05", "Not yet verified"], ["old", "2026-10-01", "Working"]]);
  });

  test("this week is judged on the visitor's clock from the summary's dates", () => {
    const stats = deriveCatalogStats([recipe("old", { updated: "2026-10-01" }), recipe("mid", { updated: "2026-11-02" }), recipe("new", { updated: "2026-11-05" }), recipe("new2", { updated: "2026-11-05" })]);
    const week = updatedThisWeek(stats, now);
    expect(week.count).toBe(3);
    expect(week.recipes.map((item) => item.slug)).toEqual(["new", "new2", "mid"]);
    expect(updatedThisWeek(stats, new Date("2026-12-31T00:00:00Z"))).toEqual({ count: 0, recipes: [] });
  });
});

describe("catalog summary file", () => {
  const good = { summary_version: 1, release: "v3.1.0", catalog_index_sha256: "a".repeat(64), ...deriveCatalogStats([recipe("a", { updated: "2026-11-05" })]) };

  test("accepts what the build writes", () => {
    expect(parseCatalogSummary(JSON.parse(JSON.stringify(good)))).toMatchObject({ verified: 1, families: 1, creators: 1 });
  });

  test.each([
    ["no object", null],
    ["another version", { ...good, summary_version: 2 }],
    ["zero verified", { ...good, verified: 0 }],
    ["a missing count", { ...good, families: undefined }],
    ["a fractional count", { ...good, creators: 1.5 }],
    ["a missing type", { ...good, types: { language: 1 } }],
    ["an unknown type", { ...good, types: { ...good.types, hologram: 1 } }],
    ["a bad date", { ...good, updatedByDate: { yesterday: 1 } }],
    ["no creators", { ...good, topCreators: [] }],
    ["a malformed recipe row", { ...good, newest: [{ title: "x" }] }],
  ])("refuses %s rather than rendering zeros", (_name, value) => {
    expect(() => parseCatalogSummary(value)).toThrow("unsupported catalog summary");
  });
});
