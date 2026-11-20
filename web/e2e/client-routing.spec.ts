import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { routeRelease } from "./release-fixture.ts";

test.beforeEach(({ page }) => routeRelease(page));

// Marks the document so a reload is visible, and records whether a loading panel is ever drawn.
async function watchNavigation(page: Page): Promise<void> {
  await page.evaluate(() => {
    const seen = window as unknown as { __document: boolean; __loading: boolean };
    seen.__document = true;
    seen.__loading = false;
    new MutationObserver(() => { if (/Loading (the public|immutable)/.test(document.body.textContent ?? "")) seen.__loading = true; }).observe(document.body, { childList: true, subtree: true, characterData: true });
  });
}

const sameDocument = (page: Page) => page.evaluate(() => (window as unknown as { __document?: boolean }).__document === true);
const sawLoading = (page: Page) => page.evaluate(() => (window as unknown as { __loading: boolean }).__loading);

test("recipes, a recipe and back: one document, one index request, no loading text, scroll and heading kept", async ({ page }) => {
  const indexRequests: string[] = [];
  page.on("request", (request) => { if (request.url().endsWith("/catalog/catalog-index.json")) indexRequests.push(request.url()); });
  await page.goto("/recipes", { waitUntil: "networkidle" });
  await expect(page.locator("tbody tr").first()).toBeVisible();
  await watchNavigation(page);
  expect(indexRequests).toHaveLength(1);

  const link = page.locator("tbody tr").last().getByRole("link").first();
  await link.scrollIntoViewIfNeeded();
  const scrolled = await page.evaluate(() => window.scrollY);
  const href = await link.getAttribute("href");
  await link.click();
  await expect(page).toHaveURL(new RegExp(`${href}$`));
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await expect(page).toHaveTitle(/ · Vonk Forge$/);

  await page.goBack();
  await expect(page).toHaveURL(/\/recipes(\?.*)?$/);
  await expect(page.locator("tbody tr").first()).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrolled - 5);

  await page.getByRole("link", { name: "Models", exact: true }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: /Models, with their exact versions/ })).toBeVisible();
  await page.goBack();
  await page.goForward();
  await page.getByRole("link", { name: "Vonk Forge home" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Models that fit your Sparks/ })).toBeFocused();
  await expect(page).toHaveTitle(/Models that fit your Sparks/);

  expect(await sameDocument(page), "no page reload").toBe(true);
  expect(await sawLoading(page), "no loading text drawn").toBe(false);
  expect(indexRequests, "the index is fetched once").toHaveLength(1);
});

test("a modified click is left to the browser and opens a new tab", async ({ page, context, isMobile }) => {
  test.skip(isMobile, "no modifier keys on a touch device");
  await page.goto("/recipes", { waitUntil: "networkidle" });
  await watchNavigation(page);
  const link = page.locator("tbody tr").first().getByRole("link").first();
  const href = (await link.getAttribute("href"))!;
  const opened = context.waitForEvent("page");
  await link.click({ modifiers: ["ControlOrMeta"] });
  const tab = await opened;
  expect(new URL(tab.url()).pathname === href || tab.url() === "about:blank" || tab.url().includes(href)).toBe(true);
  expect(new URL(page.url()).pathname, "this tab stays where it was").toBe("/recipes");
  await tab.close();
});

test("an unknown address and a file are left to the browser", async ({ page }) => {
  await page.goto("/install", { waitUntil: "networkidle" });
  await page.evaluate(() => { const link = document.createElement("a"); link.href = "/catalog/release.json"; link.id = "file-link"; link.textContent = "file"; document.querySelector("main")!.append(link); });
  await watchNavigation(page);
  await page.locator("#file-link").click();
  await expect(page).toHaveURL(/\/catalog\/release\.json$/);
  expect(await sameDocument(page)).toBe(false);
});

// A page reached by an in-app navigation is the same page: no serious accessibility issue, no overflow.
for (const scheme of ["dark", "light"] as const) {
  test(`pages reached by in-app navigation report no serious accessibility issue or overflow in ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/recipes", { waitUntil: "networkidle" });
    for (const step of [async () => page.locator("tbody tr").first().getByRole("link").first().click(), async () => page.getByRole("link", { name: "Models", exact: true }).first().click(), async () => page.getByRole("link", { name: "Install" }).first().click()]) {
      await step();
      await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
      const { violations } = await new AxeBuilder({ page }).analyze();
      expect(violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => item.id)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    }
  });
}
