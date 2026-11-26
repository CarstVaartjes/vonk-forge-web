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
test("counts every recipe that needs that many Sparks or fewer, whatever its status, with the verified share", () => {
  expect(fitAnswer(summaryFixture, { sparks: "2", type: "" })).toMatchObject({
    count: 3,
    verified: 3,
    byUse: [{ sparks: 1, count: 3 }],
  });
  const all = fitAnswer(summaryFixture, { sparks: "4+", type: "" });
  expect(all).toMatchObject({
    count: 4,
    verified: 3,
    byUse: [
      { sparks: 1, count: 3 },
      { sparks: 8, count: 1 },
    ],
  });
  // The unverified recipe is listed, after the verified ones.
  expect(all.newest.map((row) => row.verified)).toEqual([true, true, true, false]);
  expect(fitAnswer(summaryFixture, { sparks: "1", type: "3d" })).toMatchObject({
    count: 1,
    verified: 1,
  });
  expect(fitAnswer(summaryFixture, { sparks: "", type: "" }).count).toBe(4);
});
