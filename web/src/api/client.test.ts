import { describe, expect, test } from "vitest";

import { selectPublicModelSource } from "./client";


describe("public model source selection", () => {
  test("keeps the generated public index for a production build with both sources configured", () => {
    expect(selectPublicModelSource({
      apiUrl: "https://api.vonkforge.ai",
      indexUrl: "https://raw.githubusercontent.com/CarstVaartjes/vonk-forge-recipes/main/catalog-index.json",
    })).toBe("static-index");
  });

  test("does not pretend an API-only build has a model source", () => {
    expect(selectPublicModelSource({ apiUrl: "https://api.vonkforge.ai", indexUrl: "" })).toBe("unavailable");
  });
});
