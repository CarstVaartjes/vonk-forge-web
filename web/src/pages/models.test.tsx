import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { ModelPage, ModelSummary } from "../api/client";
import { ModelsPage } from "./models";

const { listModels } = vi.hoisted(() => ({ listModels: vi.fn<() => Promise<ModelPage>>() }));

vi.mock("../api/client", () => ({
  getModel: vi.fn(),
  listModels,
}));

function model(number: number, publisher = "publisher"): ModelSummary {
  return {
    publisher,
    slug: `model-${number}`,
    title: `Model ${number}`,
    description: "Published model",
    family: "family",
    tags: [],
    revision_id: String(number).padStart(64, "0"),
    recipe_count: number % 2,
    versions: [{
      publisher,
      slug: `model-${number}-v1`,
      title: `Model ${number} v1`,
      version: "1",
      revision_id: String(number).padStart(64, "0"),
      model_publisher: publisher,
      model_slug: `model-${number}`,
      model_title: `Model ${number}`,
      variant: "bf16",
      access: { visibility: "public", gated: false, authentication: "none" },
      tags: [],
      capabilities: [{ name: number % 2 ? "ocr" : "chat", support: "supported", evidence_status: "declared" }],
      capability_evidence: "declared",
      recipe_slugs: number % 2 ? [`${publisher}/recipe-${number}`] : [],
    }],
  };
}

describe("public model browse", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/models");
    listModels.mockResolvedValue({ items: Array.from({ length: 13 }, (_, index) => model(index + 1)) });
  });

  test("paginates the model index and persists filters in the URL", async () => {
    render(<ModelsPage />);
    await waitFor(() => expect(screen.getByText("13 of 13 models")).toBeVisible());
    expect(document.querySelectorAll(".model-list > article")).toHaveLength(12);
    expect(screen.getAllByText("Version").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Public access").length).toBeGreaterThan(0);
    expect(screen.queryByText("Published model")).not.toBeInTheDocument();
    expect(screen.queryByText(/000000000000/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("How a model becomes a local run"));
    expect(screen.getByRole("heading", { name: "A model is the AI. A recipe is how you run it." })).toBeVisible();
    expect(screen.getByText(/One exact model can have several recipes/)).toBeVisible();
    expect(screen.getByText(/view downloads, running models, and Spark status/i)).toBeVisible();
    fireEvent.change(screen.getByLabelText("Capability"), { target: { value: "ocr" } });
    expect(window.location.search).toBe("?capability=ocr");
    expect(screen.getByText("7 of 13 models")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(window.location.search).toBe("");
    await waitFor(() => expect(screen.getByText("13 of 13 models")).toBeVisible());
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(window.location.search).toBe("?page=2");
    await waitFor(() => expect(screen.getByRole("heading", { name: "Model 13" })).toBeVisible());
  });

  test("offers recovery when the immutable index fails", async () => {
    listModels.mockRejectedValueOnce(new Error("offline"));
    render(<ModelsPage />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeVisible());
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
  });
});
