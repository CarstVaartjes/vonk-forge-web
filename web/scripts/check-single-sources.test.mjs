// @vitest-environment node
import { expect, test } from "vitest";
import { problems, readSources } from "./check-single-sources.mjs";

test("reads the NUL-separated listing into an in-memory file map", () => {
  const files = readSources("a.txt\0dir/b.txt\0", (file) => `body of ${file}`);
  expect([...files]).toEqual([["a.txt", "body of a.txt"], ["dir/b.txt", "body of dir/b.txt"]]);
});

test("input that names no registration fails instead of passing", () => {
  expect(problems(new Map())).toEqual(["no *.single-source.json registration in the input"]);
  expect(problems(new Map([["a.txt", "x"]]))).toHaveLength(1);
});
