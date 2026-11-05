import { describe, expect, test } from "vitest";

import type { ModelSummary, RecipeSummary } from "./api/client";
import { deriveCatalogStats } from "./catalog-stats";


function recipe(slug: string, options: { owner?: string | null; status?: string; capabilities?: string[]; released?: string } = {}): RecipeSummary {
  return {
    publisher: "vonk-forge",
    slug,
    title: slug,
    official: true,
    content_sha256: slug.padEnd(64, "0"),
    published_at: options.released ?? "2026-01-01",
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
      model_family: slug,
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

function model(slug: string, family: string | undefined): ModelSummary {
  return { publisher: "p", slug, title: slug, description: "", family, runs: { spark_counts: [], engines: [], creators: [] }, verified_runs: { spark_counts: [], engines: [], creators: [] }, tags: [], revision_id: "r", versions: [], recipe_count: 0 };
}

const now = new Date("2026-11-06T12:00:00Z");

describe("home page numbers", () => {
  test("counts verified recipes by the published status only", () => {
    const stats = deriveCatalogStats([recipe("a"), recipe("b", { status: "Not yet verified" }), recipe("c", { status: "Fix to verify" }), recipe("d")], [], now);
    expect(stats.recipes).toBe(4);
    expect(stats.verified).toBe(2);
  });

  test("counts families case-insensitively and ignores models without one", () => {
    const stats = deriveCatalogStats([], [model("a", "Qwen"), model("b", "qwen "), model("c", "GLM"), model("d", undefined)], now);
    expect(stats.families).toBe(2);
  });

  test("folds creators that differ only by case and names them by their commonest spelling", () => {
    const stats = deriveCatalogStats([
      recipe("a", { owner: "NVIDIA" }), recipe("b", { owner: "nvidia" }), recipe("c", { owner: "NVIDIA" }),
      recipe("d", { owner: "eugr" }), recipe("e", { owner: "eugr", status: "Not yet verified" }),
      recipe("f", { owner: null }),
    ], [], now);
    expect(stats.creators).toBe(2);
    expect(stats.topCreators).toEqual([{ name: "NVIDIA", verified: 3 }, { name: "eugr", verified: 1 }]);
  });

  test("ranks creators by verified recipes, not all recipes, and leaves out those with none", () => {
    const stats = deriveCatalogStats([
      recipe("a", { owner: "many", status: "Not yet verified" }), recipe("b", { owner: "many", status: "Not yet verified" }),
      recipe("c", { owner: "few" }),
    ], [], now);
    expect(stats.creators).toBe(2);
    expect(stats.topCreators).toEqual([{ name: "few", verified: 1 }]);
  });

  test("counts verified recipes per type through the one capability mapping", () => {
    const stats = deriveCatalogStats([
      recipe("vlm", { capabilities: ["chat", "image-understanding"] }),
      recipe("coder", { capabilities: ["code-generation", "text-generation"] }),
      recipe("img", { capabilities: ["image-generation"] }),
      recipe("unverified-video", { capabilities: ["video-generation"], status: "Not yet verified" }),
      recipe("none", { capabilities: [] }),
    ], [], now);
    expect(stats.typeCounts).toEqual({ language: 2, code: 1, vision: 1, image: 1, video: 0, audio: 0, "3d": 0 });
  });

  test("lists the last seven days newest first, or the latest releases when there are none", () => {
    const recent = deriveCatalogStats([recipe("old", { released: "2026-10-01" }), recipe("mid", { released: "2026-11-02" }), recipe("new", { released: "2026-11-05" })], [], now);
    expect(recent.newestThisWeek).toBe(true);
    expect(recent.newThisWeek).toBe(2);
    expect(recent.newest.map((item) => item.slug)).toEqual(["new", "mid"]);

    const quiet = deriveCatalogStats([recipe("old", { released: "2026-10-01" }), recipe("older", { released: "2026-09-01" })], [], now, 1);
    expect(quiet.newestThisWeek).toBe(false);
    expect(quiet.newThisWeek).toBe(0);
    expect(quiet.newest.map((item) => item.slug)).toEqual(["old"]);
  });
});
