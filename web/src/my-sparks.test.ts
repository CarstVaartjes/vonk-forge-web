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

test("counts verified recipes that need that many Sparks or fewer, and the unverified ones published for them", () => {
  const rows = summaryFixture.recipes;
  const verifiedOne = rows.filter((row) => row.verified && row.sparks === 1).length;
  const answer = fitAnswer(summaryFixture, { sparks: "2", type: "" });
  expect(answer).toMatchObject({ count: verifiedOne, byUse: [{ sparks: 1, count: verifiedOne }], moreUnverified: 0 });
  // Four or more matches every recipe, so the eight-Spark recipe that is not verified is "published for your Sparks".
  expect(fitAnswer(summaryFixture, { sparks: "4+", type: "" }).moreUnverified).toBe(rows.filter((row) => !row.verified).length);
  expect(fitAnswer(summaryFixture, { sparks: "", type: "" }).count).toBe(summaryFixture.verified);
});
