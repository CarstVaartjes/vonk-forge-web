import { expect, test } from "vitest";

import { matchRoute, ROUTES } from "./routes";

test("every route matches itself, and parameters are read from the path", () => {
  for (const route of ROUTES) expect(matchRoute(route.replace(":publisher", "p").replace(":slug", "s"))?.route).toBe(route);
  expect(matchRoute("/recipes/vonk-forge/qwen-fast")).toEqual({ route: "/recipes/:publisher/:slug", params: { publisher: "vonk-forge", slug: "qwen-fast" } });
  expect(matchRoute("/recipes/only-one")).toBeNull();
  expect(matchRoute("/nowhere")).toBeNull();
});
