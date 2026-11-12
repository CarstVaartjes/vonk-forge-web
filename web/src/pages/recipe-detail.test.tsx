import { render, screen } from "@testing-library/react";

import type { RecipeDetail } from "../api/client";
import { RecipeDetailPage } from "./recipe-detail";
import { catalogFacts, vocabularyFixture } from "../vocabulary.fixture";


const { getRecipe, getVocabulary } = vi.hoisted(() => ({ getRecipe: vi.fn(), getVocabulary: vi.fn() }));
vi.mock("../api/client", () => ({ getRecipe, getVocabulary }));

function recipe(publisher: string, sourceRepository: string, sourceOwner: string): RecipeDetail {
  return {
    publisher, slug: "qwen-fast", title: "Qwen Fast", official: publisher === "vonk-forge", content_sha256: "a".repeat(64), published_at: "2026-08-07", version: "1.0.0", runtime: { adapter: "vllm" },
    facts: { source_bundle_observed: true },
    catalog: catalogFacts({ description: "A recipe.", tags: [], model_publisher: "m", model_slug: "qwen", model_title: "Qwen", model_version_publisher: "m", model_version_slug: "qwen", model_version_title: "Qwen", model_family: "Qwen", source_owner: sourceOwner, source_repository: sourceRepository, alignment: "standard", capabilities: [], qualification: "Not yet verified", qualification_reason: null, execution_readiness: "executable", runtime_distribution: "vllm", precision: null, quantizations: [], node_count: 1, expected_download_bytes: 0 }),
    evidence: null, settings: {}, license: {},
    latest_revision: { content_sha256: "a".repeat(64), document: {} },
  };
}

beforeEach(() => {
  getVocabulary.mockResolvedValue(vocabularyFixture);
});

test("a community recipe is not tagged official, and the creator links to the host the source lives on", async () => {
  getRecipe.mockResolvedValue(recipe("someone", "https://huggingface.co/someone/qwen-fast", "someone"));
  render(<RecipeDetailPage publisher="someone" slug="qwen-fast" />);
  expect(await screen.findByRole("link", { name: "someone" })).toHaveAttribute("href", "https://huggingface.co/someone/qwen-fast");
  expect(screen.getByText("Community recipe")).not.toHaveClass("official");
});

test("the evidence line names the Spark count only when the library recorded one", async () => {
  const verified = { ...recipe("vonk-forge", "https://github.com/acme/qwen-fast", "acme"), evidence: { tested_at: "2026-11-04T08:00:00Z" } };
  verified.catalog = { ...verified.catalog, qualification: "Working", verified: true };
  getRecipe.mockResolvedValue(verified);
  render(<RecipeDetailPage publisher="vonk-forge" slug="qwen-fast" />);
  expect(await screen.findByText(/Passed hardware checks, 4 Nov 2026\./)).toBeVisible();
});

test("an official recipe carries the official tag", async () => {
  getRecipe.mockResolvedValue(recipe("vonk-forge", "https://github.com/acme/qwen-fast", "acme"));
  render(<RecipeDetailPage publisher="vonk-forge" slug="qwen-fast" />);
  expect(await screen.findByText("Official recipe")).toHaveClass("official");
});
