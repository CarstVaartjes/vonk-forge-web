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
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  errorsByPage.set(page, errors);
  return errors;
}

async function load(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: "networkidle" });
}

// Every route of the site, read from src/routes.ts. A parameterised route is visited at the first
// entry its list page links to, so the pages are checked against whichever library is being served.
async function firstEntry(page: Page, route: string): Promise<string> {
  const list = route.slice(0, route.indexOf("/:"));
  await load(page, list);
  const href = await page.locator(`main a[href^="${list}/"]`).first().getAttribute("href");
  expect(href, `${list} links to at least one entry`).not.toBeNull();
  return href!;
}

async function sitePaths(page: Page): Promise<string[]> {
  const paths: string[] = [];
  for (const route of ROUTES)
    paths.push(route.includes(":") ? await firstEntry(page, route) : route);
  return paths;
}

for (const width of [1440, 1100, 768, 400, 320]) {
  for (const scheme of ["dark", "light"] as const) {
    test(`every page at ${width}px in ${scheme}: no horizontal overflow, no console error`, async ({
      page,
      isMobile,
    }) => {
      test.skip(
        isMobile && width === 1440,
        "desktop 1440px layout; the phone project covers 390px",
      );
      const errors = watch(page);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: scheme });
      for (const path of await sitePaths(page)) {
        await load(page, path);
        await expect(page.locator("html")).toHaveCSS("color-scheme", scheme);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
        ).toBeLessThanOrEqual(0);
        expect(await page.content(), `${path} shows no fixture address`).not.toContain(
          "fixture.invalid",
        );
      }
      expect(errors).toEqual([]);
    });
  }
}

// One test per route and theme, so each fits the default timeout and a violation names its page.
for (const scheme of ["dark", "light"] as const) {
  for (const route of ROUTES) {
    test(`${route} reports no serious accessibility issue in ${scheme}`, async ({ page }) => {
      const errors = watch(page);
      const path = route.includes(":") ? await firstEntry(page, route) : route;
      await page.emulateMedia({ colorScheme: scheme });
      await load(page, path);
      const { violations } = await new AxeBuilder({ page }).analyze();
      for (const violation of violations.filter(
        (item) => item.impact === "serious" || item.impact === "critical",
      )) {
        expect
          .soft(
            violation.nodes.map((node) => node.target.join(" ")).slice(0, 3),
            `${scheme} ${path} ${violation.id}`,
          )
          .toEqual([]);
      }
      expect.soft(errors).toEqual([]);
    });
  }
}

test("the catalog rows are not headings: the Recipes page has only its two section headings under one h1", async ({
  page,
}) => {
  await load(page, "/recipes");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.locator("main").getByRole("heading", { level: 2 })).toHaveCount(2);
  await expect(page.locator("tbody").getByRole("heading")).toHaveCount(0);
  await expect(page.locator("tbody tr").first().getByRole("link").first()).toBeVisible();
});

// The first screen at 1440x900: both hero actions sit above the fold with room to spare.
test("home first screen at 1440x900: both hero actions are fully visible", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "desktop 1440px layout; the phone project covers 390px");
  await page.setViewportSize({ width: 1440, height: 900 });
  await load(page, "/");
  for (const name of ["Install", "Browse what runs"]) {
    const box = (await page
      .locator(".hero-actions")
      .first()
      .getByRole("link", { name })
      .boundingBox())!;
    expect(box.y + box.height, name).toBeLessThanOrEqual(900 - 24);
  }
});

test("home at 390x844: the Install action is fully visible without scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await load(page, "/");
  const box = (await page
    .locator(".hero-actions")
    .first()
    .getByRole("link", { name: "Install" })
    .boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(844 - 24);
});

test("home transfers under 200 kB of JavaScript and data, gzipped, and never requests the full catalog index", async ({
  page,
}) => {
  const requests: string[] = [];
  let transferred = 0;
  page.on("request", (request) => requests.push(new URL(request.url()).pathname));
  const bodies: Promise<void>[] = [];
  page.on("response", (response) => {
    const type = response.headers()["content-type"] ?? "";
    if (/javascript|json/.test(type))
      bodies.push(
        response.body().then((body) => {
          transferred += gzipSync(body).length;
        }),
      );
  });
  await page.goto("/", { waitUntil: "networkidle" });
  await Promise.all(bodies);
  expect(requests).not.toContain("/catalog/catalog-index.json");
  expect(transferred).toBeLessThan(200_000);
});
