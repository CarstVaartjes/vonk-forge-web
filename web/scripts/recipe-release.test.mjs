// @vitest-environment node
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { assertNoNewerMajor, parseChecksums, publishRecipeRelease, readBundle, selectReleaseTag } from "./recipe-release.mjs";

// A minimal ustar writer, enough to build bundles the way the recipe library does.
function tarMember(name, payload, { type = "0", prefix = "" } = {}) {
  const header = Buffer.alloc(512);
  header.write(name, 0, "latin1");
  header.write("0000644\0", 100);
  header.write("0000000\0", 108);
  header.write("0000000\0", 116);
  header.write(`${payload.length.toString(8).padStart(11, "0")}\0`, 124);
  header.write("00000000000\0", 136);
  header.write("        ", 148);
  header.write(type, 156);
  header.write("ustar\0" + "00", 257, "latin1");
  header.write(prefix, 345, "latin1");
  const sum = header.reduce((total, byte) => total + byte, 0);
  header.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148);
  return Buffer.concat([header, payload, Buffer.alloc((512 - (payload.length % 512)) % 512)]);
}
const tar = (members, options) => Buffer.concat([
  ...members.map(([name, payload, extra]) => tarMember(name, payload, extra ?? options)),
  Buffer.alloc(1024),
]);

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const commit = "a".repeat(40);
const tag = "v3.0.0";
const updatedAt = "2026-09-28T20:04:06Z";

// One model and one verified recipe: the smallest catalog the site accepts.
const modelDigest = "3".repeat(64);
const fixtureModel = {
  content_sha256: modelDigest,
  document: {
    kind: "model",
    identity: { publisher: "qwen", slug: "qwen-fast-nvfp4", family: { publisher: "qwen", slug: "qwen" }, model: { publisher: "qwen", slug: "qwen-fast" } },
    capabilities: ["chat", "code-generation"],
  },
  display: { family_title: "Qwen", model_title: "Qwen Fast" },
};
const fixtureRecipe = (packageBytes, overrides = {}) => ({
  content_sha256: "a".repeat(64),
  source_path: "recipes/qwen-fast.json",
  package: { path: "packages/qwen-fast-single.tar.gz", sha256: sha256(packageBytes), expected_bytes: packageBytes.length, media_type: "x", minimum_consumer_schema: 2, recipe_content_sha256: "a".repeat(64) },
  qualification: { status: "Working" },
  display: { title: "Qwen Fast" },
  release: { version: "1.0.0", released_at: "2026-09-01" },
  document: {
    identity: { publisher: "vonk-forge", slug: "qwen-fast" },
    models: [{ model: { kind: "model", publisher: "qwen", slug: "qwen-fast-nvfp4", content_sha256: modelDigest } }],
    provenance: { source_reference: "https://huggingface.co/Qwen/Qwen-Fast" },
  },
  ...overrides,
});

