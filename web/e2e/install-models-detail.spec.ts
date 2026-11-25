import { expect, test, type Page } from "@playwright/test";

import { routeRelease } from "./release-fixture.ts";

test.beforeEach(({ page }) => routeRelease(page));

async function at(page: Page, width: number, height: number, path: string): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto(path, { waitUntil: "networkidle" });
}

// The first recipe of the list (verified by default), whichever library is served.
async function openFirstRecipe(page: Page, width: number): Promise<void> {
  await at(page, width, 900, "/recipes");
  await page.locator("tbody tr").first().getByRole("link").first().click();
  await expect(page.getByRole("region", { name: "Run it" })).toBeVisible();
}

// The four step cards under the Install headline: how many distinct rows they sit on.
async function stepRows(page: Page): Promise<{ rows: number; right: number }> {
  const boxes = await page
    .getByRole("navigation", { name: "Installation steps" })
    .getByRole("link")
    .evaluateAll((links) => links.map((link) => link.getBoundingClientRect()));
  const main = await page
    .locator("main")
    .evaluate((element) => element.getBoundingClientRect().right);
  return {
    rows: new Set(boxes.map((box) => Math.round(box.top))).size,
    right: main - Math.max(...boxes.map((box) => box.right)),
  };
}

test("install: the four step cards fill the width in one row, two by two, then one column", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "desktop 1440px layout; the phone project covers 390px");
  await at(page, 1440, 900, "/install");
  const wide = await stepRows(page);
  expect(wide.rows).toBe(1);
  expect(wide.right, "the row reaches the right edge of the content").toBeLessThan(40);
  await at(page, 800, 900, "/install");
  expect((await stepRows(page)).rows).toBe(2);
  await at(page, 390, 844, "/install");
  expect((await stepRows(page)).rows).toBe(4);
});

test("install: the Spark enrollment snippet says it is an illustrative preview", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "desktop 1440px layout; the phone project covers 390px");
  await at(page, 1440, 900, "/install");
  const note = page.getByText("Illustrative preview.");
  await expect(note).toBeVisible();
  await expect(note.locator("..")).toContainText("GRANT_UUID");
});

test("models: the Spark picker is one compact row and the first model starts on the first screen", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "desktop 1440px layout; the phone project covers 390px");
  await at(page, 1440, 900, "/models");
  const group = page.getByRole("group", { name: "How many Sparks do you have?" });
  await expect(group).toBeVisible();
  expect((await group.boundingBox())!.height).toBeLessThan(80);
  const row = page.getByRole("list", { name: "Models" }).getByRole("link").first();
  await expect(row).toBeVisible();
  expect((await row.boundingBox())!.y).toBeLessThan(900);
});

test("models: a filter set in the URL is counted on More filters, and the summary is a 44px target", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "desktop 1440px layout; the phone project covers 390px");
  await at(page, 1440, 900, "/models?engine=vllm&verified=0");
  const more = page.getByText("More filters");
  await expect(more).toContainText("(2 active)");
  expect((await more.boundingBox())!.height).toBeGreaterThanOrEqual(44);
});

test("recipe page: Run it uses --profile 1 and explains it, with no horizontal overflow at 320px", async ({
  page,
}) => {
  await openFirstRecipe(page, 320);
  const run = page.getByRole("region", { name: "Run it" });
  await expect(run.locator("pre").first()).toContainText("vonkctl --profile 1 run");
  await expect(run).toContainText("vonkctl profile list");
  const box = run.locator("pre").first();
  await box
    .locator("code")
    .last()
    .evaluate((code) => {
      code.append(" 'Sage S2.1 Flash Mixed NVFP4 TensorFold dual Spark (Bizuayeu)'");
    });
  expect(await box.evaluate((pre) => pre.scrollWidth - pre.clientWidth)).toBeLessThanOrEqual(0);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
  ).toBeLessThanOrEqual(0);
});

test("recipe page: What this means opens inside the hardware evidence card, and both summaries are 44px targets", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "desktop 1440px layout; the phone project covers 390px");
  await openFirstRecipe(page, 1440);
  const card = page.getByRole("region", { name: "Hardware evidence" });
  const summary = card.getByText("What this means", { exact: true });
  const meaning = summary.locator("xpath=following-sibling::p");
  const url = page.url();
  await expect(meaning).toBeHidden();
  await summary.click();
  await expect(meaning).toBeVisible();
  await expect(meaning).not.toBeEmpty();
  expect(page.url()).toBe(url);
  for (const name of ["What this means", "Details"]) {
    expect(
      (await card.getByText(name, { exact: true }).boundingBox())!.height,
      name,
    ).toBeGreaterThanOrEqual(44);
  }
});
