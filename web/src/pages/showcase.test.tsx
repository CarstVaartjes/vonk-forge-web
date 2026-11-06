import { render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { RecipeSummary } from "../api/client";
import { LIGHT_CODER, SHOWCASE_PROFILES, SHOWCASE_PUBLISHER } from "../showcase-profiles";
import { ShowcasePage } from "./showcase";

const { loadRecipeCatalog } = vi.hoisted(() => ({ loadRecipeCatalog: vi.fn() }));
vi.mock("../api/client", () => ({ loadRecipeCatalog }));

const slugs = [...new Set(SHOWCASE_PROFILES.flatMap((profile) => profile.members.map((member) => member.slug)))];

// The test catalog lists every slug the showcase names.
const FIXTURE_SLUGS = [
  "glm-5-3-flash-exl3-dflash2-tensorfold-mia-dual",
  "deepseek-v4-1-flash-1017-mia-tensorfold-dual",
  "qwen3-8-27b-exl3-dflash2-mia-single",
  "flux-2-klein-4b-nvfp4-comfyui-single",
  "qwen-image-edit-2511-fp8mixed-comfyui-single",
  "trellis-2-4b-pytorch-single",
  "step1x-3d-texture-pytorch-single",
  "hunyuan3d-omni-pytorch-single",
  "minimax-music3-drowzeys-tensorfold-single",
  "hunyuan-video-foley-xxl-pytorch-single",
  "fasth3-8step-v2-drowzeys-tensorfold-single",
  "wan-2-2-i2v-14b-comfyui-single",
];

function recipe(slug: string): RecipeSummary {
  return {
    publisher: SHOWCASE_PUBLISHER, slug, title: `Title ${slug}`, official: true, content_sha256: "a".repeat(64),
    published_at: "2026-08-07T10:00:00Z", runtime: {}, capacity: { maximum_runtime_memory_bytes_per_node: 48 * 1024 ** 3 },
    catalog: { qualification: "Working" } as RecipeSummary["catalog"],
  };
}

describe("example setup showcase", () => {
  beforeEach(() => loadRecipeCatalog.mockReset().mockResolvedValue(FIXTURE_SLUGS.map(recipe)));

  test("every slug in the profile module resolves against the test catalog", () => {
    expect(slugs.filter((slug) => !FIXTURE_SLUGS.includes(slug))).toEqual([]);
    expect(FIXTURE_SLUGS.filter((slug) => !slugs.includes(slug))).toEqual([]);
  });

  test("the light coder is always in the left column and shares the coder role", () => {
    for (const profile of SHOWCASE_PROFILES) {
      for (const member of profile.members.filter((item) => item.slug === LIGHT_CODER)) {
        expect(member.column).toBe("left");
        expect(member.role).toBe("coder");
      }
    }
    expect(SHOWCASE_PROFILES).toHaveLength(7);
    expect(JSON.stringify(SHOWCASE_PROFILES).toLowerCase()).not.toContain("transcri");
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
    loadRecipeCatalog.mockResolvedValue(FIXTURE_SLUGS.filter((slug) => slug !== "wan-2-2-i2v-14b-comfyui-single").map(recipe));
    render(<ShowcasePage />);
    const card = screen.getByRole("region", { name: "Trailer & cutscenes" });
    await waitFor(() => expect(within(card).getByRole("link")).toBeVisible());
    expect(within(card).getByText("wan-2-2-i2v-14b-comfyui-single")).toBeVisible();
    expect(within(card).getByText("Not in the published catalog right now.")).toBeVisible();
  });
});
