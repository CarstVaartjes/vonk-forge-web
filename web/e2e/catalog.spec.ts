import { expect, test } from "@playwright/test";


const releaseTag = "v1.2.3";
const sourceCommit = "f".repeat(40);
const recipeDigest = "a".repeat(64);
const modelDigest = "3".repeat(64);
const recipeImportUri = `vonk://catalog/vonk-forge/qwen-fast@sha256:${recipeDigest}`;

// The production build reads the verified recipe release that the Pages build
// writes to /catalog on this origin. Serve a fixture release at those paths so the
// static build is exercised end to end without reaching GitHub.
const catalogIndex = {
  schema_version: 2,
  kind: "recipe-library-index",
  repository: "CarstVaartjes/vonk-forge-recipes",
  source_commit: sourceCommit,
  package_contract: {
    schema_version: 2,
    media_type: "application/vnd.vonk-forge.recipe-package.v2+tar+gzip",
    path_prefix: "packages/",
  },
  catalog_entities: [{
    content_sha256: modelDigest,
    document: {
      kind: "model",
      schema_version: 2,
      identity: {
        publisher: "qwen",
        slug: "qwen-fast-nvfp4",
        family: { publisher: "qwen", slug: "qwen", title: "Qwen" },
        model: { publisher: "qwen", slug: "qwen-fast", title: "Qwen Fast", architecture: "transformer" },
        version: "1.0",
        variant: "nvfp4",
      },
      metadata: { title: "Qwen Fast NVFP4", description: "Fast language model", tags: ["language"] },
      source: { repository: "https://huggingface.co/Qwen/Qwen-Fast", revision: "c".repeat(40) },
      format: { container: "safetensors", precision: "nvfp4", quantization: "nvfp4" },
      sizes: { download_bytes: 20_000_000_000, installed_bytes: 20_000_000_000 },
      files: [{ id: "weights", path: "weights.safetensors", sha256: "b".repeat(64), size_bytes: 20_000_000_000, roles: ["weights"] }],
      capabilities: {
        schema_version: 2,
        facts: [
          { capability: "chat", support: "supported", evidence_status: "declared" },
          { capability: "reasoning", support: "supported", evidence_status: "declared" },
        ],
      },
    },
  }],
  recipes: [{
    content_sha256: recipeDigest,
    source_path: "recipes/qwen-fast.json",
    package: {
      expected_bytes: 123,
      media_type: "application/vnd.vonk-forge.recipe-package.v2+tar+gzip",
      minimum_consumer_schema: 2,
      path: "packages/vonk-forge-qwen-fast.tar.gz",
      recipe_content_sha256: recipeDigest,
      sha256: "1".repeat(64),
    },
    release: { version: "2.1.0", released_at: "2026-08-07", history: [{}, {}, {}] },
    document: {
      kind: "recipe",
      schema_version: 2,
      identity: { publisher: "vonk-forge", slug: "qwen-fast" },
      metadata: { title: "Qwen Fast", description: "Fast language model", tags: ["candidate", "executable", "chat", "nvfp4"], alignment: "standard" },
      models: [{ id: "primary", model: { kind: "model", publisher: "qwen", slug: "qwen-fast-nvfp4", content_sha256: modelDigest }, files: [{ id: "weights", file_id: "weights", roles: ["entrypoint"], mount: { target: "/models", read_only: true } }] }],
      runtime: { engine: "vllm", entrypoint: ["vllm", "serve", "/models"] },
      execution: { mode: "build", build: { context: { path: "adapters/qwen", sha256: "e".repeat(64) }, dockerfile: "Dockerfile" } },
      topology: {
        name: "pair",
        mode: "distributed",
        node_count: 2,
        roles: [{ resources: { disk: { artifact_bytes: 21_474_836_480 }, memory: { startup_peak_bytes: 51_539_607_552 } } }],
      },
      provenance: { source_kind: "global", source_reference: "https://huggingface.co/Qwen/Qwen-Fast", attribution: ["Qwen"] },
    },
  }],
};


test.beforeEach(async ({ page }) => {
  // Block every other origin: the catalog must be served from this site.
  await page.route((url) => !["127.0.0.1", "localhost"].includes(url.hostname), (route) => route.abort());
  await page.route("**/catalog/catalog-index.json", (route) => route.fulfill({ json: catalogIndex }));
  await page.route("**/catalog/release.json", (route) =>
    route.fulfill({ json: { repository: "CarstVaartjes/vonk-forge-recipes", tag: releaseTag, source_commit: sourceCommit } }),
  );
});


test("platform story stays navigable and bounded", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Frontier AI\.\s*Your Sparks\.\s*One click\./i })).toBeVisible();
  await expect(page.getByText(/Run state-of-the-art models locally on your Sparks with one private Controller/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Catalog + verified releases", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Vonk Forge controller", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "DGX Spark fleet", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Install the controller" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Connect your Sparks" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Choose a model or recipe" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Prepare, run, switch" })).toBeVisible();

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
  await expect(page.locator(".home-hero").getByRole("link", { name: "Set up your Controller" })).toBeFocused();

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

    await expect(page.getByRole("heading", { name: /Frontier AI\.\s*Your Sparks\.\s*One click\./i })).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "Pick a model. Choose how to run it." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "From the catalog to your NAS" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Available globally" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Prepared locally" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Run on Sparks" })).toBeVisible();
  await expect(page.getByText(/Model files downloaded and verified on your NAS/i)).toBeVisible();
  await expect(page.getByText(/container image—the software needed to run the model—has been downloaded or built and cached on your NAS/i)).toBeVisible();
  await expect(page.getByText(/Local means cached on your NAS. Running starts when you choose Run. Recipe definitions stay in the global repository/i)).toBeVisible();
  await expect(page.getByText(/Profiles remember your model, recipe, and Spark assignments/i)).toBeVisible();

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
  await expect(page.getByText("Source: canonical bundle verified by Vonk")).toBeVisible();
  await expect(page.getByText("Runtime test: no accepted publisher test")).toBeVisible();
  await expect(page.locator("code").filter({ hasText: recipeImportUri })).toBeVisible();
  await expect(page.getByRole("link", { name: "Inspect recipe source" })).toHaveAttribute(
    "href", `https://github.com/CarstVaartjes/vonk-forge-recipes/blob/${sourceCommit}/recipes/qwen-fast.json`,
  );
  await expect(page.getByRole("link", { name: "Download package" })).toHaveAttribute(
    "href", `https://github.com/CarstVaartjes/vonk-forge-recipes/releases/download/${releaseTag}/vonk-forge-qwen-fast.tar.gz`,
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
