import { expect, test, type Page } from "@playwright/test";

import { routeRelease } from "./release-fixture.ts";

test.beforeEach(({ page }) => routeRelease(page));

async function at(page: Page, width: number, height: number, path: string): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto(path, { waitUntil: "networkidle" });
}

// The four step cards under the Install headline: how many distinct rows they sit on.
async function stepRows(page: Page): Promise<{ rows: number; widest: number; right: number }> {
  const boxes = await page.getByRole("navigation", { name: "Installation steps" }).or(page.locator('[aria-label="Installation steps"]')).first().getByRole("link").evaluateAll((links) => links.map((link) => link.getBoundingClientRect()));
  const main = await page.locator("main").evaluate((element) => element.getBoundingClientRect().right);
  return { rows: new Set(boxes.map((box) => Math.round(box.top))).size, widest: Math.max(...boxes.map((box) => box.width)), right: main - Math.max(...boxes.map((box) => box.right)) };
}

test("install: the four step cards fill the width in one row, two by two, then one column", async ({ page }) => {
  await at(page, 1440, 900, "/install");
  let layout = await stepRows(page);
  expect(layout.rows).toBe(1);
  expect(layout.right, "the row reaches the right edge of the content").toBeLessThan(40);
  await at(page, 800, 900, "/install");
  layout = await stepRows(page);
  expect(layout.rows).toBe(2);
  await at(page, 390, 844, "/install");
  layout = await stepRows(page);
  expect(layout.rows).toBe(4);
});

test("install: the Spark enrollment snippet says it is an illustrative preview", async ({ page }) => {
  await at(page, 1440, 900, "/install");
  const note = page.getByText("Illustrative preview.");
  await expect(note).toBeVisible();
  await expect(note.locator("..")).toContainText("GRANT_UUID");
});

test("models: the Spark picker is one compact row and the first model starts on the first screen", async ({ page }) => {
  await at(page, 1440, 900, "/models");
  const group = page.getByRole("group", { name: "How many Sparks do you have?" });
  await expect(group).toBeVisible();
  expect((await group.boundingBox())!.height).toBeLessThan(80);
  const row = page.getByRole("list", { name: "Models" }).getByRole("link").first();
  await expect(row).toBeVisible();
  expect((await row.boundingBox())!.y).toBeLessThan(900);
});

test("models: a model version links straight to its recipe page", async ({ page }) => {
  await at(page, 1440, 900, "/models");
  await page.getByRole("list", { name: "Models" }).getByRole("link").first().click();
  const link = page.locator(".model-recipe-links a").first();
  await expect(link).toBeVisible();
  expect(await link.getAttribute("href")).toMatch(/^\/recipes\/[^/?]+\/[^/?]+$/);
});

test("recipe page: the Run it command uses --profile 1, explains it, and scrolls safely", async ({ page }) => {
  test.skip(Boolean(process.env.VONK_E2E_DOWNLOADED_LIBRARY), "the fixture names the recipe");
  await at(page, 320, 700, "/recipes/vonk-forge/qwen-fast");
  const run = page.getByRole("region", { name: "Run it" });
  await expect(run.locator("pre").first()).toContainText("vonkctl --profile 1 run");
  await expect(run).toContainText("vonkctl profile list");
  await expect(run).not.toContainText("--profile 2");
  const pre = run.locator("pre").first();
  const style = await pre.evaluate((element) => { const css = getComputedStyle(element); return { overflowX: css.overflowX, padding: parseFloat(css.paddingRight) }; });
  expect(["auto", "scroll"]).toContain(style.overflowX);
  expect(style.padding).toBeGreaterThanOrEqual(24);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});

test("recipe page: What this means opens inside the hardware evidence card without leaving", async ({ page }) => {
  test.skip(Boolean(process.env.VONK_E2E_DOWNLOADED_LIBRARY), "the fixture names the recipe");
  await at(page, 1440, 900, "/recipes/vonk-forge/qwen-fast");
  await expect(page.getByRole("link", { name: "What this means" })).toHaveCount(0);
  const card = page.getByRole("region", { name: "Hardware evidence" });
  const summary = card.getByText("What this means", { exact: true });
  await summary.click();
  await expect(card.locator("details[open] .receipt-meaning")).not.toBeEmpty();
  expect(new URL(page.url()).pathname).toBe("/recipes/vonk-forge/qwen-fast");
});

for (const width of [320, 768, 1920]) {
  for (const path of ["/install", "/models", "/recipes/vonk-forge/qwen-fast"]) {
    test(`${path} at ${width}px has no horizontal overflow`, async ({ page }) => {
      test.skip(path.includes("qwen-fast") && Boolean(process.env.VONK_E2E_DOWNLOADED_LIBRARY), "the fixture names the recipe");
      await at(page, width, 900, path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    });
  }
}
