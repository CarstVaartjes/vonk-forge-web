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

  test("paginates the family index and persists filters in the URL", async () => {
    render(<ModelsPage />);
    await waitFor(() => expect(screen.getByText("13 of 13 model families")).toBeVisible());
    expect(screen.getAllByRole("article")).toHaveLength(12);
    fireEvent.change(screen.getByLabelText("Capability"), { target: { value: "ocr" } });
    expect(window.location.search).toBe("?capability=ocr");
    expect(screen.getByText("7 of 13 model families")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(window.location.search).toBe("");
    await waitFor(() => expect(screen.getByText("13 of 13 model families")).toBeVisible());
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
