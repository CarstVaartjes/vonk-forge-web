import { expect, test } from "@playwright/test";


const recipe = {
  publisher: "vonk",
  slug: "qwen-fast",
  title: "Qwen Fast",
  official: true,
  revision_number: 3,
  revision_id: "revision-qwen-3",
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
  await expect(page.getByRole("link", { name: "Fork into my publisher" })).toHaveAttribute(
    "href", "/publish?fork_revision=revision-qwen-3",
  );
});


test("publisher uploads local evidence, observes worker validation, and publishes explicitly", async ({ page }) => {
  const document = {
    identity: { publisher: "ada-labs", slug: "qwen-fast" },
    metadata: { title: "Qwen Fast" },
    runtime: { image: `ghcr.io/ada/qwen@sha256:${"b".repeat(64)}` },
  };
  let validated = false;
  const draft = () => ({
    id: "draft-1", publisher: "ada-labs", recipe_id: "recipe-1", version: 1,
    state: validated ? "validated" : "draft", content_sha256: "a".repeat(64),
    recipe: document, validation_problems: [],
    validation: validated ? {
      status: "passed", created_at: "2026-08-07T10:00:00Z",
      checks: [{ code: "registry.arm64_available", passed: true, detail: "linux/arm64 manifest found" }],
    } : null,
  });
  await page.route(/\/v1\/me$/, (route) => route.fulfill({ json: {
    user: { id: "user-1", display_name: "Ada" }, accounts: [{ provider: "github", email: "ada@example.test" }],
    csrf_token: "csrf-1", session_expires_at: "2026-08-08T10:00:00Z",
  } }));
  await page.route(/\/v1\/publishers$/, (route) => route.fulfill({ json: { items: [
    { id: "publisher-1", slug: "ada-labs", name: "Ada Labs", role: "owner", official: false },
  ] } }));
  await page.route(/\/v1\/publishers\/ada-labs\/drafts$/, async (route) => {
    if (route.request().method() === "POST") await route.fulfill({ status: 201, json: draft() });
    else await route.fulfill({ json: { items: [draft()] } });
  });
  await page.route(/\/v1\/publishers\/ada-labs\/drafts\/draft-1\/validate$/, async (route) => {
    validated = true;
    await route.fulfill({ status: 202, json: { job_id: "job-1", state: "queued" } });
  });
  await page.route(/\/v1\/publishers\/ada-labs\/drafts\/draft-1\/publish$/, (route) => route.fulfill({
    status: 201, json: { revision_id: "revision-1", revision_number: 1, content_sha256: "a".repeat(64), official: false },
  }));

  await page.goto("/publish");
  await page.getByLabel("Upload local JSON").setInputFiles({
    name: "recipe.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ recipe: document, test_report: { schema_version: 1 } })),
  });
  await expect(page.getByText(/no container or model bytes were sent/i)).toBeVisible();
  await page.getByRole("button", { name: "Validate this version" }).click();
  await expect(page.getByText(/validation queued as job-1/i)).toBeVisible();
  await page.getByRole("button", { name: "Refresh reports" }).click();
  await expect(page.getByText("Pass · registry.arm64_available")).toBeVisible();
  await page.getByRole("checkbox", { name: /confirm these exact public identifiers/i }).check();
  await page.getByRole("button", { name: "Publish publicly" }).click();
  await expect(page.getByText(/published immutable revision 1/i)).toBeVisible();
});