// A fixture release shaped like vonk-forge-recipes publish.yml output.
function fixtureRelease({ index: indexOverride = {}, checksums: checksumsOverride } = {}) {
  const packageBytes = Buffer.from("fixture package");
  const index = {
    kind: "recipe-library-index",
    schema_version: 2,
    contract_version: "3.0.0",
    updated_at: updatedAt,
    repository: "CarstVaartjes/vonk-forge-recipes",
    source_commit: commit,
    package_contract: { schema_version: 2, media_type: "application/vnd.vonk-forge.recipe-package.v2+tar+gzip", path_prefix: "packages/" },
    catalog_entities: [fixtureModel],
    recipes: [fixtureRecipe(packageBytes)],
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

function publish(assets, { certificate = signedCertificate, verifySignature, releaseTag = tag, bundle } = {}) {
  return publishRecipeRelease({
    tag: releaseTag,
    outDir,
    download: async (requestedTag, destination) => {
      expect(requestedTag).toBe(releaseTag);
      await writeFile(destination, bundle ?? tar(Object.entries(assets)));
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
      contract_version: "3.0.0",
      updated_at: updatedAt,
      source_commit: commit,
      sha256sums_sha256: sha256(assets.SHA256SUMS),
      catalog_index_sha256: sha256(assets["catalog-index.json"]),
    });
  });

  test("derives the small home summary from the verified index, with the page code", async () => {
    const assets = fixtureRelease();
    await publish(assets);
    const raw = await readFile(path.join(outDir, "catalog-summary.json"), "utf8");
    expect(raw.length).toBeLessThan(20_000);
    expect(JSON.parse(raw)).toMatchObject({
      summary_version: 1,
      release: tag,
      catalog_index_sha256: sha256(assets["catalog-index.json"]),
      verified: 1,
      families: 1,
      creators: 1,
      topCreators: [{ name: "Qwen", verified: 1 }],
      types: { language: 1, code: 1, vision: 0, image: 0, video: 0, audio: 0, "3d": 0 },
      updatedByDate: { "2026-09-01": 1 },
      newest: [{ publisher: "vonk-forge", slug: "qwen-fast", title: "Qwen Fast", creator: "Qwen", status: "Working", date: "2026-09-01" }],
    });
  });

  test("a release with nothing verified still builds, with a valid summary of zeros", async () => {
    const packageBytes = Buffer.from("fixture package");
    const assets = fixtureRelease({ index: { recipes: [fixtureRecipe(packageBytes, { qualification: { status: "Not yet verified" } })] } });
    await publish(assets);
    expect(JSON.parse(await readFile(path.join(outDir, "catalog-summary.json"), "utf8"))).toMatchObject({ verified: 0, families: 0, creators: 0, topCreators: [], newest: [{ status: "Not yet verified" }] });
  });

  test("still refuses an index the adapter cannot parse, keeping the previous catalog", async () => {
    await expect(publish(fixtureRelease({ index: { catalog_entities: [] } }))).rejects.toThrow("unsupported catalog index");
    await expectPreviousCatalogKept();
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

  test("rejects a listed file whose bytes differ from SHA256SUMS", async () => {
    const assets = { ...fixtureRelease(), "qwen-fast-single.tar.gz": Buffer.from("tampered") };
    await expect(publish(assets)).rejects.toThrow("qwen-fast-single.tar.gz does not match SHA256SUMS");
    await expectPreviousCatalogKept();
  });

  test("rejects a bundle that lacks a listed file or carries an unsigned one", async () => {
    const { "qwen-fast-single.tar.gz": _removed, ...without } = fixtureRelease();
    await expect(publish(without)).rejects.toThrow("missing from recipe-library.tar");
    await expect(publish({ ...fixtureRelease(), "extra.txt": Buffer.from("x") })).rejects.toThrow("not signed by SHA256SUMS");
    const { "SHA256SUMS.sigstore.json": _bundle, ...unsigned } = fixtureRelease();
    await expect(publish(unsigned)).rejects.toThrow("lacks SHA256SUMS");
    await expectPreviousCatalogKept();
  });

  test.each([
    ["a path traversal name", () => tar([["../evil", Buffer.from("x")]])],
    ["a nested name", () => tar([["dir/file", Buffer.from("x")]])],
    ["a symlink", () => tar([["link", Buffer.alloc(0)]], { type: "2" })],
    ["a directory", () => tar([["dir", Buffer.alloc(0)]], { type: "5" })],
    ["a ustar prefix", () => tar([["file", Buffer.from("x")]], { prefix: "dir" })],
    ["a duplicate member", () => tar([["file", Buffer.from("x")], ["file", Buffer.from("y")]])],
    ["a PAX header", () => tar([["pax", Buffer.from("x")]], { type: "x" })],
  ])("refuses a bundle with %s", async (_name, build) => {
    await expect(publish(fixtureRelease(), { bundle: build() })).rejects.toThrow("flat regular file");
    await expectPreviousCatalogKept();
  });

  test("refuses a truncated or corrupt bundle", async () => {
    const good = tar(Object.entries(fixtureRelease()));
    await expect(publish(fixtureRelease(), { bundle: good.subarray(0, good.length - 1500) })).rejects.toThrow();
    const corrupt = Buffer.from(good);
    corrupt[10] ^= 0xff;
    await expect(publish(fixtureRelease(), { bundle: corrupt })).rejects.toThrow("corrupt member header");
    await expectPreviousCatalogKept();
  });

  test("reads only what it extracts and never writes member names as paths", async () => {
    const file = path.join(root, "bundle.tar");
    await writeFile(file, tar([["a.json", Buffer.from("{}")]]));
    const members = await readBundle(file, new Set());
    expect(members.get("a.json")).toMatchObject({ size: 2, bytes: null });
    expect((await readdir(root)).sort()).toEqual(["bundle.tar", "public"]);
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
    await expect(publish(fixtureRelease(), { releaseTag: "v2.8.1" })).rejects.toThrow("contract major 3");
    await expect(publish(fixtureRelease({ index: { contract_version: "2.8.1" } }))).rejects.toThrow("unsupported contract version");
    await expectPreviousCatalogKept();
  });

  test("follows the newest non-draft release within the supported contract major", () => {
    const releases = [
      { tag_name: "v4.0.0", draft: false },
      { tag_name: "v3.10.0", draft: true },
      { tag_name: "v3.2.0", draft: false },
      { tag_name: "v3.10.1-rc", draft: false },
      { tag_name: "v3.9.3", draft: false },
      { tag_name: "v2.8.1", draft: false },
    ];
    expect(selectReleaseTag(releases)).toBe("v3.9.3");
    expect(() => selectReleaseTag([{ tag_name: "v1.0.0", draft: false }])).toThrow("no published release");
  });

  test("the scheduled check fails on a published newer contract major, naming both majors", () => {
    const published = (tag, draft = false) => ({ tag_name: tag, draft });
    expect(() => assertNoNewerMajor([published("v3.2.0"), published("v4.0.0")], 3)).toThrow(/major 4.*supports major 3/);
    expect(() => assertNoNewerMajor([published("v3.2.0"), published("v4.0.0", true), published("v2.9.0")], 3)).not.toThrow();
  });

  test("parses only well-formed checksum manifests", () => {
    expect(parseChecksums(`${"0".repeat(64)}  a.json\n`).get("a.json")).toBe("0".repeat(64));
    expect(() => parseChecksums(`${"0".repeat(64)}  ../a.json\n`)).toThrow("malformed");
    expect(() => parseChecksums(`${"0".repeat(64)}  a\n${"1".repeat(64)}  a\n`)).toThrow("twice");
    expect(() => parseChecksums("")).toThrow("empty");
  });
});
