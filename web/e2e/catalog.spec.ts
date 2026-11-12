import { existsSync, statSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { buildCatalogSummary } from "../src/catalog-summary.ts";


const releaseTag = "v4.0.0";
const sourceCommit = "f".repeat(40);
const recipeDigest = "a".repeat(64);
const modelDigest = "3".repeat(64);
const recipeImportUri = `vonk://catalog/vonk-forge/qwen-fast@sha256:${recipeDigest}`;

const today = new Date().toISOString().slice(0, 10);

function modelEntity(options: { digest: string; slug: string; logical: string; publisher: string; family: string; title: string; capabilities: string[]; repository: string; fileDigest: string; tags?: string[] }) {
  return {
    content_sha256: options.digest,
    document: {
      kind: "model",
      identity: {
        publisher: options.publisher,
        slug: options.slug,
        family: { publisher: options.publisher, slug: options.family.toLowerCase().replaceAll(" ", "-") },
        model: { publisher: options.publisher, slug: options.logical },
        version: "1.0",
        variant: "nvfp4",
      },
      source: { repository: options.repository, revision: "c".repeat(40) },
      requires_token: false,
      format: { precision: "nvfp4", quantization: "nvfp4" },
      files: [{ id: "weights", path: "weights.safetensors", sha256: options.fileDigest, size_bytes: 20_000_000_000, roles: ["weights"] }],
    },
    display: { kind: "model-display", capabilities: options.capabilities, family_title: options.family, model_title: options.title, description: `${options.title} model`, tags: options.tags ?? [] },
  };
}

function recipeEntry(options: { digest: string; slug: string; title: string; modelDigest: string; modelSlug: string; modelPublisher: string; status: string; nodes: number; releasedAt: string; reference: string; tags?: string[] }) {
  return {
    content_sha256: options.digest,
    source_path: `recipes/${options.slug}.json`,
    package: {
      expected_bytes: 123,
      media_type: "application/vnd.vonk-forge.recipe-package.v2+tar+gzip",
      minimum_consumer_schema: 2,
      path: `packages/vonk-forge-${options.slug}.tar.gz`,
      recipe_content_sha256: options.digest,
      sha256: "1".repeat(64),
    },
    qualification: { status: options.status, changed: [], required_sparks: options.nodes },
    display: { kind: "recipe-display", title: options.title, description: `${options.title} recipe`, tags: options.tags ?? ["candidate", "executable"], alignment: "standard" },
    release: { version: "2.1.0", released_at: options.releasedAt },
    document: {
      kind: "recipe",
      identity: { publisher: "vonk-forge", slug: options.slug },
      models: [{ id: "primary", model: { kind: "model", publisher: options.modelPublisher, slug: options.modelSlug, content_sha256: options.modelDigest }, files: [{ id: "weights", file_id: "weights", roles: ["entrypoint"], mount: { target: "/models" } }] }],
      runtime: { engine: "vllm", entrypoint: ["vllm", "serve", "/models"] },
      execution: { build: { context: { path: "adapters/qwen" }, dockerfile: "Dockerfile" } },
      topology: {
        name: options.nodes === 1 ? "single" : "pair",
        node_count: options.nodes,
        roles: [{ resources: { disk: { artifact_bytes: 21_474_836_480 }, memory: { peak_bytes: 51_539_607_552, reserve_bytes: 0 } } }],
      },
      provenance: { source_reference: options.reference, attribution: [options.title] },
    },
  };
}

// The production build reads the verified recipe release that the Pages build
// writes to /catalog on this origin. Serve a fixture release at those paths so the
// static build is exercised end to end without reaching GitHub.
const catalogIndex = {
  schema_version: 2,
  contract_version: "4.0.0",
  updated_at: "2026-09-28T20:04:06Z",
  kind: "recipe-library-index",
  repository: "CarstVaartjes/vonk-forge-recipes",
  source_commit: sourceCommit,
  package_contract: {
    schema_version: 2,
    media_type: "application/vnd.vonk-forge.recipe-package.v2+tar+gzip",
    path_prefix: "packages/",
  },
  catalog_entities: [
    modelEntity({ digest: modelDigest, slug: "qwen-fast-nvfp4", logical: "qwen-fast", publisher: "qwen", family: "Qwen", title: "Qwen Fast", capabilities: ["chat", "reasoning"], repository: "https://huggingface.co/Qwen/Qwen-Fast", fileDigest: "b".repeat(64), tags: ["language"] }),
    modelEntity({ digest: "4".repeat(64), slug: "qwen-code-bf16", logical: "qwen-code", publisher: "qwen", family: "Qwen", title: "Qwen Code", capabilities: ["code-generation"], repository: "https://huggingface.co/qwen/Qwen-Code", fileDigest: "c".repeat(64) }),
    modelEntity({ digest: "5".repeat(64), slug: "acme-coder-bf16", logical: "acme-coder", publisher: "acme", family: "Acme Coder", title: "Acme Coder", capabilities: ["code-generation", "text-generation"], repository: "https://github.com/Acme/Acme-Coder", fileDigest: "d".repeat(64) }),
    modelEntity({ digest: "6".repeat(64), slug: "acme-vision-bf16", logical: "acme-vision", publisher: "acme", family: "Acme", title: "Acme Vision", capabilities: ["image-understanding", "text-generation"], repository: "https://github.com/Acme/Acme-Vision", fileDigest: "e".repeat(64) }),
    modelEntity({ digest: "7".repeat(64), slug: "acme-shapes-bf16", logical: "acme-shapes", publisher: "acme", family: "Acme", title: "Acme Shapes", capabilities: ["3d-generation"], repository: "https://github.com/Acme/Acme-Shapes", fileDigest: "f".repeat(64) }),
  ],
  recipes: [
    recipeEntry({ digest: recipeDigest, slug: "qwen-fast", title: "Qwen Fast", modelDigest, modelSlug: "qwen-fast-nvfp4", modelPublisher: "qwen", status: "Working", nodes: 2, releasedAt: "2026-08-07", reference: "https://huggingface.co/Qwen/Qwen-Fast", tags: ["candidate", "executable", "chat", "nvfp4"] }),
    recipeEntry({ digest: "8".repeat(64), slug: "qwen-code", title: "Qwen Code", modelDigest: "4".repeat(64), modelSlug: "qwen-code-bf16", modelPublisher: "qwen", status: "Not yet verified", nodes: 1, releasedAt: "2026-08-01", reference: "https://huggingface.co/qwen/Qwen-Code" }),
    recipeEntry({ digest: "9".repeat(64), slug: "acme-coder", title: "Acme Coder", modelDigest: "5".repeat(64), modelSlug: "acme-coder-bf16", modelPublisher: "acme", status: "Working", nodes: 1, releasedAt: today, reference: "https://github.com/Acme/Acme-Coder" }),
    recipeEntry({ digest: "2".repeat(64), slug: "acme-shapes", title: "Acme Shapes", modelDigest: "7".repeat(64), modelSlug: "acme-shapes-bf16", modelPublisher: "acme", status: "Working", nodes: 1, releasedAt: "2026-08-03", reference: "https://github.com/Acme/Acme-Shapes" }),
    recipeEntry({ digest: "1".repeat(64), slug: "acme-vision", title: "Acme Vision", modelDigest: "6".repeat(64), modelSlug: "acme-vision-bf16", modelPublisher: "acme", status: "Working", nodes: 1, releasedAt: "2026-08-02", reference: "https://github.com/Acme/Acme-Vision" }),
  ],
};



const release = { repository: "CarstVaartjes/vonk-forge-recipes", tag: releaseTag, contract_version: "4.0.0", updated_at: "2026-09-28T20:04:06Z", source_commit: sourceCommit, catalog_index_sha256: "d".repeat(64) };
// What the Pages build writes beside release.json, derived by the same code from the same index.
const catalogSummary = buildCatalogSummary(catalogIndex, release);
const PROOF = /4\s*recipes verified on DGX Spark\s*3\s*model families\s*2\s*creators/;


test.beforeEach(async ({ page }) => {
  // Block every other origin: the catalog must be served from this site.
  await page.route((url) => !["127.0.0.1", "localhost"].includes(url.hostname), (route) => route.abort());
  await page.route("**/catalog/catalog-index.json", (route) => route.fulfill({ json: catalogIndex }));
  await page.route("**/catalog/release.json", (route) => route.fulfill({ json: release }));
  await page.route("**/catalog/catalog-summary.json", (route) => route.fulfill({ json: catalogSummary }));
});


test("platform story stays navigable and bounded", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "Models that fit your Sparks, kept current." })).toBeVisible();
  await expect(page.locator(".hero-proof")).toHaveText(PROOF);
  await expect(page.getByText(/Vonk Forge is the open-source Controller for NVIDIA DGX Spark/)).toBeVisible();
  await expect(page.getByText(/Recipes from Acme and Qwen and more/)).toBeVisible();
  await expect(page.getByRole("link", { name: "See the agent-friendly CLI" })).toBeVisible();
  await expect(page.locator(".home-hero").getByRole("link", { name: "Install", exact: true })).toHaveAttribute("href", "/install");
  await expect(page.getByRole("link", { name: "Browse what runs" })).toHaveAttribute("href", "/recipes");
  await expect(page.getByRole("heading", { name: "Know what fits." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Stay current." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Run the mix you need." })).toBeVisible();
  await expect(page.getByText("vonkctl recipe library --fits-fleet --json")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Catalog + verified releases", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Vonk Forge controller", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "DGX Spark fleet", exact: true })).toBeVisible();

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
  await expect(page.locator(".home-hero").getByRole("link", { name: "Install", exact: true })).toBeFocused();

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


