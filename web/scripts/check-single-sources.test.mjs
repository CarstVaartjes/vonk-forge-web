// @vitest-environment node
import { expect, test } from "vitest";
import { readSources } from "./check-single-sources.mjs";

test("reads the NUL-separated listing into an in-memory file map", () => {
  const files = readSources("a.txt\0dir/b.txt\0", (file) => `body of ${file}`);
  expect([...files]).toEqual([["a.txt", "body of a.txt"], ["dir/b.txt", "body of dir/b.txt"]]);
});
