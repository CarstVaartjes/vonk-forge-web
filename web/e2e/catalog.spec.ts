import { expect, test } from "@playwright/test";


const recipe = {
  publisher: "vonk",
  slug: "qwen-fast",
  title: "Qwen Fast",
  official: true,
  revision_number: 3,
  content_sha256: "a".repeat(64),
  published_at: "2026-08-07T10:00:00Z",
  runtime: { family: "vllm", image: `registry.example/vonk/qwen@sha256:${"b".repeat(64)}` },
  artifacts: [{ repository: "Qwen/Qwen", revision: "c".repeat(40), expected_bytes: 20_000_000_000 }],
  workload: { family: "qwen", capabilities: ["openai.chat"] },
  resources: { per_node: { installed_bytes: 21_474_836_480, resident_memory_bytes: 51_539_607_552 }, measurement: "measured" },
  topology: { kind: "gang", min_nodes: 2, max_nodes: 4, tested_node_counts: [2] },
  moderation_warning: null,
  facts: { declared: true, registry_observed: { layer_bytes: 1 }, publisher_tested: true, publisher_tested_label: "Publisher-submitted; not Vonk-certified", vonk_verified: false, last_validation: "2026-08-07T10:00:00Z" },
  import: { uri: `vonk://catalog/vonk/qwen-fast@sha256:${"a".repeat(64)}`, instruction: "Open this recipe locally." },
};


test.beforeEach(async ({ page }) => {
  await page.route(/\/v1\/recipes(?:\?.*)?$/, (route) =>
    route.fulfill({ json: { items: [recipe], next_cursor: null } }),
  );
  await page.route(/\/v1\/recipes\/vonk\/qwen-fast$/, (route) =>
    route.fulfill({
      json: {
        ...recipe,
        latest_revision: {
          revision_number: 3,
          content_sha256: recipe.content_sha256,
          document: recipe,
        },
      },
    }),
  );
});


test("facets remain in the URL and exact trust facts survive navigation", async ({ page }) => {
  await page.goto("/recipes?topology=gang");
  await expect(page.getByLabel("Topology")).toHaveValue("gang");
  await expect(page.getByRole("heading", { name: "Qwen Fast" })).toBeVisible();
  await expect(page.getByText("Registry observed")).toBeVisible();
  await page.getByRole("link", { name: "Qwen Fast" }).click();
  await expect(page.getByRole("heading", { name: "Trust, precisely stated" })).toBeVisible();
  await expect(page.getByText(/publisher-submitted test accepted/i)).toBeVisible();
  await expect(page.locator("code").filter({ hasText: recipe.import.uri })).toBeVisible();
});