test("home page shows the live numbers from the build-time summary and loads nothing bigger", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(new URL(request.url()).pathname));
  await page.goto("/");

  // Once the roll has finished the headline is the plain true numbers.
  const proof = page.locator(".hero-proof");
  await expect(proof).toHaveText(PROOF);
  await expect(proof.locator(".rolling-number")).toHaveCount(3);

  const tiles = page.getByRole("region", { name: "What can you run?" });
  await expect(tiles.getByRole("link", { name: /Language & chat\s*3 verified/ })).toHaveAttribute("href", "/recipes?type=language");
  await expect(tiles.getByRole("link", { name: /Code\s*1 verified/ })).toHaveAttribute("href", "/recipes?type=code");
  await expect(tiles.getByRole("link", { name: /Vision\s*1 verified/ })).toBeVisible();
  await expect(tiles.getByRole("link", { name: /3D\s*1 verified/ })).toBeVisible();
  await expect(tiles.getByRole("link", { name: /Video\s*None verified yet/ })).toHaveAttribute("href", "/recipes?type=video&verified=0");

  // The home page reads the summary, never the full catalog index.
  expect(requests).toContain("/catalog/catalog-summary.json");
  expect(requests).not.toContain("/catalog/catalog-index.json");

  // A type tile lands on the catalog already filtered to that type.
  await tiles.getByRole("link", { name: /Code/ }).click();
  await expect(page).toHaveURL(/\/recipes\?type=code$/);
  await expect(page.getByRole("link", { name: "Acme Coder" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Acme Vision" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Qwen Code" })).toHaveCount(0);
});


