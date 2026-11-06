// @vitest-environment node
import { describe, expect, test } from "vitest";
import { gitInTests } from "./check-test-git.mjs";

// Built from a constant so this file never spells the forbidden call itself.
const GIT = '"git"';
const SINGLE = "'git'";
const TICK = "`git rev-parse HEAD`";

const patch = (file, ...added) =>
  `diff --git a/${file} b/${file}\n--- a/${file}\n+++ b/${file}\n@@ -1,0 +5,${added.length} @@\n${added.map((l) => `+${l}`).join("\n")}\n`;

describe("check-test-git", () => {
  test.each([
    ["web/src/a.test.ts", `execFileSync(${GIT}, ["ls-files"])`],
    ["web/scripts/a.test.mjs", `spawnSync(${SINGLE}, ["status"])`],
    ["web/e2e/catalog.spec.ts", `execSync(${GIT})`],
    ["web/e2e/helper.ts", `exec(${TICK})`],
    ["web/src/test-setup.ts", `execSync(${GIT})`],
    ["web/src/a.spec.tsx", `const out = spawn( ${GIT}, [])`],
  ])("flags git in %s", (file, line) => {
    expect(gitInTests(patch(file, "ok", line))).toEqual([`${file}:6: tests never use git; pass the input as an argument`]);
  });

  test("ignores production files, other commands and removed lines", () => {
    expect(gitInTests(patch("web/scripts/single-source-values.mjs", `execFileSync(${GIT}, [])`))).toEqual([]);
    expect(gitInTests(patch("web/src/a.test.ts", `execFileSync("node", ["x"])`, 'const s = "git is fine as text"'))).toEqual([]);
    expect(gitInTests(`--- a/web/src/a.test.ts\n+++ b/web/src/a.test.ts\n@@ -1 +0,0 @@\n-execFileSync(${GIT}, [])\n`)).toEqual([]);
  });

  test("tracks line numbers across hunks and files", () => {
    const text = patch("web/src/a.test.ts", "x") + patch("web/src/b.test.ts", "y", `execSync(${GIT})`);
    expect(gitInTests(text)).toEqual(["web/src/b.test.ts:6: tests never use git; pass the input as an argument"]);
  });
});
