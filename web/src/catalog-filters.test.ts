import { describe, expect, test } from "vitest";

import type { RecipeSummary } from "./api/client";
import {
  EMPTY_FILTERS,
  capacityBucketMatches,
  capacityBuckets,
  capacityLabel,
  filtersFromParameters,
  nodeCountMatches,
  recipeMatches,
  SORT_CHOICES,
  sortRecipes,
  sparksFewerLabel,
} from "./catalog-filters";
import { catalogFacts } from "./vocabulary.fixture";

function recipe(
  slug: string,
  overrides: Partial<NonNullable<RecipeSummary["catalog"]>> & { capabilities?: string[] } = {},
): RecipeSummary {
  return {
    publisher: "vonk-forge",
    slug,
    title: slug,
    official: true,
    content_sha256: slug.padEnd(64, "0").slice(0, 64),
    published_at: new Date().toISOString().slice(0, 10),
    runtime: { adapter: "vllm" },
    catalog: catalogFacts({
      description: "",
      tags: [],
      model_publisher: "models",
      model_slug: slug,
      model_title: slug,
      model_version_publisher: "models",
      model_version_slug: `${slug}-v1`,
      model_version_title: `${slug} v1`,
      model_family: overrides.model_family ?? slug,
      source_owner: "owner",
      source_repository: "https://github.com/owner/repo",
      alignment: "standard",
      capabilities: ["chat"],
      qualification: "Working",
      qualification_reason: null,
      execution_readiness: "executable",
      runtime_distribution: "vllm-0-27-1",
      precision: "NVFP4",
      quantizations: ["NVFP4"],
      node_count: 1,
      expected_download_bytes: 100,
      ...overrides,
    }),
  };
}

test("a Spark count matches recipes that need that many or fewer; 4+ and none match every recipe", () => {
  expect([1, 2, 3, 8].map((nodes) => nodeCountMatches(nodes, "2"))).toEqual([
    true,
    true,
    false,
    false,
  ]);
  expect([1, 8].map((nodes) => nodeCountMatches(nodes, "4+"))).toEqual([true, true]);
  expect(nodeCountMatches(8, "")).toBe(true);
});

test("uses=N lists exactly the recipes needing N Sparks; a malformed count is ignored", () => {
  const [one, two] = [recipe("one", { node_count: 1 }), recipe("two", { node_count: 2 })];
  const both = filtersFromParameters(new URLSearchParams("sparks=2&uses=2"));
  expect(both).toMatchObject({ sparks: "2", uses: 2 });
  expect([one, two].filter((item) => recipeMatches(item, both)).map((item) => item.slug)).toEqual([
    "two",
  ]);
  expect(
    [one, two]
      .filter((item) =>
        recipeMatches(item, filtersFromParameters(new URLSearchParams("sparks=2&uses=1"))),
      )
      .map((item) => item.slug),
  ).toEqual(["one"]);
  expect(filtersFromParameters(new URLSearchParams("uses=x")).uses).toBe(0);
});

describe("capacity buckets", () => {
  const gib = (value: number) => value * 1024 ** 3;

  test("a bucket holds everything up to its bound, and an undeclared size only the unknown bucket", () => {
    expect(capacityBucketMatches(gib(64), "64")).toBe(true);
    expect(capacityBucketMatches(gib(16), "64")).toBe(true);
    expect(capacityBucketMatches(gib(64) + 1, "64")).toBe(false);
    expect(capacityBucketMatches(undefined, "64")).toBe(false);
    expect(capacityBucketMatches(undefined, "unknown")).toBe(true);
    expect(capacityBucketMatches(gib(1), "unknown")).toBe(false);
    expect(capacityBucketMatches(gib(900), "")).toBe(true);
  });

  test("many distinct sizes give a few buckets with unique labels, up to the one covering the largest", () => {
    const sizes = [7.5, 19, 19, 56, 56, 56, 56, 56, 100, 116].map(gib);
    const buckets = capacityBuckets([...sizes, undefined]);
    expect(buckets).toEqual(["16", "32", "64", "128", "unknown"]);
    const labels = buckets.map(capacityLabel);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels.slice(0, 4)).toEqual(["≤ 16 GiB", "≤ 32 GiB", "≤ 64 GiB", "≤ 128 GiB"]);
    expect(capacityBuckets([gib(5)])).toEqual(["16"]);
  });

  test("the URL accepts only a bucket; an old exact-byte link means no filter", () => {
    expect(
      filtersFromParameters(new URLSearchParams("memory=64&disk=unknown&download=21474836480")),
    ).toMatchObject({ memory: "64", disk: "unknown", download: "" });
  });

  test("the Spark count reads as 'or fewer'", () => {
    expect(sparksFewerLabel("1")).toBe("1 Spark or fewer");
    expect(sparksFewerLabel("3")).toBe("3 Sparks or fewer");
  });
});

