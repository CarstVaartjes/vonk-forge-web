// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { problems, readSources } from "./check-single-sources.mjs";

test("reads the NUL-separated listing into an in-memory file map", () => {
  const files = readSources("a.txt\0dir/b.txt\0", (file) => `body of ${file}`);
  expect([...files]).toEqual([
    ["a.txt", "body of a.txt"],
    ["dir/b.txt", "body of dir/b.txt"],
  ]);
});

test("input that names no registration fails instead of passing", () => {
  expect(problems(new Map())).toEqual(["no *.single-source.json registration in the input"]);
  expect(problems(new Map([["a.txt", "x"]]))).toHaveLength(1);
});

test("style modules use only the three DESIGN.md breakpoints in width media queries", () => {
  const dir = new URL("../src/styles/", import.meta.url);
  const allowed = new Set([1040, 720, 480, 1041, 721]);
  const found = [];
  for (const name of readdirSync(dir).filter((file) => file.endsWith(".css"))) {
    const css = readFileSync(new URL(name, dir), "utf8");
    for (const [, value, unit] of css.matchAll(/\((?:min|max)-width:\s*([\d.]+)(px|rem|em)\)/g)) {
      const px = unit === "px" ? Number(value) : Number(value) * 16;
      if (!allowed.has(px)) found.push(`${name}: ${value}${unit}`);
    }
  }
  expect(found).toEqual([]);
});
