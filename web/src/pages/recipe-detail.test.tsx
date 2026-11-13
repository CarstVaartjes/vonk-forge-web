import { fireEvent, render, screen, within } from "@testing-library/react";

import type { RecipeDetail } from "../api/client";
import { RecipeDetailPage } from "./recipe-detail";
import { catalogFacts, vocabularyFixture } from "../vocabulary.fixture";


const { getRecipe, getVocabulary, loadRecipeCatalog } = vi.hoisted(() => ({ getRecipe: vi.fn(), getVocabulary: vi.fn(), loadRecipeCatalog: vi.fn() }));
vi.mock("../api/client", () => ({ getRecipe, getVocabulary, loadRecipeCatalog }));

function recipe(publisher: string, sourceRepository: string, sourceOwner: string): RecipeDetail {
  return {
    publisher, slug: "qwen-fast", title: "Qwen Fast", official: publisher === "vonk-forge", content_sha256: "a".repeat(64), published_at: "2026-08-07", version: "1.0.0", runtime: { adapter: "vllm" },
    facts: { source_bundle_observed: true },
    catalog: catalogFacts({ description: "A recipe.", tags: [], model_publisher: "m", model_slug: "qwen", model_title: "Qwen", model_version_publisher: "m", model_version_slug: "qwen", model_version_title: "Qwen", model_family: "Qwen", source_owner: sourceOwner, source_repository: sourceRepository, alignment: "standard", capabilities: [], qualification: "Not yet verified", qualification_reason: null, execution_readiness: "executable", runtime_distribution: "vllm", precision: null, quantizations: [], node_count: 1, expected_download_bytes: 0 }),
    evidence: null, served_names: [], credits: [], settings: {}, license: {},
    latest_revision: { content_sha256: "a".repeat(64), document: {} },
  };
}

afterEach(() => vi.restoreAllMocks());

beforeEach(() => {
  getVocabulary.mockResolvedValue(vocabularyFixture);
  loadRecipeCatalog.mockResolvedValue([]);
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

const GIB = 1024 ** 3;

test("a verified recipe shows its receipt and the model across its Sparks, measured and declared", async () => {
  const verified: RecipeDetail = {
    ...recipe("vonk-forge", "https://github.com/acme/qwen-fast", "acme"),
    evidence: { tested_at: "2026-11-04T08:00:00Z", spark_count: 2, hardware_class: "GB10", evidence_ref: "e".repeat(64), image_digest: `sha256:${"f".repeat(64)}` },
    capacity: { maximum_runtime_memory_bytes_per_node: 100 * GIB, measured_memory_bytes_per_node: 110 * GIB },
    served_names: ["qwen-fast"], credits: ["Acme", "Qwen", "vLLM", "NVIDIA"], settings: { context_tokens: 262144, concurrency: 4 },
  };
  verified.catalog = { ...verified.catalog, qualification: "Working", verified: true, node_count: 2 };
  getRecipe.mockResolvedValue(verified);
  render(<RecipeDetailPage publisher="vonk-forge" slug="qwen-fast" />);
  const receipt = within(await screen.findByLabelText("Hardware evidence"));
  expect(receipt.getByText("Passed hardware checks on 2 DGX Sparks, 4 Nov 2026.")).toBeVisible();
  expect(receipt.getByText("110.0 GiB per Spark, measured")).toBeVisible();
  const needs = within(screen.getByRole("region", { name: "What it needs" }));
  expect(needs.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual(["Spark 1", "Spark 2"]);
  expect(needs.getAllByText("Declared")).toHaveLength(2);
  expect(needs.getByText("262,144")).toBeVisible();
  const can = within(screen.getByRole("region", { name: "What it can do" }));
  expect(can.getByText("qwen-fast")).toBeVisible();
  expect(can.getByText("Acme, Qwen, vLLM and 1 more")).toBeVisible();
  expect(can.getByText("Shown for information. Use is your call.")).toBeVisible();
});

test("a recipe without a pass shows the status meaning, no receipt and no measured word", async () => {
  getRecipe.mockResolvedValue({ ...recipe("vonk-forge", "https://github.com/acme/qwen-fast", "acme"), capacity: { maximum_runtime_memory_bytes_per_node: 100 * GIB } });
  render(<RecipeDetailPage publisher="vonk-forge" slug="qwen-fast" />);
  const status = within(await screen.findByLabelText("Hardware status"));
  expect(status.getByText("Not yet verified")).toBeVisible();
  expect(status.getByText(/No hardware verdict yet/)).toBeVisible();
  expect(screen.queryByLabelText("Hardware evidence")).toBeNull();
  expect(screen.getByRole("region", { name: "What it needs" }).textContent).not.toContain("easured");
});

// jsdom does no layout: stand in for a description the clamp cuts (scrollHeight above clientHeight) or not.
function layout(scrollHeight: number, clientHeight: number) {
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(scrollHeight);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(clientHeight);
}

test("a description the clamp cuts is clamped until Read all", async () => {
  layout(200, 100);
  getRecipe.mockResolvedValue(recipe("vonk-forge", "https://github.com/acme/qwen-fast", "acme"));
  render(<RecipeDetailPage publisher="vonk-forge" slug="qwen-fast" />);
  const button = await screen.findByRole("button", { name: "Read all" });
  expect(screen.getByText("A recipe.")).toHaveClass("clamped");
  fireEvent.click(button);
  expect(screen.getByText("A recipe.")).not.toHaveClass("clamped");
  expect(screen.getByRole("button", { name: "Show less" })).toHaveAttribute("aria-expanded", "true");
});

test("a short description has no Read all", async () => {
  layout(100, 100);
  getRecipe.mockResolvedValue(recipe("vonk-forge", "https://github.com/acme/qwen-fast", "acme"));
  render(<RecipeDetailPage publisher="vonk-forge" slug="qwen-fast" />);
  await screen.findByText("A recipe.");
  expect(screen.queryByRole("button", { name: /Read all|Show less/ })).toBeNull();
});

test("the family matrix lists the other recipes and marks this one", async () => {
  const mine = recipe("vonk-forge", "https://github.com/acme/qwen-fast", "acme");
  const other = { ...recipe("vonk-forge", "https://github.com/acme/qwen-slow", "acme"), slug: "qwen-slow", title: "Qwen Slow" };
  getRecipe.mockResolvedValue(mine);
  loadRecipeCatalog.mockResolvedValue([mine, other]);
  render(<RecipeDetailPage publisher="vonk-forge" slug="qwen-fast" />);
  const ways = within(await screen.findByRole("region", { name: "Every way to run Qwen: 2 recipes from 1 creator" }));
  expect(ways.getByRole("link", { name: /^Qwen Fast/ })).toHaveAttribute("aria-current", "page");
  expect(ways.getByRole("link", { name: /^Qwen Slow/ })).toHaveAttribute("href", "/recipes/vonk-forge/qwen-slow");
});
