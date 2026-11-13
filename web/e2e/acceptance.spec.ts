import { gzipSync } from "node:zlib";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { routeRelease } from "./release-fixture.ts";

const PAGES = ["/", "/recipes", "/recipes/vonk-forge/qwen-fast"];

test.beforeEach(({ page }) => routeRelease(page));

async function load(page: Page, path: string, errors: string[]): Promise<void> {
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto(path, { waitUntil: "networkidle" });
}

for (const width of [1440, 400]) {
  for (const scheme of ["dark", "light"] as const) {
    test(`home, the catalog and a recipe page at ${width}px in ${scheme}: no horizontal overflow, no console error`, async ({ page }) => {
      const errors: string[] = [];
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: scheme });
      for (const path of PAGES) {
        await load(page, path, errors);
        await expect(page.locator("html")).toHaveCSS("color-scheme", scheme);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
      }
      expect(errors).toEqual([]);
    });
  }
}

test("an accessibility scan of home, the catalog and a recipe page reports no serious issue, in both themes", async ({ page }) => {
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const path of PAGES) {
      await load(page, path, []);
      const { violations } = await new AxeBuilder({ page }).analyze();
      expect(violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical").map((violation) => `${scheme} ${path} ${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
    }
  }
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
