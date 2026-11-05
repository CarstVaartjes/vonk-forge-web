import { render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { ModelPage, ModelSummary, RecipeSummary } from "../api/client";
import { HomePage } from "./home";

const { listModels, loadRecipeCatalog } = vi.hoisted(() => ({
  listModels: vi.fn<() => Promise<ModelPage>>(),
  loadRecipeCatalog: vi.fn<() => Promise<RecipeSummary[]>>(),
}));

vi.mock("../api/client", () => ({ listModels, loadRecipeCatalog }));

function recipe(slug: string, owner: string, status: string, capabilities: string[]): RecipeSummary {
  return {
    publisher: "vonk-forge", slug, title: slug, official: true, content_sha256: slug.padEnd(64, "0"), published_at: "2026-01-01", runtime: {},
    catalog: { description: "", tags: [], model_publisher: "m", model_slug: slug, model_title: slug, model_version_publisher: "m", model_version_slug: slug, model_version_title: slug, model_family: slug, source_owner: owner, source_repository: null, alignment: "standard", capabilities, qualification: status, qualification_reason: null, execution_readiness: "executable", runtime_distribution: "vllm", precision: null, quantizations: [], node_count: 1, expected_download_bytes: 0 },
  };
}

const model = (slug: string, family: string): ModelSummary => ({ publisher: "p", slug, title: slug, description: "", family, runs: { spark_counts: [], engines: [], creators: [] }, tags: [], revision_id: "r", versions: [], recipe_count: 0 });

beforeEach(() => {
  loadRecipeCatalog.mockReset();
  listModels.mockReset();
});

describe("home page", () => {
  test("the hero markup carries the true numbers derived from the catalog", async () => {
    loadRecipeCatalog.mockResolvedValue([
      recipe("a", "NVIDIA", "Working", ["chat"]), recipe("b", "nvidia", "Working", ["code-generation"]),
      recipe("d", "NVIDIA", "Not yet verified", ["chat"]), recipe("c", "eugr", "Not yet verified", ["chat"]),
    ]);
    listModels.mockResolvedValue({ items: [model("x", "Qwen"), model("y", "GLM"), model("z", "qwen")] });
    render(<HomePage />);
    const title = await screen.findByRole("heading", { level: 1, name: /recipes verified on DGX Spark/ });
    expect(title.textContent).toBe("2 recipes verified on DGX Spark.2 model families.2 creators.");
    expect(screen.getByText(/from NVIDIA and more/)).toBeVisible();
    const tiles = within(screen.getByRole("region", { name: "What can you run?" }));
    expect(tiles.getByRole("link", { name: /Language & chat\s*1 verified/ })).toHaveAttribute("href", "/recipes?type=language&qualification=Working");
    expect(tiles.getByRole("link", { name: /Code\s*1 verified/ })).toBeVisible();
    expect(tiles.getByRole("link", { name: /3D\s*None verified yet/ })).toHaveAttribute("href", "/recipes?type=3d");
  });

  test("shows no numbers and an alert when the catalog cannot be read", async () => {
    loadRecipeCatalog.mockRejectedValue(new Error("down"));
    listModels.mockRejectedValue(new Error("down"));
    render(<HomePage />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("The recipe library could not be read."));
    expect(document.querySelector(".rolling-number")).toBeNull();
    expect(screen.queryByRole("region", { name: "What can you run?" })).toBeNull();
  });
});
