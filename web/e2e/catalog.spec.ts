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
  catalog: {
    description: "Fast language model",
    tags: ["chat", "reasoning", "candidate", "executable", "nvfp4"],
    model_publisher: "qwen",
    model_slug: "qwen-fast",
    model_title: "Qwen Fast",
    model_version_publisher: "qwen",
    model_version_slug: "qwen-fast-v1",
    model_version_title: "Qwen Fast v1",
    source_owner: "Qwen",
    source_repository: "https://huggingface.co/Qwen/Qwen-Fast",
    alignment: "standard",
    capabilities: ["chat", "reasoning"],
    qualification: "candidate",
    execution_readiness: "executable",
    runtime_distribution: "vllm-0-27-1",
    precision: "NVFP4",
    quantizations: ["NVFP4"],
    topology_name: "pair",
    topology_mode: "distributed",
    node_count: 2,
    expected_download_bytes: 20_000_000_000,
  },
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

  await expect(page.getByRole("heading", { name: /Local AI\.\s*One private control plane\./i })).toBeVisible();
  await expect(page.getByText(/turns a laptop, NAS, or local server into the command center/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Catalog + signed releases", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Vonk Forge controller", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "DGX Spark fleet", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Install the controller" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Connect your Sparks" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Choose a recipe" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Preview, then run" })).toBeVisible();

  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to content" });
  await expect(skipLink).toBeFocused();
  await skipLink.press("Enter");
  await expect(page).toHaveURL(/#main-content$/);

  const viewport = page.viewportSize();
  await expect(page.locator(".site-header")).toHaveCSS(
    "position",
    viewport && viewport.width <= 720 ? "relative" : "sticky",
  );
  await expect(page.locator(".security-map")).toHaveCSS("display", "grid");
  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(horizontalOverflow).toBeLessThanOrEqual(0);

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Install your controller" })).toBeFocused();

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

    await expect(page.getByRole("heading", { name: /Local AI\.\s*One private control plane\./i })).toBeVisible();
    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(horizontalOverflow).toBeLessThanOrEqual(0);
  }
});


