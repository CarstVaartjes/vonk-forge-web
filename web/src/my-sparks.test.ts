import { afterEach, expect, test } from "vitest";

import { summaryFixture } from "./catalog-summary.fixture";
import { fitAnswer, readMySparks } from "./my-sparks";

afterEach(() => localStorage.clear());

test("the URL wins over the remembered choice, which wins over nothing", () => {
  expect(readMySparks("")).toEqual({ sparks: "", type: "" });
  localStorage.setItem("vonk-my-sparks", "sparks=2&type=code");
  expect(readMySparks("")).toEqual({ sparks: "2", type: "code" });
  expect(readMySparks("?sparks=4%2B")).toEqual({ sparks: "4+", type: "" });
  expect(readMySparks("?sparks=banana&type=vision")).toEqual({ sparks: "", type: "vision" });
});

// The fixture release: three verified one-Spark recipes (two language/vision/audio, one 3D) and one
// eight-Spark recipe that is not verified.
test("counts verified recipes that need that many Sparks or fewer, and the unverified ones published for them", () => {
  expect(fitAnswer(summaryFixture, { sparks: "2", type: "" })).toMatchObject({ count: 3, byUse: [{ sparks: 1, count: 3 }], moreUnverified: 0 });
  expect(fitAnswer(summaryFixture, { sparks: "4+", type: "" })).toMatchObject({ count: 3, moreUnverified: 1 });
  expect(fitAnswer(summaryFixture, { sparks: "1", type: "3d" })).toMatchObject({ count: 1, moreUnverified: 0 });
  expect(fitAnswer(summaryFixture, { sparks: "", type: "" }).count).toBe(3);
});
