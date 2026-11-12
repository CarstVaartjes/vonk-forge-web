// @vitest-environment node
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { checkSingleSources } from "./single-source-values.mjs";

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
    const fixture = mkdtempSync(path.join(tmpdir(), "node-owner-"));
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
    const source = "function nodeResources() { const bytes = memory.peak_bytes; }";
    const files = new Map([["catalog.ts", source]]);
    expect(checkSingleSources(files, [memoryOwner])).toEqual([]);
    files.set("other.ts", source);
    expect(checkSingleSources(files, [memoryOwner]).join()).toContain("independent memory projection");
  });

  describe("published vocabulary", () => {
    const entry = { id: "catalog.vocabulary", kind: "published-vocabulary", owner: { file: "web/src/api/catalog.fixture.ts", selector: "vocabulary" }, derive: "read index.vocabulary" };
    const owner = 'export const catalogIndexFixture = { "vocabulary": { "capabilities": [{ "name": "chat", "label": "Chat" }], "statuses": [{ "status": "Working", "meaning": "m", "verified": true }] } };';
    const check = (...extra) => checkSingleSources(new Map([["web/src/api/catalog.fixture.ts", owner], ...extra]), [entry]).join("\n");

    test.each([
      ['const a = "chat";', "chat"],
      ["const a = `Working`;", "Working"],
      ['const options = [{ value: "chat", label: "Chat" }];', "chat"],
      ["const a = 'Working';", "Working"],
      ["const a = `Working ${b}`.length; const c = `${b}Working`;", "Working"],
      ["const a = <span>Working</span>;", "Working"],
      ['const a = <span title="Working" />;', "Working"],
    ])("rejects an added literal: %s", (source, value) => {
      expect(check(["web/src/x.tsx", source])).toContain(`read "${value}" from the release vocabulary`);
    });

    test("allows tests, fixtures, generated types and longer text", () => {
      expect(check(["web/src/x.test.ts", 'const a = "chat";'], ["web/src/x.fixture.ts", 'const a = "Working";'], ["web/src/api/catalog.generated.d.ts", 'type A = "chat";'],
        ["web/src/y.tsx", 'const a = "chatty"; const b = <p>Working on it</p>;'])).toBe("");
    });

    test("needs an owner that holds a vocabulary", () => {
      expect(checkSingleSources(new Map([["web/src/api/catalog.fixture.ts", "export const a = 1;"]]), [entry]).join()).toContain("expected a vocabulary object");
    });
  });

  describe("contract versions", () => {
    const entry = { id: "catalog.contract-versions", kind: "contract-versions", owner: { file: "web/scripts/recipe-release.mjs", selector: "SCHEMA_NAME" }, derive: "read the owner" };
    const owner = 'export const SCHEMA_NAME = "x";';
    const check = (source, file = "web/src/x.ts", ownerText = owner) => checkSingleSources(new Map([["web/scripts/recipe-release.mjs", ownerText], [file, source]]), [entry]).join("\n");

    test.each([
      "const SUPPORTED_CONTRACT_MAJOR = 3;",
      "export const SUPPORTED_CONTRACT_MAJOR = 3;",
      "const config = { contractMajor: 3 };",
      "if (body.schema_version !== 2) throw new Error();",
      "if (2 === index.schema_version) throw new Error();",
      'if (index["schema_version"] != 2) throw new Error();',
      "if (semver(tag)[0] !== 3) fail();",
      "if (semver(`v${index.contract_version}`)?.[0] !== 3) fail();",
      "if (contractMajor(body.contract_version) !== 3) fail();",
      "interface A { package_contract: { media_type: string; schema_version: 2 } }",
      "const MAJOR = 3;",
      "if (body.schema_version > 2) fail();",
      "switch (index.schema_version) { case 2: break; }",
      "const TAG = /^v3\\./;",
    ])("rejects a second copy: %s", (source) => {
      expect(check(source)).toContain("web/src/x.ts:1:");
      expect(check(source, "web/scripts/x.mjs")).toContain("web/scripts/x.mjs:1:");
    });

    test.each([
      "if (contracts.length === 0) {}",
      "if (majorItems.length > 0) {}",
      "if (contract.recipes.length > 10) {}",
      "if (page.contractRows.length < 50) {}",
      "if (contractCount >= 1) {}",
      "if (Object.keys(body.package_contract).length > 0) {}",
      "if (semver(tag).length !== 3) {}",
      "switch (contracts.length) { case 0: break; }",
      "const pattern = /v2/; const other = /^v\\d+\\.\\d+/;",
      "const majorCount = 3;",
    ])("allows unrelated numbers: %s", (source) => {
      expect(check(source)).toBe("");
    });

    test("allows reads from the owner, test files and unrelated numbers", () => {
      expect(check("const SUPPORTED_CONTRACT_MAJOR = contract.major; if (body.schema_version !== constants.schemaVersion) {} const retries = 3;")).toBe("");
      expect(check("const SUPPORTED_CONTRACT_MAJOR = 3;", "web/src/x.test.ts")).toBe("");
    });

    test.each(['release.contract_version.startsWith("4.")', 'tag.startsWith("v4.")'])("rejects a prefix check that fixes a major: %s", (source) => {
      expect(check(`if (${source}) {}`)).toContain("fixes a major");
    });
  });
});
