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
  expect(scrolled, "the list was scrolled before leaving").toBeGreaterThan(0);
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
  await expect(tab).toHaveURL(new RegExp(`${href}$`));
  expect(new URL(page.url()).pathname, "this tab stays where it was").toBe("/recipes");
  await tab.close();
});

async function addLink(page: Page, href: string): Promise<void> {
  await page.evaluate((target) => { const link = document.createElement("a"); link.href = target; link.id = "added-link"; link.textContent = "added"; document.querySelector("main")!.append(link); }, href);
}

test("a file is left to the browser", async ({ page }) => {
  await page.goto("/install", { waitUntil: "networkidle" });
  await addLink(page, "/catalog/release.json");
  await watchNavigation(page);
  await page.locator("#added-link").click();
  await expect(page).toHaveURL(/\/catalog\/release\.json$/);
  expect(await sameDocument(page)).toBe(false);
});

test("an unknown address is left to the browser, which shows the not-found page", async ({ page }) => {
  await page.goto("/install", { waitUntil: "networkidle" });
  await addLink(page, "/no-such-page");
  await watchNavigation(page);
  await page.locator("#added-link").click();
  await expect(page.getByRole("heading", { level: 1, name: "Not found" })).toBeVisible();
  expect(await sameDocument(page), "a full load").toBe(false);
});

test("a page chunk that fails to load after a deploy is cured by a full load of that address", async ({ page }) => {
  await page.goto("/install", { waitUntil: "networkidle" });
  await watchNavigation(page);
  let failed = 0;
  await page.route("**/assets/recipes-*.js", (route) => { if (failed++ === 0) return route.fulfill({ status: 404, body: "gone" }); return route.continue(); });
  await page.getByRole("link", { name: "Recipes", exact: true }).first().click();
  await expect(page).toHaveURL(/\/recipes$/);
  await expect(page.getByRole("heading", { level: 1, name: "Find the right recipe." })).toBeVisible();
  await expect(page.locator("tbody tr").first()).toBeVisible();
  expect(await sameDocument(page), "a full load, not a blank page").toBe(false);
  expect(failed).toBeGreaterThan(0);
});

test("a link to the page's own list from a filtered list resets the filters and adds one history entry", async ({ page }) => {
  await page.goto("/recipes", { waitUntil: "networkidle" });
  await page.getByRole("searchbox", { name: "Search recipes" }).fill("zzzz-no-match");
  await expect(page).toHaveURL(/q=zzzz/);
  const entries = await page.evaluate(() => history.length);
  await page.getByRole("navigation", { name: "Footer navigation" }).getByRole("link", { name: "Recipes", exact: true }).click();
  await expect(page).toHaveURL(/\/recipes$/);
  await expect(page.getByRole("searchbox", { name: "Search recipes" })).toHaveValue("");
  expect(await page.evaluate(() => history.length)).toBe(entries + 1);
});

test("an in-page anchor keeps the page and the focus where the visitor put it", async ({ page }) => {
  await page.goto("/recipes", { waitUntil: "networkidle" });
  await page.evaluate(() => { document.querySelector("main")!.setAttribute("data-mounted", "yes"); });
  const entries = await page.evaluate(() => history.length);
  const badge = page.locator("a.badge-link").first();
  await badge.click();
  await expect(page).toHaveURL(/#/);
  await page.waitForTimeout(300);
  await expect(page.locator("main[data-mounted=yes]")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).not.toBeFocused();
  expect(await page.evaluate(() => history.length)).toBe(entries + 1);
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
