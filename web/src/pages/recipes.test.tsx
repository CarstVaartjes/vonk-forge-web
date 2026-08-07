import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { RecipesPage } from "./recipes";


const recipe = {
  publisher: "vonk",
  slug: "qwen-fast",
  title: "Qwen Fast",
  official: true,
  revision_number: 3,
  revision_id: "revision-qwen-3",
  content_sha256: "a".repeat(64),
  published_at: "2026-08-07T10:00:00Z",
  runtime: { adapter: "vllm", entrypoint: ["vllm", "serve", "/models"] },
  build: { context: { sha256: "b".repeat(64), expected_bytes: 2048 }, dockerfile: "Dockerfile" },
  workload: { family: "qwen", capabilities: ["openai.chat"] },
  deployment_profiles: [{ name: "solo", node_count: 1 }],
  capacity: {
    profile_node_counts: [1],
    maximum_installed_bytes_per_node: 20 * 1024 ** 3,
    maximum_runtime_memory_bytes_per_node: 48 * 1024 ** 3,
  },
  moderation_warning: null,
  facts: { declared: true, source_bundle_observed: true, publisher_tested: true, publisher_tested_label: "Publisher-submitted; not Vonk-certified", vonk_verified: false, last_validation: "2026-08-07T10:00:00Z" },
};


beforeEach(() => {
  window.history.replaceState(null, "", "/recipes?runtime=vllm");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ items: [recipe], next_cursor: null }),
  }));
});

afterEach(() => vi.unstubAllGlobals());


test("shows sizing, immutable identity, and evidence provenance", async () => {
  render(<RecipesPage />);
  expect(await screen.findByRole("heading", { name: "Qwen Fast" })).toBeVisible();
  expect(screen.getByText("20 GiB")).toBeVisible();
  expect(screen.getByText("48 GiB")).toBeVisible();
  expect(screen.getByText("Source verified")).toBeVisible();
  expect(screen.getByText("Publisher-tested")).toBeVisible();
  expect(screen.getByText(/not a Vonk endorsement/i)).toBeVisible();
  expect(screen.getByText(/sha256:aaaa/)).toBeVisible();
});


test("keeps filters in the URL and sends them to the API", async () => {
  render(<RecipesPage />);
  await screen.findByRole("heading", { name: "Qwen Fast" });
  fireEvent.change(screen.getByLabelText("Topology"), { target: { value: "gang" } });
  await waitFor(() => expect(window.location.search).toContain("topology=gang"));
  await waitFor(() => {
    const calls = vi.mocked(fetch).mock.calls.map(([input]) => String(input));
    expect(calls.some((url) => url.includes("runtime=vllm") && url.includes("topology=gang"))).toBe(true);
  });
});
