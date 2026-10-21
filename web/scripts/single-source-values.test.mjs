// @vitest-environment node
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { checkSingleSources, trackedSources } from "./single-source-values.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const nodeOwner = {
  id: "toolchain.node", kind: "node-version", owner: { file: ".node-version", selector: "semver" },
  derive: "read .node-version", consumers: [{ file: "workflow.yml", selector: "setup-node" }],
};
const memoryOwner = {
  id: "catalog.runtime-memory", kind: "memory-projection", owner: { file: "catalog.ts", selector: "nodeResources" },
  derive: "use the Controller peak-only contract",
};
const workflow = "- uses: actions/setup-node@reviewed\n  with:\n    node-version-file: .node-version\n";

describe("single source values", () => {
  test("every registered value has one owner in tracked sources", () => {
    expect(checkSingleSources(trackedSources(root))).toEqual([]);
  });

  // single-source-adversarial-begin: node-selection
  test.each([
    ["workflow.yml", 'node-version: "24.1.0"'],
    ["workflow.yml", 'node-version: "99.1.0"'],
    ["Dockerfile", "FROM node:24.1.0"],
    ["scripts/install", "NODE_VERSION=24.1.0"],
    ["scripts/install.mjs", 'const nodeVersion = "24.1.0"'],
    ["tools/.nvmrc", "24.1.0"],
    ["package.json", '{"engines":{"node":"24.1.0"}}'],
    ["workflow.yml", "node-version: ${{ matrix.node }}"],
    [".tool-versions", "nodejs 24.1.0"],
    ["guide.md", "```sh\nfnm install 24.1.0\n```"],
    ["guide.md", '```sh\nnpm install node@24.1.0\n```'],
    ["AGENTS.md", "Node is **24.1.0**"],
  ])("rejects stale and new Node selections in %s", (file, source) => {
    const files = new Map([[".node-version", "26.1.0\n"], ["workflow.yml", workflow], [file, source]]);
    expect(checkSingleSources(files, [nodeOwner]).join("\n")).toContain(`${file}:`);
    expect(checkSingleSources(files, [nodeOwner]).join("\n")).toContain("owner .node-version#semver");
  });
  // single-source-adversarial-end: node-selection

  test("changing the owner needs no consumer changes; unrelated versions pass", () => {
    for (const version of ["26.1.0", "99.2.3"]) {
      expect(checkSingleSources(new Map([[".node-version", version], ["workflow.yml", workflow], ["package.json", '{"version":"24.1.0"}']]), [nodeOwner])).toEqual([]);
    }
  });

  test("the local runtime check follows a changed version owner", () => {
    const base = path.join(root, ".tmp");
    mkdirSync(base, { recursive: true });
    const fixture = mkdtempSync(path.join(base, "node-owner-"));
    try {
      mkdirSync(path.join(fixture, "web/scripts"), { recursive: true });
      const checker = path.join(fixture, "web/scripts/check-node-version.mjs");
      writeFileSync(checker, readFileSync(path.join(root, "web/scripts/check-node-version.mjs")));
      writeFileSync(path.join(fixture, ".node-version"), process.versions.node);
      expect(spawnSync(process.execPath, [checker]).status).toBe(0);
      const changed = process.versions.node.split(".").map(Number);
      changed[2]++;
      writeFileSync(path.join(fixture, ".node-version"), changed.join("."));
      const rejected = spawnSync(process.execPath, [checker], { encoding: "utf8" });
      expect(rejected.status).toBe(1);
      expect(rejected.stderr).toContain(`Node ${changed.join(".")} is required by .node-version`);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  test("rejects missing owners, duplicate registrations and stale consumer paths", () => {
    const files = new Map([[".node-version", "26.1.0"], ["workflow.yml", workflow]]);
    expect(checkSingleSources(files, [nodeOwner, nodeOwner]).join()).toContain("duplicate or overlapping");
    expect(checkSingleSources(files, [{ ...nodeOwner, owner: { file: "missing" } }]).join()).toContain("missing owner selector");
    files.set("workflow.yml", workflow.replace("node-version-file: .node-version", "node-version-file: .nvmrc"));
    expect(checkSingleSources(files, [nodeOwner]).join()).toContain("version file must be");
  });

  test("refuses broad or unregistered fixture exemptions", () => {
    const files = new Map([[".node-version", "26.1.0"], ["workflow.yml", workflow], ["test.mjs", "// single-source-adversarial-begin: anything\n"]]);
    expect(checkSingleSources(files, [nodeOwner]).join()).toContain("unregistered or overlapping adversarial region");
  });

  test.each([
    "number(memory.peak_bytes) + number(memory.reserve_bytes)",
    'number(memory["peak_bytes"]) + number(memory["reserve_bytes"])',
    "number(memory.peak_bytes) * 2",
  ])("rejects memory policy drift: %s", (expression) => {
    const files = new Map([["catalog.ts", `function nodeResources() { const bytes = ${expression}; }`]]);
    expect(checkSingleSources(files, [memoryOwner]).join()).toContain("catalog.ts:1:");
  });

  test("allows the sole peak projection and rejects a second implementation", () => {
    const source = "function nodeResources() { const bytes = number(memory.peak_bytes); }";
    const files = new Map([["catalog.ts", source]]);
    expect(checkSingleSources(files, [memoryOwner])).toEqual([]);
    files.set("other.ts", source);
    expect(checkSingleSources(files, [memoryOwner]).join()).toContain("independent memory projection");
  });
});