describe("public catalog Controller-parity filters", () => {
  test("parses the shared filter vocabulary and validates enumerated values", () => {
    const filters = filtersFromParameters(
      new URLSearchParams(
        "model_family=GLM+5.3+Flash&model=models%2Fboth-v1&abliterated=true&creator=owner&quantization=NVFP4&updated=30&sparks=4%2B&serves=tools&serves=thinking&serves=tools&download=64&disk=unknown&memory=200&sort=memory&direction=desc",
      ),
    );
    expect(filters).toMatchObject({
      modelFamily: "GLM 5.3 Flash",
      model: "models/both-v1",
      abliterated: "true",
      sourceOwner: "owner",
      quantization: "NVFP4",
      updated: "30",
      sparks: "4+",
      serves: ["tools", "thinking"],
      download: "64",
      disk: "unknown",
      memory: "",
      sort: "memory",
      direction: "desc",
    });
    expect(
      filtersFromParameters(new URLSearchParams("abliterated=unknown&sort=bogus")).abliterated,
    ).toBe("");
    expect(filtersFromParameters(new URLSearchParams("type=code")).type).toBe("code");
    expect(
      filtersFromParameters(new URLSearchParams("serves=in_image&serves=json&serves=json")).serves,
    ).toEqual(["in_image", "json"]);
  });

  test("requires every selected served fact and combines model, readiness, and Spark facets", () => {
    const both = recipe("both", { served: ["tools", "thinking"], node_count: 4 });
    const chat = recipe("chat", { served: ["tools"], node_count: 4 });
    const filters = {
      ...EMPTY_FILTERS,
      model: "models/both",
      quantization: "NVFP4",
      updated: "30" as const,
      sparks: "4+" as const,
      readiness: "executable" as const,
      serves: ["tools", "thinking"],
    };
    expect(recipeMatches(both, filters)).toBe(true);
    expect(recipeMatches(chat, filters)).toBe(false);
  });

  test("the model parameter matches every variant of a model", () => {
    const base = recipe("base");
    const variant = recipe("variant", {
      model_slug: "base",
      model_version_slug: "base-q4",
      model_version_title: "base q4",
    });
    const filters = { ...EMPTY_FILTERS, model: "models/base" };
    expect(recipeMatches(base, filters)).toBe(true);
    expect(recipeMatches(variant, filters)).toBe(true);
    expect(recipeMatches(recipe("other"), filters)).toBe(false);
  });

  test("Verified on Spark is on by default and off with verified=0 or an explicit qualification", () => {
    const unverified = recipe("unverified", { qualification: "Not yet verified" });
    expect(filtersFromParameters(new URLSearchParams("")).verified).toBe(true);
    expect(filtersFromParameters(new URLSearchParams("verified=0")).verified).toBe(false);
    expect(filtersFromParameters(new URLSearchParams("qualification=Fix+to+verify")).verified).toBe(
      false,
    );
    expect(recipeMatches(unverified, EMPTY_FILTERS)).toBe(false);
    expect(recipeMatches(unverified, { ...EMPTY_FILTERS, verified: false })).toBe(true);
  });

  test("a served-fact filter reads what the launch serves, not the model's capabilities", () => {
    const textOnly = recipe("text-only", {
      capabilities: ["chat", "image-understanding"],
      served: ["in_text"],
    });
    const withImages = recipe("images", { served: ["in_text", "in_image"] });
    const filters = { ...EMPTY_FILTERS, serves: ["in_image"] };
    expect(recipeMatches(textOnly, filters)).toBe(false);
    expect(recipeMatches(withImages, filters)).toBe(true);
  });

  test("a type matches a recipe with any of its capabilities", () => {
    const vision = recipe("vision", { capabilities: ["chat", "image-understanding"] });
    const chat = recipe("chat", { capabilities: ["chat"] });
    expect(recipeMatches(vision, { ...EMPTY_FILTERS, type: "vision" })).toBe(true);
    expect(recipeMatches(chat, { ...EMPTY_FILTERS, type: "vision" })).toBe(false);
    expect(recipeMatches(vision, { ...EMPTY_FILTERS, type: "language" })).toBe(true);
    expect(recipeMatches(chat, { ...EMPTY_FILTERS, type: "vision" }, "type")).toBe(true);
  });

  test("keeps standard and abliterated variants independently selectable", () => {
    const standard = recipe("standard", { alignment: "standard" });
    const abliterated = recipe("abliterated", { alignment: "abliterated" });
    expect(recipeMatches(standard, { ...EMPTY_FILTERS, abliterated: "false" })).toBe(true);
    expect(recipeMatches(abliterated, { ...EMPTY_FILTERS, abliterated: "false" })).toBe(false);
  });

  test("sorts by the table's columns in both directions; the Sort choices are exactly those", () => {
    const large = recipe("zeta", { node_count: 4 });
    const small = recipe("alpha", { node_count: 1 });
    expect(sortRecipes([large, small], "sparks").map((item) => item.slug)).toEqual([
      "alpha",
      "zeta",
    ]);
    expect(sortRecipes([large, small], "sparks", "desc").map((item) => item.slug)).toEqual([
      "zeta",
      "alpha",
    ]);
    expect(SORT_CHOICES.map((choice) => choice.value)).toEqual([
      "catalog:desc",
      "recipe:asc",
      "recipe:desc",
      "sparks:asc",
      "sparks:desc",
      "memory:asc",
      "memory:desc",
      "runtime:asc",
      "runtime:desc",
      "qualification:asc",
      "qualification:desc",
    ]);
    expect(filtersFromParameters(new URLSearchParams("sort=creator")).sort).toBe("catalog");
  });
});
