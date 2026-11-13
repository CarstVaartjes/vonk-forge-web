import { render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { deriveCatalogStats } from "../catalog-stats";
import type { RecipeSummary } from "../api/client";
import { HomePage } from "./home";
import { catalogFacts, vocabularyFixture } from "../vocabulary.fixture";

const { getCatalogSummary, listModels, loadRecipeCatalog } = vi.hoisted(() => ({ getCatalogSummary: vi.fn(), listModels: vi.fn(), loadRecipeCatalog: vi.fn() }));

vi.mock("../api/client", () => ({ getCatalogSummary, listModels, loadRecipeCatalog }));

function recipe(slug: string, owner: string, status: string, capabilities: string[], family: string, updated = "2026-01-01"): RecipeSummary {
  return {
    publisher: "vonk-forge", slug, title: slug, official: true, content_sha256: slug.padEnd(64, "0"), published_at: updated, runtime: {},
    catalog: catalogFacts({ description: "", tags: [], model_publisher: "m", model_slug: slug, model_title: slug, model_version_publisher: "m", model_version_slug: slug, model_version_title: slug, model_family: family, source_owner: owner, source_repository: null, alignment: "standard", capabilities, qualification: status, qualification_reason: null, execution_readiness: "executable", runtime_distribution: "vllm", precision: null, quantizations: [], node_count: 1, expected_download_bytes: 0 }),
  };
}

const today = new Date().toISOString().slice(0, 10);
const summary = () => ({
  summary_version: 2, release: "v3.1.0", catalog_index_sha256: "a".repeat(64),
  ...deriveCatalogStats([
    recipe("a", "NVIDIA", "Working", ["chat"], "Qwen", today), recipe("b", "nvidia", "Working", ["code-generation"], "GLM"),
    recipe("d", "NVIDIA", "Not yet verified", ["chat"], "Hidden"), recipe("c", "eugr", "Not yet verified", ["chat"], "Hidden"),
  ], vocabularyFixture, `${today}T12:00:00Z`),
});

beforeEach(() => {
  getCatalogSummary.mockReset();
  loadRecipeCatalog.mockReset();
  listModels.mockReset();
});

describe("home page", () => {
  test("the hero carries the true numbers from the summary and never loads the catalog index", async () => {
    getCatalogSummary.mockResolvedValue(summary());
    render(<HomePage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Models that fit your Sparks, kept current.");
    await waitFor(() => expect(document.querySelector(".answer")?.textContent).toBe("2recipes verified on a real DGX Spark, out of 4 in the catalog."));
    expect(screen.queryByLabelText("Catalog counts")).toBeNull();
    expect(screen.getByText(/Vonk Forge is the open-source Controller for NVIDIA DGX Spark/)).toBeVisible();
    expect(screen.getByText(/Recipes from nvidia and more/i)).toBeVisible();
    expect(screen.getByRole("link", { name: "See the agent-friendly CLI" })).toHaveAttribute("href", "/control#local-cli");
    expect(loadRecipeCatalog).not.toHaveBeenCalled();
    expect(listModels).not.toHaveBeenCalled();
    const wall = await screen.findByRole("group", { name: /The recipe catalog/ });
    expect(within(wall).getAllByRole("link")).toHaveLength(4);
    expect(screen.queryByRole("region", { name: "What can you run?" })).toBeNull();
  });

  test("the creators ledger links each creator to their catalog and says how many more there are", async () => {
    getCatalogSummary.mockResolvedValue({ ...summary(), creators: 3 });
    render(<HomePage />);
    const ledger = within(await screen.findByRole("region", { name: /creators\. One catalog\./ }));
    expect(ledger.getByRole("link", { name: "NVIDIA" })).toHaveAttribute("href", "/recipes?creator=NVIDIA");
    expect(ledger.getByRole("meter", { name: "NVIDIA: verified recipes" })).toHaveAttribute("aria-valuenow", "2");
    expect(ledger.getByText(/^and 2 more creators/)).toBeVisible();
  });

  test("shows the two install commands, each with a Copy button", async () => {
    getCatalogSummary.mockResolvedValue(summary());
    render(<HomePage />);
    const quickstart = within(await screen.findByRole("region", { name: /Start on the computer/ }));
    expect(quickstart.getByText("curl -fsSL https://install.vonkforge.ai/nas | sh")).toBeVisible();
    expect(quickstart.getByText(/install\.vonkforge\.ai\/spark \| VONK_CONTROLLER_ADDRESS=/)).toBeVisible();
    expect(quickstart.getAllByRole("button", { name: "Copy" })).toHaveLength(2);
  });

  test("kept current and verified sections draw only summary facts, with no receipt when no recipe qualifies", async () => {
    getCatalogSummary.mockResolvedValue(summary());
    render(<HomePage />);
    const current = within(await screen.findByRole("region", { name: /New models and recipe revisions/ }));
    expect(current.getByRole("group", { name: /^Recipes released per week: 1 recipe,/ })).toBeVisible();
    expect(current.getAllByRole("listitem").map((item) => item.querySelector("a")?.textContent)).toEqual(["a", "b"]);
    const proof = within(screen.getByRole("region", { name: /Ran, on a real DGX Spark/ }));
    expect(proof.getByText("Passed on a real DGX Spark for this exact recipe, runtime image and model.")).toBeVisible();
    expect(proof.getByRole("table", { name: "Most recent hardware pass per recipe, by day, last 28 days" })).toBeInTheDocument();
    expect(proof.queryByLabelText("Hardware evidence")).toBeNull();
  });

  test("a release with nothing verified shows the empty state and no wall", async () => {
    getCatalogSummary.mockResolvedValue({ ...summary(), verified: 0 });
    render(<HomePage />);
    expect(await screen.findByText(/No recipe in this release has passed hardware checks/)).toBeVisible();
    expect(screen.queryByRole("group", { name: /The recipe catalog/ })).toBeNull();
    expect(screen.queryByRole("region", { name: /Ran, on a real DGX Spark/ })).toBeNull();
  });

  test("shows no numbers and an alert when the summary is missing or malformed", async () => {
    getCatalogSummary.mockRejectedValue(new Error("unsupported"));
    render(<HomePage />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("The recipe library could not be read."));
    expect(document.querySelector(".rolling-number")).toBeNull();
    expect(screen.queryByRole("group", { name: /The recipe catalog/ })).toBeNull();
  });
});
