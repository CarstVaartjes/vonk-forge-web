import { existsSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";

import { expect, test } from "@playwright/test";

import { catalogIndex, catalogSummary, routeRelease } from "./release-fixture.ts";
import { recipeDigest, sourceCommit } from "../src/api/e2e-catalog.fixture.ts";


const recipeImportUri = `vonk://catalog/vonk-forge/qwen-fast@sha256:${recipeDigest}`;
// The picker's answer with nothing picked: every verified recipe, out of the whole catalog.
const ANSWER = new RegExp(`^4\\s*recipes verified on a real DGX Spark, out of ${catalogSummary.total} in the catalog\\.$`);


test.beforeEach(({ page }) => routeRelease(page));


test("platform story stays navigable and bounded", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "Models that fit your Sparks, kept current." })).toBeVisible();
  await expect(page.locator(".answer")).toHaveText(ANSWER);
  await expect(page.getByText(/Vonk Forge is the open-source Controller for NVIDIA DGX Spark/)).toBeVisible();
  await expect(page.getByText(/Recipes from Acme and qwen and more/)).toBeVisible();
  await expect(page.getByRole("link", { name: "See the agent-friendly CLI" })).toBeVisible();
  await expect(page.locator(".home-hero").getByRole("link", { name: "Install", exact: true })).toHaveAttribute("href", "/install");
  await expect(page.getByRole("link", { name: "Browse what runs" })).toHaveAttribute("href", "/recipes");
  await expect(page.getByRole("heading", { name: "Know what fits." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Stay current." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Run the mix you need." })).toBeVisible();
  await expect(page.getByText("vonkctl recipe library --fits-fleet --json").first()).toBeVisible();
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
  // The first stop after the skip link is the Spark picker, the first control of the hero.
  await expect(page.getByRole("button", { name: "1 Spark", exact: true })).toBeFocused();

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("html")).toHaveCSS("scroll-behavior", "auto");

  // The faint ink on every surface, in both themes (the build may shorten #ffffff to #fff).
  const minimumFaintContrast = await page.evaluate(() => {
    const parseHex = (value: string) => {
      const digits = value.trim().replace("#", "");
      const hex = digits.length === 3 ? [...digits].map((digit) => digit + digit).join("") : digits;
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
    return Math.min(...["dark", "light"].flatMap((theme) => {
      document.documentElement.setAttribute("data-theme", theme);
      const styles = getComputedStyle(document.documentElement);
      const foreground = styles.getPropertyValue("--faint");
      return ["--bg", "--panel", "--raised"].map((token) => contrast(foreground, styles.getPropertyValue(token)));
    }));
  });
  expect(minimumFaintContrast).toBeGreaterThanOrEqual(4.5);
});


test("home page shows the live numbers from the build-time summary and loads nothing bigger", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(new URL(request.url()).pathname));
  await page.goto("/");

  // Once the roll has finished the answer is the plain true number.
  await expect(page.locator(".answer")).toHaveText(ANSWER);

  const chips = page.getByRole("group", { name: "Model type" });
  await expect(chips.getByRole("button", { name: "Language 3" })).toBeVisible();
  await expect(chips.getByRole("button", { name: "Code 1" })).toBeVisible();
  await expect(chips.getByRole("button", { name: "Video 0" })).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByRole("group", { name: /The recipe catalog/ }).getByRole("link")).toHaveCount(catalogSummary.total);

  // Kept current and verified on hardware draw from the same summary.
  await expect(page.getByRole("group", { name: /^Recipes released per week: / })).toBeVisible();
  await expect(page.getByRole("group", { name: /^Most recent hardware pass per recipe, by day, last 28 days: / })).toBeVisible();

  // The home page reads the summary, never the full catalog index.
  expect(requests).toContain("/catalog/catalog-summary.json");
  expect(requests).not.toContain("/catalog/catalog-index.json");

  // The picker's choice reaches the catalog filtered the same way, and survives a reload.
  await page.getByRole("button", { name: "2 Sparks" }).click();
  await chips.getByRole("button", { name: /^Code/ }).click();
  await expect(page).toHaveURL(/\/\?sparks=2&type=code$/);
  await page.reload();
  await expect(page.getByRole("button", { name: "2 Sparks" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: /^See all 1 in the catalog/ }).click();
  await expect(page).toHaveURL(/\/recipes\?sparks=2&type=code$/);
  await expect(page.getByRole("link", { name: "Acme Coder" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Acme Vision" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Qwen Code" })).toHaveCount(0);
});


