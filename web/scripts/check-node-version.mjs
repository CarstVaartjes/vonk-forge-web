import { readFileSync } from "node:fs";

// CI installs .node-version exactly; locally it is a floor: same major, at least that version.
const required = readFileSync(new URL("../../.node-version", import.meta.url), "utf8").trim();
const want = required.split(".").map(Number);
const have = process.versions.node.split(".").map(Number);
const atLeast = (() => {
  for (let i = 0; i < 3; i++) if (have[i] !== want[i]) return have[i] > want[i];
  return true;
})();
if (have[0] !== want[0] || !atLeast) {
  throw new Error(
    `Node ${required} is required by .node-version (same major, at least that version); running ${process.versions.node}. Install it before installing dependencies.`,
  );
}
