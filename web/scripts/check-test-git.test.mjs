// @vitest-environment node
import { describe, expect, test } from "vitest";
import { gitInTests } from "./check-test-git.mjs";

const patch = (file, ...added) =>
  `diff --git a/${file} b/${file}\n--- a/${file}\n+++ b/${file}\n@@ -1,0 +5,${added.length} @@\n${added.map((l) => `+${l}`).join("\n")}\n`;

describe("check-test-git", () => {
  test.each([
    ["web/src/a.test.ts", 'execFileSync("git", ["ls-files"])'],
    ["web/scripts/a.test.mjs", "spawnSync('git', ['status'])"],
    ["web/e2e/catalog.spec.ts", 'execSync("git log")'],
    ["web/e2e/helper.ts", "exec(`git rev-parse HEAD`)"],
    ["web/src/a.spec.tsx", 'const out = spawn( "git", [])'],
  ])("flags git in %s", (file, line) => {
    expect(gitInTests(patch(file, "ok", line))).toEqual([`${file}:6: tests never use git; pass the input as an argument`]);
  });

  test("ignores production files, other commands and removed lines", () => {
    expect(gitInTests(patch("web/scripts/single-source-values.mjs", 'execFileSync("git", ["ls-files"])'))).toEqual([]);
    expect(gitInTests(patch("web/src/a.test.ts", 'execFileSync("node", ["x"])', 'const s = "git is fine as text"'))).toEqual([]);
    expect(gitInTests('--- a/web/src/a.test.ts\n+++ b/web/src/a.test.ts\n@@ -1 +0,0 @@\n-execFileSync("git", [])\n')).toEqual([]);
  });

  test("tracks line numbers across hunks and files", () => {
    const text = patch("web/src/a.test.ts", "x") + patch("web/src/b.test.ts", "y", 'execSync("git x")');
    expect(gitInTests(text)).toEqual(["web/src/b.test.ts:6: tests never use git; pass the input as an argument"]);
  });
});
