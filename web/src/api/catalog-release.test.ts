import { describe, expect, test } from "vitest";

import type { CatalogIndex } from "./catalog-types";
import { parseLibraryIndex, recipesFromIndex } from "./static-catalog";

// The release the CI step fetched and verified (web/public/catalog), read through the
// adapter exactly as the Pages build does. Locally the file exists after `npm run catalog`;
// in CI a missing file fails the test instead of skipping it.
const files = import.meta.glob("../../public/catalog/{catalog-index,release}.json", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const read = (name: string): unknown => JSON.parse(files[`../../public/catalog/${name}`]!);

describe.runIf(Object.keys(files).length > 0 || import.meta.env.CI)("the verified release through the adapter", () => {
  const index = parseLibraryIndex(read("catalog-index.json"), read("release.json")) as CatalogIndex;

  test("every model whose display lists capabilities has them in the adapter output, and every recipe has a status", () => {
    const recipes = recipesFromIndex(index);
    expect(recipes).toHaveLength(index.recipes.length);
    for (const recipe of recipes) expect(recipe.catalog.qualification).not.toBe("");
    const mapped = new Map(recipes.map((recipe) => [`${recipe.publisher}/${recipe.slug}`, recipe]));
    for (const entry of index.recipes) {
      const entity = index.catalog_entities.find((candidate) => candidate.content_sha256 === entry.document.models[0]!.model.content_sha256)!;
      const recipe = mapped.get(`${entry.document.identity.publisher}/${entry.document.identity.slug}`)!;
      // A model that declares capabilities shows at least one on its recipes.
      if (entity.display.capabilities.length > 0) expect(recipe.catalog.capabilities.length).toBeGreaterThan(0);
    }
  });
});
