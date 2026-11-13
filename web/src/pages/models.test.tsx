import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { ModelPage, ModelSummary } from "../api/client";
import { typesOf } from "../vocabulary";
import { vocabularyFixture } from "../vocabulary.fixture";
import { ModelDetailPage, ModelsPage } from "./models";

const { getModel, getVocabulary, listModels, loadRecipeCatalog } = vi.hoisted(() => ({ getModel: vi.fn(), getVocabulary: vi.fn(), listModels: vi.fn<() => Promise<ModelPage>>(), loadRecipeCatalog: vi.fn() }));

vi.mock("../api/client", () => ({
  getModel,
  getVocabulary,
  listModels,
  loadRecipeCatalog,
}));

beforeEach(() => {
  getVocabulary.mockResolvedValue(vocabularyFixture);
  loadRecipeCatalog.mockResolvedValue([]);
});

function model(number: number, publisher = "publisher"): ModelSummary {
  const runs = number % 2 ? { spark_counts: [1], engines: ["vllm"], creators: ["eugr"] } : { spark_counts: [2, 4], engines: ["sglang"], creators: [] };
  return {
    publisher,
    slug: `model-${number}`,
    title: `Model ${number}`,
    description: "Published model",
    family: number % 2 ? "Qwen" : "GLM",
    runs,
    verified_runs: runs,
    verified_recipe_count: number % 2,
    tags: [],
    types: typesOf(vocabularyFixture, [number % 2 ? "ocr" : "chat"]),
    revision_id: String(number).padStart(64, "0"),
    recipe_count: number % 2,
    versions: [{
      publisher,
      slug: `model-${number}-v1`,
      title: `Model ${number} v1`,
      version: "1",
      revision_id: String(number).padStart(64, "0"),
      model_slug: `model-${number}`,
      variant: "bf16",
      requires_token: false,
      capabilities: [number % 2 ? "ocr" : "chat"],
      recipe_slugs: number % 2 ? [`${publisher}/recipe-${number}`] : [],
    }],
  };
}