test("the Spark count picked on the home page is the catalog's first filter, and clearing it restores the list", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "1 Spark", exact: true }).click();
  await page.goto("/recipes?verified=0");
  const sparks = page.getByRole("group", { name: "How many Sparks do you have?" });
  await expect(sparks.getByRole("button", { name: /^1 Spark:/ })).toHaveAttribute("aria-pressed", "true");
  const all = page.getByRole("region", { name: "Recipe results" }).getByText(/of \d+ recipes/);
  const narrowed = await all.textContent();
  await sparks.getByRole("button", { name: /^Any count/ }).click();
  await expect(all).not.toHaveText(narrowed!);
  await page.reload();
  await expect(sparks.getByRole("button", { name: /^1 Spark:/ })).toHaveAttribute("aria-pressed", "false");
});


test("a recipe opens from the picker's results, and a creator opens the catalog filtered to them", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "2 Sparks" }).click();
  const result = page.locator(".fit-results li a").first();
  const title = (await result.textContent())!;
  await result.click();
  await expect(page).toHaveURL(/\/recipes\/[^/]+\/[^/]+$/);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();

  await page.goto("/");
  const creator = page.locator(".creators a").first();
  const name = (await creator.textContent())!;
  await expect(page.getByRole("meter", { name: `${name}: verified recipes` })).toBeVisible();
  await creator.click();
  await expect(page).toHaveURL(/\/recipes\?creator=/);
  await expect(page.getByText(`Creator: ${name}`)).toBeVisible();
});


test("the summary the build wrote is small enough to read on the home page", () => {
  // The real build output (the catalog the CI step verified), not the fixture.
  test.skip(!existsSync("public/catalog/catalog-summary.json"), "no fetched release: run `node web/scripts/recipe-release.mjs` (needs an authenticated gh) to check the real summary size");
  // The wall carries one row per recipe: the budget is 40 kB gzipped, not a raw size.
  expect(gzipSync(readFileSync("public/catalog/catalog-summary.json")).length).toBeLessThan(40_000);
  expect(statSync("public/catalog/catalog-index.json").size).toBeGreaterThan(20 * statSync("public/catalog/catalog-summary.json").size);
});


test("home page never shows numbers when the summary is missing, malformed or empty", async ({ page }) => {
  await page.route("**/catalog/catalog-summary.json", (route) => route.fulfill({ status: 404, body: "nope" }));
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("The recipe library could not be read.");
  await expect(page.locator(".rolling-number")).toHaveCount(0);
  await expect(page.getByRole("group", { name: /The recipe catalog/ })).toHaveCount(0);

  await page.route("**/catalog/catalog-summary.json", (route) => route.fulfill({ json: { ...catalogSummary, verified: 0 } }));
  await page.reload();
  // A release with nothing verified is valid, and shows no numbers.
  await expect(page.getByRole("status").filter({ hasText: "no numbers to show" })).toBeVisible();
  await expect(page.locator(".rolling-number")).toHaveCount(0);
  await expect(page.locator(".answer")).toHaveCount(0);
});