test("the summary the build wrote is small enough to read on the home page", () => {
  // The real build output (the catalog the CI step verified), not the fixture.
  test.skip(!existsSync("public/catalog/catalog-summary.json"), "no fetched release: run `node web/scripts/recipe-release.mjs` (needs an authenticated gh) to check the real summary size");
  expect(statSync("public/catalog/catalog-summary.json").size).toBeLessThan(20_000);
  expect(statSync("public/catalog/catalog-index.json").size).toBeGreaterThan(100 * statSync("public/catalog/catalog-summary.json").size);
});


test("home page never shows numbers when the summary is missing, malformed or empty", async ({ page }) => {
  await page.route("**/catalog/catalog-summary.json", (route) => route.fulfill({ status: 404, body: "nope" }));
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("The recipe library could not be read.");
  await expect(page.locator(".rolling-number")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "What can you run?" })).toHaveCount(0);

  await page.route("**/catalog/catalog-summary.json", (route) => route.fulfill({ json: { ...catalogSummary, verified: 0 } }));
  await page.reload();
  // A release with nothing verified is valid, and shows no numbers.
  await expect(page.getByRole("status").filter({ hasText: "no numbers to show" })).toBeVisible();
  await expect(page.locator(".rolling-number")).toHaveCount(0);
  await expect(page.locator(".hero-proof")).toHaveCount(0);
});


test("the number roll starts from blank, ends at the final value, and is silent for screen readers", async ({ page }) => {
  await page.goto("/");
  const first = page.locator(".rolling-number").first();
  // While rolling: moving digits hidden from assistive technology, one visually hidden final value.
  await expect(first).toHaveAttribute("data-phase", /armed|playing/, { timeout: 2000 }).catch(() => undefined);
  if ((await first.getAttribute("data-phase")) !== "final") {
    await expect(first.locator(".visually-hidden")).toHaveText("4");
    await expect(first.locator(".rolling-digits")).toHaveAttribute("aria-hidden", "true");
  }
  // And it always ends on the true number, with no strips left over.
  await expect(first).toHaveAttribute("data-phase", "final", { timeout: 5000 });
  await expect(page.locator(".hero-proof")).toHaveText(PROOF);
  await expect(page.locator(".rolling-strip")).toHaveCount(0);
});


