import { readFileSync } from "node:fs";

const required = readFileSync(new URL("../../.node-version", import.meta.url), "utf8").trim();
if (process.versions.node !== required) {
  throw new Error(`Node ${required} is required by .node-version; running ${process.versions.node}. Select the version in .node-version before installing dependencies.`);
}