test("architecture, installation, and control guides stay navigable at 1…N scale", async ({ page }) => {
  await page.goto("/architecture");
  await expect(page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "How it works" })).toHaveAttribute("aria-current", "page");
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
  await expect(page.getByRole("heading", { name: "Prepare the controller" })).toBeVisible();
  await expect(page.getByText(/this laptop for a lab/i)).toBeVisible();
  const preflightHeading = page.getByRole("heading", { name: "Complete private HTTPS setup first." });
  const controllerCommand = page.getByText("curl -fsSL https://install.vonkforge.ai/nas | sh");
  await expect(preflightHeading).toBeVisible();
  await expect(controllerCommand).toBeVisible();
  expect(await preflightHeading.evaluate((preflight) => {
    const command = [...document.querySelectorAll(".command-block code")]
      .find((candidate) => candidate.textContent === "curl -fsSL https://install.vonkforge.ai/nas | sh");
    return Boolean(command && (preflight.compareDocumentPosition(command) & Node.DOCUMENT_POSITION_FOLLOWING));
  })).toBe(true);
  await expect(page.getByText(/MagicDNS and HTTPS certificates/i)).toBeVisible();
  await expect(page.getByText(/OAuth client with only/)).toContainText("auth_keys");
  await expect(page.getByText(/OAuth client with only/)).toContainText("tag:vonk-gateway");
  await expect(page.getByText(/Production and development use these same unsuffixed names/i)).toBeVisible();
  await expect(page.getByText(/isolated, disposable test tailnet/i)).toBeVisible();
  await expect(page.getByLabel("Tailscale Services by feature set")).toContainText("Hermes disabled · 1 Service");
  await expect(page.getByLabel("Tailscale Services by feature set")).toContainText("Hermes enabled · 3 Services");
  await expect(page.getByLabel("Tailscale Services by feature set")).toContainText("svc:vonk-forge");
  await expect(page.getByLabel("Tailscale Services by feature set")).toContainText("svc:hermes-api");
  await expect(page.getByLabel("Tailscale Services by feature set")).toContainText("svc:hermes-dashboard");
  await expect(page.getByRole("heading", { name: "Choose a control path" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "One Spark", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Many Sparks", exact: true })).toBeVisible();
  await expect(page.getByText(/VONK_CONTROLLER_ADDRESS=192\.168\.1\.231/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Prove the private route before enrolling Sparks." })).toBeVisible();
  await expect(page.locator(".verification-grid").getByText("Self.PrimaryRoutes")).toBeVisible();
  await expect(page.locator('[aria-label="Exact Tailscale Serve map"]')).toContainText("svc:vonk-forgeHTTPS 443 → http://caddy:8080");
  await expect(page.locator('[aria-label="Exact Tailscale Serve map"]')).toContainText("svc:hermes-apiHTTPS 443 → http://hermes-agent:8642");
  await expect(page.locator('[aria-label="Exact Tailscale Serve map"]')).toContainText("svc:hermes-dashboardHTTPS 443 → http://hermes-agent:9119");
  await expect(page.getByText(/tailscale ping vonk-forge\.<TAILNET_DNS_SUFFIX>\.ts\.net/)).toBeVisible();
  await expect(page.getByText("No matching peer")).toBeVisible();
  await expect(page.getByRole("link", { name: "Canonical Tailscale runbook" })).toHaveAttribute(
    "href",
    "https://github.com/CarstVaartjes/vonk-forge/blob/main/docs/runbooks/tailscale.md",
  );

  await page.goto("/control");
  await expect(page.getByRole("heading", { name: "Choose browser or terminal." })).toBeVisible();
  await expect(page.getByText(/uv tool install 'git\+https:\/\/github\.com\/CarstVaartjes\/vonk-forge\.git@main'/)).toBeVisible();
  await expect(page.getByText(/browser password is not a CLI credential/i)).toBeVisible();
  await expect(page.getByText(/vonkctl library public facets/)).toBeVisible();

  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/architecture", "/install", "/control", "/privacy"]) {
      await page.goto(path);
      const horizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(horizontalOverflow).toBeLessThanOrEqual(0);
    }
  }
});


test("facets remain in the URL and exact trust facts survive navigation", async ({ page }) => {
  await page.goto("/recipes?sparks=2&abliterated=false&capability=chat");
  await expect(page.getByLabel("Filter by required Sparks")).toHaveValue("2");
  await expect(page.getByLabel("Filter by abliterated")).toHaveValue("false");
  await expect(page.getByLabel("Filter by capability")).toContainText("1 selected");
  await expect(page.getByLabel("Filter by model family")).toBeVisible();
  await expect(page.getByLabel("Filter by model", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Filter by quantization")).toBeVisible();
  await expect(page.getByLabel("Filter by required Sparks")).toBeVisible();
  await expect(page.getByLabel("Filter by recipe creator")).toBeVisible();
  await expect(page.getByLabel("Filter by updated date")).toBeVisible();
  await expect(page.getByLabel("Filter by execution readiness")).toBeVisible();
  await expect(page.getByLabel("Filter by original repository")).toBeVisible();
  await expect(page.getByLabel("Filter by download size")).toBeVisible();
  await expect(page.getByLabel("Filter by disk per Spark")).toBeVisible();
  await expect(page.getByLabel("Filter by memory per Spark")).toBeVisible();
  await expect(page.getByRole("columnheader")).toHaveCount(16);
  await expect(page.getByRole("row").nth(1).getByRole("cell")).toHaveCount(16);
  await expect(page.getByRole("heading", { name: "Qwen Fast" })).toBeVisible();
  await expect(page.getByText(/Source verified/)).toBeVisible();
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
