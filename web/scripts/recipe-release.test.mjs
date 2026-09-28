// @vitest-environment node
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { parseChecksums, publishRecipeRelease, selectReleaseTag } from "./recipe-release.mjs";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const commit = "a".repeat(40);
const tag = "v2.1.0";
const updatedAt = "2026-09-28T20:04:06Z";

// A fixture release shaped like vonk-forge-recipes publish.yml output.
function fixtureRelease({ index: indexOverride = {}, checksums: checksumsOverride } = {}) {
  const packageBytes = Buffer.from("fixture package");
  const index = {
    kind: "recipe-library-index",
    schema_version: 2,
    contract_version: "2.1.0",
    updated_at: updatedAt,
    repository: "CarstVaartjes/vonk-forge-recipes",
    source_commit: commit,
    package_contract: { schema_version: 2, media_type: "application/vnd.vonk-forge.recipe-package.v2+tar+gzip", path_prefix: "packages/" },
    catalog_entities: [],
    recipes: [{ package: { path: "packages/qwen-fast-single.tar.gz", sha256: sha256(packageBytes) } }],
    ...indexOverride,
  };
  const indexBytes = Buffer.from(JSON.stringify(index));
  const assets = {
    "catalog-index.json": indexBytes,
    "qwen-fast-single.tar.gz": packageBytes,
    "SHA256SUMS.sigstore.json": Buffer.from("{}"),
  };
  assets.SHA256SUMS = Buffer.from(checksumsOverride ?? [
    `${sha256(indexBytes)}  catalog-index.json`,
    `${sha256(packageBytes)}  qwen-fast-single.tar.gz`,
    "",
  ].join("\n"));
  return assets;
}

const signedCertificate = {
  sourceRepositoryIdentifier: "1336002555",
  sourceRepositoryRef: "refs/heads/main",
  sourceRepositoryDigest: commit,
  runnerEnvironment: "github-hosted",
};

let root;
let outDir;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "recipe-release-"));
  outDir = path.join(root, "public", "catalog");
  // A previously published catalog must survive every rejected release.
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "catalog-index.json"), "previous");
});

afterEach(() => rm(root, { recursive: true, force: true }));

function publish(assets, { certificate = signedCertificate, verifySignature, releaseTag = tag } = {}) {
  return publishRecipeRelease({
    tag: releaseTag,
    outDir,
    download: async (requestedTag, name) => {
      expect(requestedTag).toBe(releaseTag);
      if (!(name in assets)) throw new Error(`missing asset ${name}`);
      return assets[name];
    },
    verifySignature: verifySignature ?? (async (checksumsPath) => {
      // Stands in for `gh attestation verify`, which must be handed the downloaded SHA256SUMS.
      expect(await readFile(checksumsPath)).toEqual(assets.SHA256SUMS);
      return certificate;
    }),
  });
}

async function expectPreviousCatalogKept() {
  expect(await readFile(path.join(outDir, "catalog-index.json"), "utf8")).toBe("previous");
  expect((await readdir(path.dirname(outDir))).filter((name) => name.startsWith(".catalog-staging-"))).toEqual([]);
}

describe("recipe release publication", () => {
  test("writes the verified index and a manifest naming the signed release", async () => {
    const assets = fixtureRelease();
    await publish(assets);
    expect(await readFile(path.join(outDir, "catalog-index.json"))).toEqual(assets["catalog-index.json"]);
    expect(await readFile(path.join(outDir, "SHA256SUMS"))).toEqual(assets.SHA256SUMS);
    expect(JSON.parse(await readFile(path.join(outDir, "release.json"), "utf8"))).toEqual({
      repository: "CarstVaartjes/vonk-forge-recipes",
      tag,
      contract_version: "2.1.0",
      updated_at: updatedAt,
      source_commit: commit,
      sha256sums_sha256: sha256(assets.SHA256SUMS),
      catalog_index_sha256: sha256(assets["catalog-index.json"]),
    });
  });

  test("fails closed when the signature does not verify", async () => {
    await expect(publish(fixtureRelease(), {
      verifySignature: async () => { throw new Error("gh attestation verify: verification failed"); },
    })).rejects.toThrow("verification failed");
    await expectPreviousCatalogKept();
  });

  test.each([
    ["another repository", { sourceRepositoryIdentifier: "1" }, "another repository"],
    ["another ref", { sourceRepositoryRef: "refs/heads/feature" }, "refs/heads/main"],
    ["a self-hosted runner", { runnerEnvironment: "self-hosted" }, "GitHub-hosted"],
    ["another commit", { sourceRepositoryDigest: "b".repeat(40) }, "signed commit"],
  ])("rejects an attestation from %s", async (_name, claims, message) => {
    await expect(publish(fixtureRelease(), { certificate: { ...signedCertificate, ...claims } })).rejects.toThrow(message);
    await expectPreviousCatalogKept();
  });

  test("rejects an index that does not match its signed digest", async () => {
    const assets = fixtureRelease();
    assets["catalog-index.json"] = Buffer.from(assets["catalog-index.json"].toString().replace("qwen", "evil"));
    await expect(publish(assets)).rejects.toThrow("catalog-index.json does not match SHA256SUMS");
    await expectPreviousCatalogKept();
  });

  test("rejects a package the signed checksums do not cover", async () => {
    const assets = fixtureRelease({ index: { recipes: [{ package: { path: "packages/unsigned.tar.gz", sha256: "c".repeat(64) } }] } });
    await expect(publish(assets)).rejects.toThrow("unsigned.tar.gz is not signed");
    await expectPreviousCatalogKept();
  });

  test("rejects a package path outside the release assets", async () => {
    const assets = fixtureRelease({ index: { recipes: [{ package: { path: "packages/../SHA256SUMS", sha256: "c".repeat(64) } }] } });
    await expect(publish(assets)).rejects.toThrow("is not a release asset");
    await expectPreviousCatalogKept();
  });

  test("rejects a mutable or malformed release tag", async () => {
    await expect(publish(fixtureRelease(), { releaseTag: "main" })).rejects.toThrow("invalid release tag");
    await expectPreviousCatalogKept();
  });

  test("rejects a release or index for another contract major", async () => {
    await expect(publish(fixtureRelease(), { releaseTag: "v3.0.0" })).rejects.toThrow("contract major 2");
    await expect(publish(fixtureRelease({ index: { contract_version: "3.0.0" } }))).rejects.toThrow("unsupported contract version");
    await expectPreviousCatalogKept();
  });

  test("follows the newest non-draft release within the supported contract major", () => {
    const releases = [
      { tag_name: "v3.0.0", draft: false },
      { tag_name: "v2.10.0", draft: true },
      { tag_name: "v2.2.0", draft: false },
      { tag_name: "v2.10.1-rc", draft: false },
      { tag_name: "v2.9.3", draft: false },
      { tag_name: "v1.9.0", draft: false },
    ];
    expect(selectReleaseTag(releases)).toBe("v2.9.3");
    expect(() => selectReleaseTag([{ tag_name: "v1.0.0", draft: false }])).toThrow("no published release");
  });

  test("parses only well-formed checksum manifests", () => {
    expect(parseChecksums(`${"0".repeat(64)}  a.json\n`).get("a.json")).toBe("0".repeat(64));
    expect(() => parseChecksums(`${"0".repeat(64)}  ../a.json\n`)).toThrow("malformed");
    expect(() => parseChecksums(`${"0".repeat(64)}  a\n${"1".repeat(64)}  a\n`)).toThrow("twice");
    expect(() => parseChecksums("")).toThrow("empty");
  });
});
