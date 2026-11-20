import { gzipSync } from "node:zlib";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { ROUTES } from "../src/routes.ts";
import { routeRelease } from "./release-fixture.ts";

test.beforeEach(({ page }) => routeRelease(page));

// Console and page errors of one test, collected by listeners attached once per page.
const errorsByPage = new WeakMap<Page, string[]>();
function watch(page: Page): string[] {
  const known = errorsByPage.get(page);
  if (known) return known;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  errorsByPage.set(page, errors);
  return errors;
}

async function load(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: "networkidle" });
}

// Every route of the site, read from src/routes.ts. A parameterised route is visited at the first
// entry its list page links to, so the pages are checked against whichever library is being served.
async function sitePaths(page: Page): Promise<string[]> {
  const paths: string[] = [];
  for (const route of ROUTES) {
    if (!route.includes(":")) { paths.push(route); continue; }
    const list = route.slice(0, route.indexOf("/:"));
    await load(page, list);
    const href = await page.locator(`main a[href^="${list}/"]`).first().getAttribute("href");
    expect(href, `${list} links to at least one entry`).not.toBeNull();
    paths.push(href!);
  }
  return paths;
}

for (const width of [1440, 400]) {
  for (const scheme of ["dark", "light"] as const) {
    test(`every page at ${width}px in ${scheme}: no horizontal overflow, no console error`, async ({ page }) => {
      const errors = watch(page);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: scheme });
      for (const path of await sitePaths(page)) {
        await load(page, path);
        await expect(page.locator("html")).toHaveCSS("color-scheme", scheme);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
      }
      expect(errors).toEqual([]);
    });
  }
}

test("an accessibility scan of every page reports no serious issue, in both themes", async ({ page }) => {
  // Every page twice, with a full axe scan each.
  test.setTimeout(150_000);
  const errors = watch(page);
  const paths = await sitePaths(page);
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const path of paths) {
      await load(page, path);
      const { violations } = await new AxeBuilder({ page }).analyze();
      expect(violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical").map((violation) => `${scheme} ${path} ${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
    }
  }
  expect(errors).toEqual([]);
});

test("the catalog rows are not headings: the Recipes page has only its two section headings under one h1", async ({ page }) => {
  await load(page, "/recipes");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.locator("main").getByRole("heading", { level: 2 })).toHaveCount(2);
  await expect(page.locator("tbody").getByRole("heading")).toHaveCount(0);
  await expect(page.locator("tbody tr").first().getByRole("link").first()).toBeVisible();
});

test("with reduced motion the wall is in its final state on first paint", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".wall")).toHaveAttribute("data-ignite", "done");
  await expect(page.locator("a.wall-cell[data-dim]")).toHaveCount(0);
});

test("home transfers under 200 kB of JavaScript and data, gzipped, and never requests the full catalog index", async ({ page }) => {
  const requests: string[] = [];
  let transferred = 0;
  page.on("request", (request) => requests.push(new URL(request.url()).pathname));
  page.on("response", async (response) => {
    const type = response.headers()["content-type"] ?? "";
    if (/javascript|json/.test(type)) transferred += gzipSync(await response.body()).length;
  });
  await page.goto("/", { waitUntil: "networkidle" });
  expect(requests).not.toContain("/catalog/catalog-index.json");
  expect(transferred).toBeLessThan(200_000);
});
