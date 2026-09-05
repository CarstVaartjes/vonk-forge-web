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
  source: { recipe_url: "https://github.com/CarstVaartjes/vonk-forge-recipes/blob/main/recipes/qwen-fast.json" },
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
  await expect(page.getByRole("heading", { name: "Choose a model or recipe" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Download, run, switch" })).toBeVisible();

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


test("models page explains the public to local boundary on demand", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /See how models, recipes, and your Controller fit together/i }).click();
  await expect(page).toHaveURL(/\/models#model-recipe-explainer$/);

  const explainer = page.locator(".public-contract-explainer");
  const summary = explainer.locator("summary");
  await expect(summary).toBeVisible();
  await summary.focus();
  await expect(summary).toBeFocused();
  await expect(page.getByRole("heading", { name: "A model is the AI. A recipe is how you run it." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Download once. Reuse across your Sparks." })).toBeVisible();
  await expect(page.getByText(/view downloads, running models, and Spark status in your private Controller/i)).toBeVisible();
  await expect(explainer.getByText("Recipe A · one Spark")).toBeVisible();
  await expect(explainer.getByText("Recipe B · two Sparks")).toBeVisible();

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(horizontalOverflow).toBeLessThanOrEqual(0);
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
  await expect(page.getByText(/vonkctl models list/)).toBeVisible();
  await expect(page.getByText(/recipe repository syncs automatically/i)).toBeVisible();
  await expect(page.getByText(/vonkctl library public preview/i)).toHaveCount(0);

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
  const compactRecipeRows = await page.evaluate(() => window.innerWidth < 700);
  await expect(page.getByRole("row").nth(1).getByRole("cell")).toHaveCount(compactRecipeRows ? 8 : 16);
  await expect(page.getByRole("heading", { name: "Qwen Fast" })).toBeVisible();
  await expect(page.getByText(/Source verified/)).toBeVisible();
  await page.getByRole("link", { name: "Qwen Fast" }).click();
  await expect(page.getByRole("heading", { name: "Trust, precisely stated" })).toBeVisible();
  await expect(page.getByText(/publisher-submitted test accepted/i)).toBeVisible();
  await expect(page.locator("code").filter({ hasText: recipe.import.uri })).toBeVisible();
  await expect(page.getByRole("link", { name: "Inspect recipe source" })).toHaveAttribute(
    "href", "https://github.com/CarstVaartjes/vonk-forge-recipes/blob/main/recipes/qwen-fast.json",
  );
});


test("publisher navigation points to repository authoring without an upload workspace", async ({ page }) => {
  await page.goto("/publish");
  await expect(page.getByRole("heading", { name: "Publish a recipe others can trust." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Read the recipe authoring guide" })).toHaveAttribute(
    "href", "https://github.com/CarstVaartjes/vonk-forge-recipes/blob/main/docs/recipe-authoring.md",
  );
  await expect(page.getByLabel("Upload local JSON")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Publish publicly" })).toHaveCount(0);
});
