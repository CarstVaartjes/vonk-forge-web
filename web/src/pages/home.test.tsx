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
    const proof = await screen.findByLabelText("Catalog counts");
    await waitFor(() => expect(proof.textContent).toBe("2 recipes verified on DGX Spark2 model families1 creators"));
    expect(screen.getByText(/Vonk Forge is the open-source Controller for NVIDIA DGX Spark/)).toBeVisible();
    expect(screen.getByText(/Recipes from nvidia and more/i)).toBeVisible();
    expect(screen.getByRole("link", { name: "See the agent-friendly CLI" })).toHaveAttribute("href", "/control#local-cli");
    expect(loadRecipeCatalog).not.toHaveBeenCalled();
    expect(listModels).not.toHaveBeenCalled();
    const tiles = within(screen.getByRole("region", { name: "What can you run?" }));
    expect(tiles.getByRole("link", { name: /Language\s*1 verified/ })).toHaveAttribute("href", "/recipes?type=language");
    expect(tiles.getByRole("link", { name: /Code\s*1 verified/ })).toBeVisible();
    expect(tiles.getByRole("link", { name: /3D\s*None verified yet/ })).toHaveAttribute("href", "/recipes?type=3d&verified=0");
  });

  test("the type tiles start with All verified and carry a decorative icon, so the link name is the text", async () => {
    getCatalogSummary.mockResolvedValue(summary());
    render(<HomePage />);
    const tiles = within(await screen.findByRole("region", { name: "What can you run?" }));
    expect(tiles.getByRole("link", { name: /All verified\s*2 recipes/ })).toHaveAttribute("href", "/recipes");
    for (const link of tiles.getAllByRole("link")) expect(link.querySelector("svg.type-icon")).toHaveAttribute("aria-hidden", "true");
  });

  test("shows the two install commands, each with a Copy button", async () => {
    getCatalogSummary.mockResolvedValue(summary());
    render(<HomePage />);
    const quickstart = within(await screen.findByRole("region", { name: /Start on the computer/ }));
    expect(quickstart.getByText("curl -fsSL https://install.vonkforge.ai/nas | sh")).toBeVisible();
    expect(quickstart.getByText(/install\.vonkforge\.ai\/spark \| VONK_CONTROLLER_ADDRESS=/)).toBeVisible();
    expect(quickstart.getAllByRole("button", { name: "Copy" })).toHaveLength(2);
  });

  test("shows no numbers and an alert when the summary is missing or malformed", async () => {
    getCatalogSummary.mockRejectedValue(new Error("unsupported"));
    render(<HomePage />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("The recipe library could not be read."));
    expect(document.querySelector(".rolling-number")).toBeNull();
    expect(screen.queryByRole("region", { name: "What can you run?" })).toBeNull();
  });
});
