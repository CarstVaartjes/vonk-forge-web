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
  runtime: { adapter: "vllm", entrypoint: ["vllm", "serve", "/models"] },
  build: { context: { sha256: "b".repeat(64), expected_bytes: 2048 }, dockerfile: "Dockerfile" },
  artifacts: [{ repository: "Qwen/Qwen", revision: "c".repeat(40), download_bytes: 20_000_000_000 }],
  workload: { family: "qwen", capabilities: ["openai.chat"] },
  deployment_profiles: [{ name: "pair", node_count: 2 }, { name: "quad", node_count: 4 }],
  capacity: {
    profile_node_counts: [2, 4],
    maximum_installed_bytes_per_node: 21_474_836_480,
    maximum_runtime_memory_bytes_per_node: 51_539_607_552,
  },
  moderation_warning: null,
  facts: { declared: true, source_bundle_observed: true, publisher_tested: true, publisher_tested_label: "Publisher-submitted; not Vonk-certified", vonk_verified: false, last_validation: "2026-08-07T10:00:00Z" },
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


test("platform story stays navigable and bounded", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Build where the models live." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Catalog" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "NAS control" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Spark runtime" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Development", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Production", exact: true })).toBeVisible();

  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to content" });
  await expect(skipLink).toBeFocused();
  await skipLink.press("Enter");
  await expect(page).toHaveURL(/#main-content$/);

  await expect(page.locator(".site-header")).toHaveCSS("position", "sticky");
  await expect(page.locator(".boundary")).toHaveCSS("display", "grid");
  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(horizontalOverflow).toBeLessThanOrEqual(0);

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Explore recipes" })).toBeFocused();

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("html")).toHaveCSS("scroll-behavior", "auto");

  const minimumFaintContrast = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    const parseHex = (value: string) => {
      const hex = value.trim().replace("#", "");
      return [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
    };
    const luminance = (value: string) => parseHex(value)
      .map((channel) => channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4)
      .reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index], 0);
    const contrast = (foreground: string, background: string) => {
      const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
      return (values[0] + 0.05) / (values[1] + 0.05);
    };
    const foreground = styles.getPropertyValue("--faint");
    return Math.min(
      ...["--night", "--panel", "--panel-raised"].map((token) =>
        contrast(foreground, styles.getPropertyValue(token))),
    );
  });
  expect(minimumFaintContrast).toBeGreaterThanOrEqual(4.5);
});


test("minimum supported viewport does not overflow", async ({ page }) => {
  for (const width of [320, 393]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Build where the models live." })).toBeVisible();
    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(horizontalOverflow).toBeLessThanOrEqual(0);
  }
});


test("architecture and installation guides stay navigable at 1…N scale", async ({ page }) => {
  await page.goto("/architecture");
  await expect(page.getByRole("heading", { name: /one control plane.*one to many sparks/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Spark fleet" })).toBeVisible();
  await expect(page.getByText("NVIDIA fabric", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Single Spark" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Two Sparks" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fleet", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "One contract. Any reviewed runtime." })).toBeVisible();
  await expect(page.getByText("VONK_RANK", { exact: true })).toBeVisible();
  await expect(page.getByText("/run/vonk/runtime.json", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Open the install guide" }).click();
  await expect(page).toHaveURL(/\/install$/);
  await expect(page.getByRole("heading", { name: "Install Vonk Forge" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "One Spark", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Many Sparks", exact: true })).toBeVisible();
  await expect(page.getByText(/funnel stays disabled/i)).toBeVisible();

  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/architecture", "/install"]) {
      await page.goto(path);
      const horizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(horizontalOverflow).toBeLessThanOrEqual(0);
    }
  }
});


test("facets remain in the URL and exact trust facts survive navigation", async ({ page }) => {
  await page.goto("/recipes?topology=gang");
  await expect(page.getByLabel("Topology")).toHaveValue("gang");
  await expect(page.getByRole("heading", { name: "Qwen Fast" })).toBeVisible();
  await expect(page.getByText("Source verified")).toBeVisible();
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
    build: { context: { sha256: "b".repeat(64) }, dockerfile: "Dockerfile" },
    runtime: { adapter: "vllm", entrypoint: ["vllm", "serve", "/models"] },
  };
  let validated = false;
  let sourceUploaded = false;
  const draft = () => ({
    id: "draft-1", publisher: "ada-labs", recipe_id: "recipe-1", version: 1,
    state: validated ? "validated" : "draft", content_sha256: "a".repeat(64),
    recipe: document, source_bundle_sha256: "b".repeat(64),
    source_bundle_available: sourceUploaded, validation_problems: [],
    validation: validated ? {
      status: "passed", created_at: "2026-08-07T10:00:00Z",
      checks: [{ code: "source.bundle_verified", passed: true, detail: "Canonical source manifest verified" }],
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
  await page.route(/\/v1\/publishers\/ada-labs\/source-bundles\/[a-f0-9]{64}$/, async (route) => {
    sourceUploaded = true;
    await route.fulfill({ json: { sha256: "b".repeat(64), files: ["Dockerfile"] } });
  });
  await page.route(/\/v1\/publishers\/ada-labs\/drafts\/draft-1\/publish$/, (route) => route.fulfill({
    status: 201, json: { revision_id: "revision-1", revision_number: 1, content_sha256: "a".repeat(64), official: false },
  }));

  await page.goto("/publish");
  await page.getByLabel("Upload local JSON").setInputFiles({
    name: "recipe.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ recipe: document, test_report: { schema_version: 1 } })),
  });
  await expect(page.getByText(/model bytes are never sent/i)).toBeVisible();
  await page.getByLabel("Upload source tar").setInputFiles({
    name: "source.tar", mimeType: "application/x-tar", buffer: Buffer.from("test-tar"),
  });
  await expect(page.getByText(/verified source bundle/i)).toBeVisible();
  const validate = page.getByRole("button", { name: "Validate this version" });
  await validate.focus();
  await validate.press("Enter");
  await expect(page.getByText(/validation queued as job-1/i)).toBeVisible();
  await page.getByRole("button", { name: "Refresh reports" }).click();
  await expect(page.getByText("Pass · source.bundle_verified")).toBeVisible();
  await page.getByRole("checkbox", { name: /confirm these exact public identifiers/i }).check();
  await page.getByRole("button", { name: "Publish publicly" }).click();
  await expect(page.getByText(/published immutable revision 1/i)).toBeVisible();
});
