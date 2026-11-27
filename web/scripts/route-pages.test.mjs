// @vitest-environment node
import { describe, expect, test } from "vitest";

import { makeCatalog, makeModel, makeRecipe } from "../src/api/catalog-factory.fixture.ts";
import { modelsFromIndex, recipesFromIndex } from "../src/api/static-catalog.ts";
import { routeFiles } from "./route-pages.mjs";

const template = '<html><head><script src="/x.js"></script></head><body></body></html>';
const releaseOf = (index) => ({
  repository: index.repository,
  source_commit: index.source_commit,
  tag: "v5.0.0",
});
const build = (index) => routeFiles({ template, index, release: releaseOf(index) });
const canonical = (html) => html.match(/rel="canonical" href="([^"]+)"/)?.[1];

describe("route pages", () => {
  test("every address gets its own file naming itself; unknown addresses get a noindex 404", () => {
    const index = makeCatalog();
    const files = build(index);
    const recipe = recipesFromIndex(index)[0];
    const model = modelsFromIndex(index)[0];

    expect(canonical(files.get("index.html"))).toBe("https://vonkforge.ai/");
    expect(canonical(files.get("install.html"))).toBe("https://vonkforge.ai/install");
    const recipePage = files.get(`recipes/${recipe.publisher}/${recipe.slug}.html`);
    expect(canonical(recipePage)).toBe(
      `https://vonkforge.ai/recipes/${recipe.publisher}/${recipe.slug}`,
    );
    expect(recipePage).toContain(
      `<meta property="og:title" content="${recipe.title} · Vonk Forge"`,
    );
    expect(canonical(files.get(`models/${model.publisher}/${model.slug}.html`))).toBe(
      `https://vonkforge.ai/models/${model.publisher}/${model.slug}`,
    );

    const notFound = files.get("404.html");
    expect(notFound).toContain('<meta name="robots" content="noindex" />');
    expect(canonical(notFound)).toBeUndefined();

    const pages = Array.from(files.keys()).filter((name) => name.endsWith(".html"));
    const listed = files.get("sitemap.xml").match(/<loc>/g);
    expect(listed).toHaveLength(pages.length - 1);
    expect(files.get("robots.txt")).toContain("Sitemap: https://vonkforge.ai/sitemap.xml");
  });

  test("an address that is not a safe file name fails the build", () => {
    const model = makeModel();
    const index = makeCatalog({
      models: [model],
      recipes: [makeRecipe({ document: { identity: { slug: "../escape" } } }, { model })],
    });
    expect(() => build(index)).toThrow(/unsafe address/);
  });
});
