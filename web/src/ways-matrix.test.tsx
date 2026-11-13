import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";

import { catalogFacts } from "./vocabulary.fixture";
import type { StatsRecipe } from "./catalog-stats";
import { WaysMatrix } from "./ways-matrix";

function recipe(slug: string, owner: string | null, nodes: number, status: string, family = "GLM", evidence = false): StatsRecipe {
  return {
    publisher: "vonk-forge", slug, title: slug, official: true, content_sha256: slug.padEnd(64, "0"), published_at: "2026-11-01", runtime: { adapter: "vllm" },
    evidence: evidence ? { tested_at: "2026-11-01T00:00:00Z" } : null,
    catalog: catalogFacts({ description: "", tags: [], model_publisher: "m", model_slug: slug, model_title: slug, model_version_publisher: "m", model_version_slug: slug, model_version_title: slug, model_family: family, source_owner: owner, source_repository: null, alignment: "standard", capabilities: [], qualification: status, qualification_reason: null, execution_readiness: "executable", runtime_distribution: "vllm", precision: null, quantizations: [], node_count: nodes, expected_download_bytes: 0 }),
  };
}

const recipes = [
  recipe("mia-two", "MiaAI-Lab", 2, "Working"), recipe("mia-one", "MiaAI-Lab", 1, "Working"), recipe("mia-four", "miaai-lab", 4, "Not yet verified"),
  recipe("eugr-one", "eugr", 1, "Re-check: worked before", "GLM", true), recipe("anon", null, 1, "Not yet verified"),
  recipe("qwen-other-family", "eugr", 1, "Working", "Qwen"),
];

test("creators are rows (most recipes first), Spark counts are columns, and each chip names its status", () => {
  render(<WaysMatrix recipes={recipes} family="GLM" current={{ publisher: "vonk-forge", slug: "mia-two" }} />);
  expect(screen.getByRole("heading", { name: "Every way to run GLM: 5 recipes from 3 creators" })).toBeVisible();
  const table = screen.getByRole("table");
  expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Creator", "1 Spark", "2 Sparks", "4 Sparks"]);
  expect(within(table).getAllByRole("rowheader").map((cell) => cell.textContent)).toEqual(["MiaAI-Lab", "eugr", "Creator not named"]);
  expect(within(table).getByRole("link", { name: "mia-two · vLLM, Working" })).toHaveAttribute("aria-current", "page");
  expect(within(table).getByRole("link", { name: "eugr-one · vLLM, Re-check: worked before" })).not.toHaveAttribute("aria-current");
  expect(within(table).queryByRole("link", { name: /qwen-other-family/ })).toBeNull();
});

test("a family with one recipe draws no matrix", () => {
  const { container } = render(<WaysMatrix recipes={recipes} family="Qwen" />);
  expect(container).toBeEmptyDOMElement();
});