describe("public model browse", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/models");
    listModels.mockResolvedValue({ items: Array.from({ length: 13 }, (_, index) => model(index + 1)) });
  });

  test("Models is a tab of the catalog, next to Recipes", () => {
    render(<ModelsPage />);
    const tabs = within(screen.getByRole("navigation", { name: "Catalog views" }));
    expect(tabs.getByRole("link", { name: "Models" })).toHaveAttribute("aria-current", "page");
    expect(tabs.getByRole("link", { name: "Recipes" })).toHaveAttribute("href", "/recipes");
  });

  test("paginates the model index and persists filters in the URL", async () => {
    render(<ModelsPage />);
    await waitFor(() => expect(screen.getByText("13 of 13 models")).toBeVisible());
    expect(document.querySelectorAll(".model-list > li")).toHaveLength(12);
    expect(within(screen.getByRole("list", { name: "Models" })).getAllByRole("listitem")).toHaveLength(12);
    // Facts line up in the same three columns on every row; access is only
    // mentioned when a token is required, and a lone version reads as itself.
    for (const row of document.querySelectorAll(".model-row-facts")) {
      expect(Array.from(row.querySelectorAll("small"), (cell) => cell.textContent)).toEqual(["Runs on", "Engines", "Version"]);
    }
    expect(screen.queryByText("Public access")).not.toBeInTheDocument();
    expect(screen.queryByText("Token required")).not.toBeInTheDocument();
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Family · Qwen").length).toBeGreaterThan(0);

    expect(screen.queryByText("Published model")).not.toBeInTheDocument();
    expect(screen.queryByText(/000000000000/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /View versions/ })[0]).toHaveAttribute("href", "/models/publisher/model-1");
    fireEvent.click(screen.getByText("How global availability becomes a local run"));
    expect(screen.getByRole("heading", { name: "Pick a model. Choose how to run it." })).toBeVisible();
    expect(screen.getByText(/One exact model can have several recipes/)).toBeVisible();
    expect(screen.getByRole("heading", { name: "Available globally" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Prepared locally" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Run on Sparks" })).toBeVisible();
    expect(screen.getByText(/Model files downloaded and verified on your NAS/i)).toBeVisible();
    expect(screen.getByText(/container image—the software needed to run the model—has been downloaded or built and cached on your NAS/i)).toBeVisible();
    expect(screen.getByText(/Local means cached on your NAS. Running starts when you choose Run. Recipe definitions stay in the global repository/i)).toBeVisible();
    expect(screen.getByText(/Profiles remember your model, recipe, and Spark assignments/i)).toBeVisible();
    fireEvent.change(screen.getByLabelText("Capability"), { target: { value: "ocr" } });
    expect(window.location.search).toBe("?capability=ocr");
    expect(screen.getByText("7 of 13 models")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(window.location.search).toBe("?verified=0");
    await waitFor(() => expect(screen.getByText("13 of 13 models")).toBeVisible());
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(window.location.search).toBe("?verified=0&page=2");
    await waitFor(() => expect(screen.getByText("Model 13")).toBeVisible());
  });

  test("a lone version reads as what it adds to the model's name, or as a count", async () => {
    listModels.mockResolvedValue({ items: [
      { ...model(1), title: "SkinTokens", versions: [{ ...model(1).versions[0]!, version: "SkinTokens / TokenRig" }] },
      { ...model(2), title: "Pixal3D", versions: [{ ...model(2).versions[0]!, version: "Pixal3D" }] },
      { ...model(3), versions: [model(3).versions[0]!, { ...model(3).versions[0]!, slug: "model-3-v2", version: "2" }] },
    ] });
    render(<ModelsPage />);
    await waitFor(() => expect(screen.getByText("3 of 3 models")).toBeVisible());
    expect(screen.getByText("TokenRig")).toBeVisible();
    expect(screen.getByText("1 version")).toBeVisible();
    expect(screen.getByText("2 versions")).toBeVisible();
  });

  test("starts from the visitor's setup: Spark count, family and engine narrow the list", async () => {
    render(<ModelsPage />);
    await waitFor(() => expect(screen.getByText("13 of 13 models")).toBeVisible());
    expect(screen.getByRole("group", { name: "How many Sparks do you have?" })).toBeVisible();
    const oneSpark = screen.getByRole("button", { name: "1 Spark: 7 models" });
    expect(oneSpark).toHaveAttribute("aria-pressed", "false");
    // A count means "that many Sparks or fewer", so every model with a recipe for two or fewer shows under 2.
    expect(screen.getByRole("button", { name: "2 Sparks: 13 models" })).toBeVisible();
    expect(screen.getByRole("button", { name: "3 Sparks: 13 models" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "4 or more: 13 models" })).toBeVisible();
    fireEvent.click(oneSpark);
    expect(window.location.search).toBe("?sparks=1");
    expect(screen.getByText("7 of 13 models")).toBeVisible();
    expect(oneSpark).toHaveAttribute("aria-pressed", "true");
    const families = screen.getByRole("group", { name: "Model family" });
    expect(within(families).getByRole("button", { name: "Qwen: 7" })).toBeVisible();
    expect(within(families).getByRole("button", { name: "GLM: 0" })).toBeDisabled();
    fireEvent.click(within(screen.getByRole("group", { name: "Engine" })).getByRole("button", { name: "vLLM: 7" }));
    expect(window.location.search).toBe("?engine=vllm&sparks=1");
    expect(screen.getAllByText("1 Spark").length).toBeGreaterThan(1);
    expect(screen.getAllByText("vLLM").length).toBeGreaterThan(1);
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(window.location.search).toBe("?verified=0");
  });

  test("offers recovery when the immutable index fails", async () => {
    listModels.mockRejectedValueOnce(new Error("offline"));
    render(<ModelsPage />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeVisible());
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
    expect(screen.queryByText("Loading models…")).not.toBeInTheDocument();
  });

  test("keeps the full source revision available on the model version detail", async () => {
    const sourceRevision = "a".repeat(40);
    const detail = model(1);
    detail.versions[0]!.source_revision = sourceRevision;
    getModel.mockResolvedValueOnce(detail);
    render(<ModelDetailPage publisher="publisher" slug="model-1" />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Model 1" })).toBeVisible());
    const sourceCode = screen.getByLabelText(`Source revision ${sourceRevision}`);
    expect(sourceCode).toHaveTextContent("aaaaaaaa…");
    expect(sourceCode).toHaveAttribute("title", sourceRevision);
  });
});