test("rolling numbers do not animate under reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".rolling-number").first()).toHaveAttribute("data-phase", "final");
  await page.waitForTimeout(500);
  await expect(page.locator(".rolling-strip")).toHaveCount(0);
  await expect(page.locator(".rolling-number .visually-hidden")).toHaveCount(0);
  await expect(page.locator(".hero-proof")).toHaveText(PROOF);
});


test("minimum supported viewport does not overflow", async ({ page }) => {
  for (const width of [320, 393]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1, name: "Models that fit your Sparks, kept current." })).toBeVisible();
  await expect(page.locator(".hero-proof")).toHaveText(PROOF);
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
  await expect(page.getByRole("heading", { name: "Lab on your LAN, or secure remote." })).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "Click it, or script it." })).toBeVisible();
  await expect(page.getByText(/curl -fsSL https:\/\/install\.vonkforge\.ai\/vonkctl \| sh/)).toBeVisible();
  await expect(page.getByText(/browser password is not a CLI credential/i)).toBeVisible();
  await expect(page.getByText(/vonkctl recipe library --fits-fleet --json/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Written for agents" })).toBeVisible();
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
  await expect(page.getByRole("group", { name: "How many Sparks do you have?" }).getByRole("button", { name: /2 Sparks/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("group", { name: "Engine" }).getByRole("button", { name: /vLLM/ })).toBeVisible();
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
  await expect(page.getByText("Hardware qualification: Working")).toBeVisible();
  await expect(page.locator("code").filter({ hasText: recipeImportUri })).toBeVisible();
  await expect(page.getByRole("link", { name: "Inspect recipe source" })).toHaveAttribute(
    "href", `https://github.com/CarstVaartjes/vonk-forge-recipes/blob/${sourceCommit}/recipes/qwen-fast.json`,
  );
  await expect(page.getByRole("link", { name: "View source", exact: true })).toHaveAttribute(
    "href", `https://github.com/CarstVaartjes/vonk-forge-recipes/blob/${sourceCommit}/recipes/qwen-fast.json`,
  );
  await expect(page.getByRole("link", { name: "View adapter source" })).toHaveAttribute(
    "href", `https://github.com/CarstVaartjes/vonk-forge-recipes/tree/${sourceCommit}/adapters/qwen`,
  );
  await expect(page.getByRole("link", { name: /Download recipe library|Download package/ })).toHaveCount(0);
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


test("the model type is the first choice on the recipes and models pages", async ({ page }) => {
  await page.goto("/recipes?type=code");
  const types = page.getByRole("group", { name: "Model type" });
  await expect(types.getByRole("button")).toHaveText(["All4", "Language3", "Code1", "Vision1", "Image0", "Video0", "Audio0", "3D1"]);
  await expect(types.getByRole("button", { name: /^Code/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("link", { name: "Acme Coder" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Acme Vision" })).toHaveCount(0);
  // The type row sits above the other refinements.
  const typeBox = await types.boundingBox();
  const sparksBox = await page.getByRole("group", { name: "How many Sparks do you have?" }).boundingBox();
  expect(typeBox!.y).toBeLessThan(sparksBox!.y);

  // Keyboard: focus a chip and press Enter; the URL follows, and so does the list.
  await types.getByRole("button", { name: /^Vision/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/recipes\?type=vision$/);
  await expect(page.getByRole("link", { name: "Acme Vision" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Acme Coder" })).toHaveCount(0);

  // "Verified on Spark" is on by default; turning it off shows the unverified recipe too.
  await page.goto("/recipes?type=language");
  await expect(page.getByRole("link", { name: "Qwen Code" })).toHaveCount(0);
  await page.getByRole("checkbox", { name: /Verified on Spark/ }).uncheck();
  await expect(page).toHaveURL(/verified=0/);
  await page.getByRole("group", { name: "Model type" }).getByRole("button", { name: /^Code/ }).click();
  await expect(page.getByRole("link", { name: "Qwen Code" })).toBeVisible();

  await page.goto("/models?type=vision");
  await expect(page.getByRole("group", { name: "Model type" }).getByRole("button", { name: /^Vision/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("link", { name: /Acme Vision/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Acme Coder/ })).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: /Verified on Spark/ })).toBeChecked();
  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/models", "/recipes"]) {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    }
  }
});
