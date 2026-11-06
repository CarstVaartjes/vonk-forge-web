import { render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { RecipeSummary } from "../api/client";
import { LIGHT_CODER, SHOWCASE_PROFILES, SHOWCASE_PUBLISHER } from "../showcase-profiles";
import { ShowcasePage } from "./showcase";

const { loadRecipeCatalog } = vi.hoisted(() => ({ loadRecipeCatalog: vi.fn() }));
vi.mock("../api/client", () => ({ loadRecipeCatalog }));

const slugs = [...new Set(SHOWCASE_PROFILES.flatMap((profile) => profile.members.map((member) => member.slug)))];


function recipe(slug: string): RecipeSummary {
  return {
    publisher: SHOWCASE_PUBLISHER, slug, title: `Title ${slug}`, official: true, content_sha256: "a".repeat(64),
    published_at: "2026-08-07T10:00:00Z", runtime: {}, capacity: { maximum_runtime_memory_bytes_per_node: 48 * 1024 ** 3 },
    catalog: { qualification: "Working" } as RecipeSummary["catalog"],
  };
}

describe("example setup showcase", () => {
  beforeEach(() => loadRecipeCatalog.mockReset().mockResolvedValue(slugs.map(recipe)));

  test("the light coder is always in the left column and shares the coder role", () => {
    for (const profile of SHOWCASE_PROFILES) {
      for (const member of profile.members.filter((item) => item.slug === LIGHT_CODER)) {
        expect(member.column).toBe("left");
        expect(member.role).toBe("coder");
      }
    }
  });

  test("renders catalog titles, links, status and role labels", async () => {
    render(<ShowcasePage />);
    const card = screen.getByRole("region", { name: "Controllable 3D" });
    await waitFor(() => expect(within(card).getByRole("link", { name: `Title ${LIGHT_CODER}` })).toHaveAttribute("href", `/recipes/vonk-forge/${LIGHT_CODER}`));
    expect(within(card).getAllByText("Coder")).toHaveLength(1);
    expect(within(card).getAllByText("3D")).toHaveLength(2);
    expect(within(card).getAllByText("Working · 48 GiB per Spark").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Example: a 3D game generation setup on two Sparks");
  });

  test("a slug missing from the catalog renders an honest fallback", async () => {
    loadRecipeCatalog.mockResolvedValue(slugs.filter((slug) => slug !== "wan-2-2-i2v-14b-comfyui-single").map(recipe));
    render(<ShowcasePage />);
    const card = screen.getByRole("region", { name: "Trailer & cutscenes" });
    await waitFor(() => expect(within(card).getByRole("link")).toBeVisible());
    expect(within(card).getByText("wan-2-2-i2v-14b-comfyui-single")).toBeVisible();
    expect(within(card).getByText("Not in the published catalog right now.")).toBeVisible();
  });

  test("shows a loading state until the catalog arrives", async () => {
    loadRecipeCatalog.mockReturnValue(new Promise(() => undefined));
    render(<ShowcasePage />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading the public recipe index");
    expect(screen.queryByText("Not in the published catalog right now.")).not.toBeInTheDocument();
  });

  test("a failed catalog load does not claim the recipes are absent", async () => {
    loadRecipeCatalog.mockRejectedValue(new Error("index unreachable"));
    render(<ShowcasePage />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("index unreachable"));
    expect(screen.queryByText("Not in the published catalog right now.")).not.toBeInTheDocument();
  });
});