describe("type-first model filtering", () => {
  const verifiedRuns = { spark_counts: [1], engines: ["vllm"], creators: ["NVIDIA"] };
  const none = { spark_counts: [], engines: [], creators: [] };
  function typed(slug: string, capabilities: string[], verified: boolean): ModelSummary {
    const base = model(1);
    return { ...base, slug, title: slug, types: typesOf(vocabularyFixture, capabilities), runs: verifiedRuns, verified_runs: verified ? verifiedRuns : none, versions: [{ ...base.versions[0]!, slug: `${slug}-v1`, capabilities, format: { quantization: "nvfp4" } }] };
  }

  beforeEach(() => {
    window.history.replaceState({}, "", "/models");
    listModels.mockResolvedValue({ items: [typed("coder", ["code-generation"], true), typed("painter", ["image-generation"], true), typed("untested-coder", ["code-generation"], false)] });
  });

  test("type chips come first, count with the other filters applied, and live in the URL", async () => {
    render(<ModelsPage />);
    const types = await screen.findByRole("group", { name: "Model type" });
    expect(within(types).getByRole("button", { name: "All: 2 models" })).toBeVisible();
    expect(within(types).getByRole("button", { name: "Code: 1 models" })).toBeVisible();
    fireEvent.click(within(types).getByRole("button", { name: "Code: 1 models" }));
    await waitFor(() => expect(window.location.search).toBe("?type=code"));
    expect(screen.getByText("1 of 3 models")).toBeVisible();
    expect(screen.getByRole("link", { name: /coder/ })).toBeVisible();
    expect(screen.queryByRole("link", { name: /painter/ })).not.toBeInTheDocument();
  });

  test("Verified on Spark is on by default and turning it off shows models without a verified recipe", async () => {
    render(<ModelsPage />);
    await screen.findByRole("group", { name: "Model type" });
    expect(screen.getByRole("checkbox", { name: /Verified on Spark/ })).toBeChecked();
    expect(screen.queryByRole("link", { name: /untested-coder/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /Verified on Spark/ }));
    await waitFor(() => expect(window.location.search).toBe("?verified=0"));
    expect(screen.getByRole("link", { name: /untested-coder/ })).toBeVisible();
  });

  test("with Verified on, the recipe count, support filter and Most recipes sort count verified recipes only", async () => {
    const alpha = { ...typed("alpha", ["chat"], true), title: "Alpha", recipe_count: 5, verified_recipe_count: 1 };
    const beta = { ...typed("beta", ["chat"], true), title: "Beta", recipe_count: 3, verified_recipe_count: 2 };
    const gamma = { ...typed("gamma", ["chat"], true), title: "Gamma", recipe_count: 4, verified_recipe_count: 0 };
    listModels.mockResolvedValue({ items: [alpha, beta, gamma] });
    render(<ModelsPage />);
    await screen.findByRole("group", { name: "Model type" });
    fireEvent.change(screen.getByLabelText("Sort"), { target: { value: "recipes" } });
    const rows = () => within(screen.getByRole("list", { name: "Models" })).getAllByRole("listitem").map((row) => row.textContent);
    await waitFor(() => expect(rows()[0]).toContain("Beta"));
    expect(rows()[0]).toContain("2 verified recipes");
    expect(rows()[1]).toContain("1 verified recipe");
    fireEvent.change(screen.getByLabelText("Recipe support"), { target: { value: "recipes" } });
    await waitFor(() => expect(rows()).toHaveLength(2));
    // "No public recipes" can only match with Verified off, so choosing it turns the default off.
    fireEvent.change(screen.getByLabelText("Recipe support"), { target: { value: "none" } });
    await waitFor(() => expect(screen.getByRole("checkbox", { name: /Verified on Spark/ })).not.toBeChecked());
    expect(window.location.search).toBe("?verified=0&recipes=none&sort=recipes");
    fireEvent.change(screen.getByLabelText("Recipe support"), { target: { value: "" } });
    await waitFor(() => expect(rows()[0]).toContain("Alpha"));
    expect(rows()[0]).toContain("5 recipes");
  });

  test("Clear filters has one rule: hidden while only the default applies, and it also turns the default off", async () => {
    render(<ModelsPage />);
    await screen.findByRole("group", { name: "Model type" });
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("group", { name: "Model type" })).getByRole("button", { name: "Code: 1 models" }));
    await waitFor(() => expect(window.location.search).toBe("?type=code"));
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(window.location.search).toBe("?verified=0"));
    expect(screen.getByRole("checkbox", { name: /Verified on Spark/ })).not.toBeChecked();
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
  });
});
