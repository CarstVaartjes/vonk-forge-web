// Tests never use git (owner rule 2026-11-06). Reads a unified patch on stdin
// and flags added lines that spawn git in test files. The patch is the one git
// call, made by the CI step: git diff -U0 "$BASE_SHA" | node web/scripts/check-test-git.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const spawnsGit = /\b(?:execFileSync|execFile|spawnSync|spawn|execSync|exec)\(\s*["'`]git\b/;
const isTestFile = (file) => /(?:^|\/)[^/]+\.(?:test|spec)\.[^/]+$/.test(file) || /(?:^|\/)e2e\//.test(file);
// Named exemption: this guard's own test holds patch text that spells the call.
const exempt = new Set(["web/scripts/check-test-git.test.mjs"]);

export function gitInTests(patch) {
  const found = [];
  let file;
  let line = 0;
  for (const text of patch.split("\n")) {
    if (text.startsWith("+++ ")) {
      file = text.slice(4).replace(/^b\//, "");
      if (file === "/dev/null") file = undefined;
    } else if (text.startsWith("@@")) {
      line = Number(text.match(/\+(\d+)/)?.[1] ?? 0);
    } else if (text.startsWith("+") && file) {
      if (isTestFile(file) && !exempt.has(file) && spawnsGit.test(text)) found.push(`${file}:${line}: tests never use git; pass the input as an argument`);
      line++;
    }
  }
  return found;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const found = gitInTests(readFileSync(0, "utf8"));
  if (found.length) {
    console.error(found.join("\n"));
    process.exit(1);
  }
}