test("the number roll starts from blank, ends at the final value, and is silent for screen readers", async ({ page }) => {
  await page.goto("/");
  const first = page.locator(".answer .rolling-number");
  await first.scrollIntoViewIfNeeded();
  // While rolling: moving digits hidden from assistive technology, one visually hidden final value.
  await expect(first).toHaveAttribute("data-phase", /armed|playing/, { timeout: 2000 }).catch(() => undefined);
  if ((await first.getAttribute("data-phase")) !== "final") {
    await expect(first.locator(".visually-hidden")).toHaveText("4");
    await expect(first.locator(".rolling-digits")).toHaveAttribute("aria-hidden", "true");
  }
  // And it always ends on the true number, with no strips left over.
  await expect(first).toHaveAttribute("data-phase", "final", { timeout: 5000 });
  await expect(page.locator(".answer")).toHaveText(ANSWER);
  await expect(page.locator(".answer .rolling-strip")).toHaveCount(0);
});


test("rolling numbers do not animate under reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".rolling-number").first()).toHaveAttribute("data-phase", "final");
  await page.waitForTimeout(500);
  await expect(page.locator(".answer .rolling-strip")).toHaveCount(0);
  await expect(page.locator(".rolling-number .visually-hidden")).toHaveCount(0);
  await expect(page.locator(".answer")).toHaveText(ANSWER);
});


test("minimum supported viewport does not overflow", async ({ page }) => {
  for (const width of [320, 393]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1, name: "Models that fit your Sparks, kept current." })).toBeVisible();
  await expect(page.locator(".answer")).toHaveText(ANSWER);
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
  // Below 64rem the links sit behind the Menu button, so address the link by its place, not its role.
  await expect(page.locator("#primary-nav a", { hasText: "Docs" })).toHaveAttribute("aria-current", "page");
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
  await expect(page.getByRole("heading", { name: "Choose a control path" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "One Spark", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Many Sparks", exact: true })).toBeVisible();
  await expect(page.getByText(/VONK_CONTROLLER_ADDRESS=192\.168\.1\.231/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Prove the private route before enrolling Sparks." })).toBeVisible();
  await expect(page.locator(".verification-grid").getByText("Self.PrimaryRoutes")).toBeVisible();
  await expect(page.locator('[aria-label="Exact Tailscale Serve map"]')).toContainText("svc:vonk-forgeHTTPS 443 → http://caddy:8080");
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
  await expect(page.getByLabel("Filter by Sparks you have")).toHaveValue("2");
  await expect(page.getByRole("group", { name: "How many Sparks do you have?" }).getByRole("button", { name: /2 Sparks/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("group", { name: "Engine" }).getByRole("button", { name: /vLLM/ })).toBeVisible();
  await expect(page.getByLabel("Filter by abliterated")).toHaveValue("false");
  await expect(page.getByLabel("Filter by capability")).toContainText("1 selected");
  await expect(page.getByLabel("Filter by model family")).toBeVisible();
  await expect(page.getByLabel("Filter by model", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Filter by quantization")).toBeVisible();
  await expect(page.getByLabel("Filter by Sparks you have")).toBeVisible();
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
  // The header carries the verdict and the run command; the exact trust facts sit under Provenance.
  await expect(page.getByRole("heading", { level: 1, name: "Qwen Fast" })).toBeVisible();
  await expect(page.getByLabel("Hardware evidence")).toContainText("Working");
  await expect(page.locator(".command-block code")).toHaveText("vonkctl run \"Qwen Fast\"");
  await page.locator(".provenance > summary").click();
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
  await expect(types.getByRole("button")).toHaveText(["All4", "Language3", "Code1", "Vision1", "Image0", "Video0", "Audio0", "3D1", "Other0"]);
  await expect(types.getByRole("button", { name: /^Code/ })).toHaveAttribute("aria-pressed", "true");
  // The words come from the release vocabulary: all 26 capabilities are offered, and the legend gives a status its published meaning.
  await expect(page.getByLabel("Filter by capability").locator("option")).toHaveCount(27);
  await expect(page.locator("#how-recipes-are-verified")).toContainText("Passed on a real DGX Spark for this exact recipe, runtime image and model.");
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
