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
  await expect(page.getByText("vonkctl recipe library --fits-fleet --limit 5").first()).toBeVisible();
  await expect(page.getByText("vonkctl profile endpoint", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Newest verified recipes" })).toHaveCount(0);
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


test("picking 2 Sparks offers two linked choices, each opening exactly that count in the catalog", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "2 Sparks" }).click();
  const choices = page.getByRole("list", { name: "How to use your Sparks" });
  await expect(choices.getByRole("listitem")).toHaveCount(2);
  await expect(choices.getByRole("listitem").first()).toContainText("Newest: Acme Coder");
  await choices.getByRole("link", { name: /^3\s*run on one Spark/ }).click();
  await expect(page).toHaveURL(/\/recipes\?sparks=2&uses=1$/);
  const results = page.getByRole("region", { name: "Recipe results" }).getByText(/of \d+ recipes/);
  await expect(results).toHaveText(/^3 of /);
  await expect(page.getByRole("link", { name: "Acme Coder" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Qwen Fast" })).toHaveCount(0);
  await page.goto("/");
  await page.getByRole("list", { name: "How to use your Sparks" }).getByRole("link", { name: /^1\s*use all of your Sparks/ }).click();
  await expect(page).toHaveURL(/\/recipes\?sparks=2&uses=2$/);
  await expect(page.getByRole("region", { name: "Recipe results" }).getByText(/of \d+ recipes/)).toHaveText(/^1 of /);
  await expect(page.getByRole("link", { name: "Qwen Fast" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Acme Coder" })).toHaveCount(0);
});


test("the Spark count picked on the home page is the catalog's first filter, and clearing it restores the list", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "1 Spark", exact: true }).click();
  await page.goto("/recipes?verified=0");
  const sparks = page.getByRole("group", { name: "How many Sparks do you have?" });
  await expect(sparks.getByRole("button", { name: /^1 Spark \d/ })).toHaveAttribute("aria-pressed", "true");
  const all = page.getByRole("region", { name: "Recipe results" }).getByText(/of \d+ recipes/);
  const narrowed = await all.textContent();
  await sparks.getByRole("button", { name: /^Any/ }).click();
  await expect(all).not.toHaveText(narrowed!);
  await page.reload();
  await expect(sparks.getByRole("button", { name: /^1 Spark \d/ })).toHaveAttribute("aria-pressed", "false");
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


test("the count is the real number on first paint, with no roll from zero", async ({ page }) => {
  await page.goto("/");
  // Immediate and non-retrying: a count-up on load would already have strips in the DOM.
  expect(await page.locator(".answer .rolling-strip").count()).toBe(0);
  await expect(page.locator(".answer")).toHaveText(ANSWER);
});

test("the count rolls when the visitor changes the pick", async ({ page }) => {
  await page.goto("/");
  const picker = page.getByRole("group", { name: "How many Sparks do you have?" });
  await picker.getByRole("button", { name: /^1 Spark/ }).click();
  const strip = page.locator(".answer .rolling-number .rolling-strip").first();
  await expect(strip).toBeAttached();
  await expect.poll(() => strip.evaluate((element) => element.getAnimations().length)).toBeGreaterThan(0);
  await expect(page.locator(".answer .rolling-number .rolling-strip")).toHaveCount(0, { timeout: 4000 });
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
  await expect(page.getByRole("heading", { name: "From the catalog to your Controller" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Available globally" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Prepared locally" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Run on Sparks" })).toBeVisible();
  await expect(page.getByText(/Model files downloaded and verified on your Controller/i)).toBeVisible();
  await expect(page.getByText(/container image—the software needed to run the model—has been downloaded or built and cached on your Controller/i)).toBeVisible();
  await expect(page.getByText(/Local means cached on your Controller. Running starts when you choose Run. Recipe definitions stay in the global repository/i)).toBeVisible();
  await expect(page.getByText(/Profiles remember your model, recipe, and Spark assignments/i)).toBeVisible();

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(horizontalOverflow).toBeLessThanOrEqual(0);
});


test("architecture, installation, and control guides stay navigable at 1…N scale", async ({ page }) => {
  await page.goto("/architecture");
  // Below 64rem the links sit behind the Menu button, so address the link by its place, not its role.
  await expect(page.locator("#primary-nav a", { hasText: "How it works" })).toHaveAttribute("aria-current", "page");
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
  await expect(page.getByRole("heading", { name: "Lab mode: from this page to a signed-in Controller" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Run the Secure remote installer" })).toBeVisible();
  await expect(page.getByText(/this laptop for a lab/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Secure remote with Tailscale" })).toBeVisible();
  const preflightHeading = page.getByRole("heading", { name: "Complete private HTTPS setup first." });
  const controllerCommand = page.getByText("curl -fsSL https://install.vonkforge.ai/nas | sh").last();
  await expect(preflightHeading).toBeVisible();
  await expect(controllerCommand).toBeVisible();
  expect(await preflightHeading.evaluate((preflight) => {
    const command = [...document.querySelectorAll(".command-block code")]
      .findLast((candidate) => candidate.textContent === "curl -fsSL https://install.vonkforge.ai/nas | sh");
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
  await expect(page.getByText(/this site cannot show a complete command/)).toBeVisible();
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
  await expect(page.getByText(/vonkctl recipe library --fits-fleet --limit 5/)).toBeVisible();
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
  await expect(page.getByRole("group", { name: "How many Sparks do you have?" }).getByRole("button", { name: /2 Sparks/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByText("More filters").click();
  await expect(page.getByRole("group", { name: "Engine" }).getByRole("button", { name: /vLLM/ })).toBeVisible();
  await expect(page.getByLabel("Filter by abliterated")).toHaveValue("false");
  await expect(page.getByRole("group", { name: "Capabilities" }).getByRole("button", { pressed: true })).toHaveCount(1);
  await expect(page.getByRole("group", { name: "Family" })).toBeVisible();
  for (const label of ["Filter by model", "Filter by updated date", "Filter by execution readiness", "Filter by original repository", "Filter by download size", "Filter by disk per spark", "Filter by memory per spark"]) await expect(page.getByLabel(label, { exact: true })).toBeVisible();
  if (!(await page.evaluate(() => window.innerWidth < 700))) {
    await expect(page.getByRole("columnheader")).toHaveCount(6);
    await expect(page.getByRole("row").nth(1).getByRole("cell")).toHaveCount(6);
  }
  await expect(page.getByRole("link", { name: "Qwen Fast" })).toBeVisible();
  await expect(page.getByText(/Source verified/)).toBeVisible();
  await page.getByRole("link", { name: "Qwen Fast" }).click();
  // The header carries the verdict and the run command; the exact trust facts sit under Provenance.
  await expect(page.getByRole("heading", { level: 1, name: "Qwen Fast" })).toBeVisible();
  await expect(page.getByLabel("Hardware evidence")).toContainText("Working");
  await expect(page.locator(".command-block code")).toHaveText("vonkctl --profile 1 run \"Qwen Fast\"");
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


test("a status badge opens the collapsed legend and scrolls it into view", async ({ page }) => {
  await page.goto("/recipes");
  const legend = page.locator("#how-recipes-are-verified");
  await expect(page.locator("details.catalog-more")).not.toHaveAttribute("open", "");
  await expect(legend).toBeHidden();
  await page.locator("a.badge-link").first().click();
  await expect(page.locator("details.catalog-more")).toHaveAttribute("open", "");
  await expect(legend).toBeVisible();
  await expect(legend).toBeInViewport();
});


test("the model type is the first choice on the recipes and models pages", async ({ page }) => {
  await page.goto("/recipes?type=code");
  const types = page.getByRole("group", { name: "Model type" });
  await expect(types.getByRole("button")).toHaveText(["All 4", "Language 3", "Code 1", "Vision 1", "Image 0", "Video 0", "Audio 0", "3D 1", "Other 0"]);
  await expect(types.getByRole("button", { name: /^Code/ })).toHaveAttribute("aria-pressed", "true");
  // The words come from the release vocabulary: all 26 capabilities are offered, and the legend gives a status its published meaning.
  await page.getByText("More filters").click();
  await expect(page.getByRole("group", { name: "Capabilities" }).getByRole("button")).toHaveCount(26);
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
  await page.getByText("More filters").click();
  await page.getByRole("checkbox", { name: /Verified on Spark/ }).uncheck();
  await expect(page).toHaveURL(/verified=0/);
  await page.getByRole("group", { name: "Model type" }).getByRole("button", { name: /^Code/ }).click();
  await expect(page.getByRole("link", { name: "Qwen Code" })).toBeVisible();

  await page.goto("/models?type=vision");
  await expect(page.getByRole("group", { name: "Model type" }).getByRole("button", { name: /^Vision/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("link", { name: /Acme Vision/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Acme Coder/ })).toHaveCount(0);
  await page.getByText("More filters").click();
  await expect(page.getByRole("checkbox", { name: /Verified on Spark/ })).toBeChecked();
  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/models", "/recipes"]) {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    }
  }
});

test("the first recipe is on the first screen on desktop and on a phone, with the column filters behind one tap", async ({ page }) => {
  const firstRecipeTop = async () => {
    await page.goto("/recipes");
    const link = page.locator(".catalog-table-recipe a").first();
    await expect(link).toBeVisible();
    return (await link.boundingBox())!.y + (await page.evaluate(() => window.scrollY));
  };
  await page.setViewportSize({ width: 1280, height: 720 });
  expect(await firstRecipeTop()).toBeLessThan(720);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await firstRecipeTop()).toBeLessThan(844);
  const toggle = page.getByText("More filters", { exact: true });
  // Search stays in view; the other filters wait behind the one button.
  await expect(page.getByRole("searchbox", { name: "Search recipes" })).toBeVisible();
  await expect(page.getByLabel("Filter by updated date")).toBeHidden();
  await toggle.click();
  await expect(page.getByLabel("Filter by updated date")).toBeVisible();
  // The refinements stay one click away, and a link to the status legend opens them.
  await page.goto("/recipes#how-recipes-are-verified");
  await expect(page.locator("#how-recipes-are-verified")).toBeVisible();
});


test("the recipe table has few Tab stops before its first row, and its filters sit behind one disclosure", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/recipes");
  const stops = await page.getByRole("region", { name: "Recipe results" }).evaluate((section) => {
    const focusable = [...section.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), summary, [tabindex]")]
      .filter((element) => element.tabIndex >= 0 && element.checkVisibility());
    const firstRow = section.querySelector("tbody tr");
    return focusable.filter((element) => !firstRow || Boolean(element.compareDocumentPosition(firstRow) & Node.DOCUMENT_POSITION_FOLLOWING)).length;
  });
  expect(stops).toBeLessThanOrEqual(10);
  await expect(page.getByRole("columnheader")).toHaveCount(6);
  await expect(page.locator("thead select, thead input")).toHaveCount(0);
});

test("Reset filters brings back Verified on Spark and says so", async ({ page }) => {
  await page.goto("/recipes?verified=0&type=code");
  await expect(page.getByLabel("Applied filters")).not.toContainText("Verified on Spark");
  const reset = page.getByRole("button", { name: /^Reset filters/ });
  await expect(reset).toContainText("to Verified on Spark");
  await reset.click();
  await expect(page).toHaveURL(/\/recipes$/);
  await expect(page.getByLabel("Applied filters")).toContainText("Verified on Spark");
  await expect(page.getByRole("button", { name: /^Reset filters/ })).toHaveCount(0);
});

test("a phone shows a model type strip, a five-segment Spark bar, one tall Filters button and two recipe cards above the fold", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/recipes?verified=0");
  const bar = page.getByRole("group", { name: "How many Sparks do you have?" }).getByRole("button");
  await expect(bar).toHaveCount(5);
  const widths = await bar.evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().width));
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(2);
  // The visible text starts each accessible name (WCAG 2.5.3).
  await expect(bar.nth(3)).toHaveAccessibleName(/^4\+/);
  await expect(bar.nth(4)).toHaveAccessibleName(/^Any/);
  const strip = page.getByRole("group", { name: "Model type" });
  expect(await strip.evaluate((element) => element.scrollWidth > element.clientWidth && element.getBoundingClientRect().height < 80)).toBe(true);
  expect((await page.locator(".catalog-more > summary").boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const above = await page.locator("tbody tr").evaluateAll((rows) => rows.filter((row) => row.getBoundingClientRect().bottom <= window.innerHeight).length);
  expect(above).toBeGreaterThanOrEqual(2);
});

test("the table fits its panel just above and below the phone breakpoint", async ({ page }) => {
  for (const width of [701, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/recipes?verified=0");
    await expect(page.locator("tbody tr").first()).toBeVisible();
    const fit = await page.evaluate(() => ({ table: document.querySelector(".catalog-table")!.scrollWidth, panel: document.querySelector(".catalog-browser")!.clientWidth }));
    expect(fit.table, `${width}px`).toBeLessThanOrEqual(fit.panel);
  }
});
