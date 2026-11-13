// @vitest-environment node
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { catalogIndexFixture } from "../src/api/catalog.fixture.ts";
import { SCHEMA_NAME, latestReleaseTag, parseChecksums, publishRecipeRelease, readBundle, resolveReleaseTag } from "./recipe-release.mjs";

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
const tag = "v4.8.0";
const updatedAt = "2026-09-28T20:04:06Z";

// One model and one verified recipe: the smallest catalog the site accepts, taken from the
// real entries the adapter tests share (the first recipe is Working and selects the first model).
const [fixtureModel] = catalogIndexFixture.catalog_entities;
const fixtureRecipe = (packageBytes, overrides = {}) => ({
  ...catalogIndexFixture.recipes[0],
  package: {
    ...catalogIndexFixture.recipes[0].package,
    path: "packages/qwen-fast-single.tar.gz",
    sha256: sha256(packageBytes),
    expected_bytes: packageBytes.length,
  },
  ...overrides,
});

// The envelope constants of the schema the release ships, verbatim from catalog-index-v2.schema.json.
const fixtureSchema = {
  components: {
    schemas: {
      CatalogIndex: {
        properties: {
          schema_version: { const: 2, title: "Schema Version", type: "integer" },
          kind: { const: "recipe-library-index", title: "Kind", type: "string" },
        },
      },
      PackageContract: { properties: { schema_version: { const: 2, title: "Schema Version", type: "integer" } } },
    },
  },
};

// A fixture release shaped like vonk-forge-recipes publish.yml output.
function fixtureRelease({ index: indexOverride = {}, checksums: checksumsOverride, schema: schemaOverride } = {}) {
  const packageBytes = Buffer.from("fixture package");
  const index = {
    ...catalogIndexFixture,
    updated_at: updatedAt,
    source_commit: commit,
    catalog_entities: [fixtureModel],
    recipes: [fixtureRecipe(packageBytes)],
    ...indexOverride,
  };
  const indexBytes = Buffer.from(JSON.stringify(index));
  const schemaBytes = Buffer.from(JSON.stringify(schemaOverride ?? fixtureSchema));
  const assets = {
    "catalog-index.json": indexBytes,
    [SCHEMA_NAME]: schemaBytes,
    "qwen-fast-single.tar.gz": packageBytes,
    "SHA256SUMS.sigstore.json": Buffer.from("{}"),
  };
  assets.SHA256SUMS = Buffer.from(checksumsOverride ?? [
    `${sha256(indexBytes)}  catalog-index.json`,
    `${sha256(schemaBytes)}  ${SCHEMA_NAME}`,
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
    expect(await readFile(path.join(outDir, SCHEMA_NAME))).toEqual(assets[SCHEMA_NAME]);
    expect(JSON.parse(await readFile(path.join(outDir, "release.json"), "utf8"))).toEqual({
      repository: "CarstVaartjes/vonk-forge-recipes",
      tag,
      contract_version: catalogIndexFixture.contract_version,
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
      summary_version: 2,
      release: tag,
      total: 1,
      catalog_index_sha256: sha256(assets["catalog-index.json"]),
      verified: 1,
      families: 1,
      creators: 1,
      topCreators: [{ name: "NVIDIA", verified: 1 }],
      types: [
        { id: "language", label: "Language", verified: 1 }, { id: "code", label: "Code", verified: 0 }, { id: "vision", label: "Vision", verified: 1 },
        { id: "image", label: "Image", verified: 0 }, { id: "video", label: "Video", verified: 0 }, { id: "audio", label: "Audio", verified: 1 },
        { id: "3d", label: "3D", verified: 0 }, { id: "other", label: "Other", verified: 0 },
      ],
    });
  });

  test("a release with nothing verified still builds, with a valid summary of zeros", async () => {
    const packageBytes = Buffer.from("fixture package");
    const assets = fixtureRelease({ index: { recipes: [fixtureRecipe(packageBytes, { qualification: { status: "Not yet verified" } })] } });
    await publish(assets);
    expect(JSON.parse(await readFile(path.join(outDir, "catalog-summary.json"), "utf8"))).toMatchObject({ verified: 0, families: 0, creators: 0, topCreators: [] });
  });

  test("still refuses an index the adapter cannot parse, keeping the previous catalog", async () => {
    await expect(publish(fixtureRelease({ index: { catalog_entities: [] } }))).rejects.toThrow("unsupported catalog index");
    await expectPreviousCatalogKept();
  });

  test("checks the envelope against the constants of the schema the release ships", async () => {
    await expect(publish(fixtureRelease({ index: { schema_version: 3 } }))).rejects.toThrow("unsupported catalog index");
    await expect(publish(fixtureRelease({ index: { kind: "something-else" } }))).rejects.toThrow("unsupported catalog index");
    await expect(publish(fixtureRelease({ index: { package_contract: { ...catalogIndexFixture.package_contract, schema_version: 3 } } }))).rejects.toThrow("unsupported package contract");
    await expect(publish(fixtureRelease({ schema: { components: { schemas: {} } } }))).rejects.toThrow("declares no envelope constants");
    await expectPreviousCatalogKept();
  });

  test("refuses a release whose bundle lacks the signed schema", async () => {
    const { [SCHEMA_NAME]: _schema, ...without } = fixtureRelease();
    // SHA256SUMS still lists it, so the bundle is incomplete.
    await expect(publish(without)).rejects.toThrow(`${SCHEMA_NAME} is listed in SHA256SUMS but missing`);
    const unlisted = fixtureRelease();
    unlisted.SHA256SUMS = Buffer.from(unlisted.SHA256SUMS.toString().split("\n").filter((line) => !line.includes(SCHEMA_NAME)).join("\n"));
    await expect(publish(unlisted)).rejects.toThrow(`${SCHEMA_NAME} is in recipe-library.tar but not signed`);
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

  test("follows a release of any contract major, and requires the index to match its tag", async () => {
    await publish(fixtureRelease({ index: { contract_version: "5.0.0" } }), { releaseTag: "v5.0.0" });
    expect(JSON.parse(await readFile(path.join(outDir, "release.json"), "utf8"))).toMatchObject({ tag: "v5.0.0", contract_version: "5.0.0" });
    await expect(publish(fixtureRelease(), { releaseTag: "v5.0.0" })).rejects.toThrow(`index contract_version "${catalogIndexFixture.contract_version}" is not release v5.0.0`);
  });

  test("resolves the library's latest release, which publish marks --latest", async () => {
    const asked = [];
    const answer = (body, ok = true) => async (url) => { asked.push(url); return { ok, status: ok ? 200 : 503, json: async () => body }; };
    await expect(resolveReleaseTag(answer({ tag_name: "v5.0.0", draft: false, prerelease: false }), "token")).resolves.toBe("v5.0.0");
    expect(asked).toEqual(["https://api.github.com/repos/CarstVaartjes/vonk-forge-recipes/releases/latest"]);
    await expect(resolveReleaseTag(answer({}, false))).rejects.toThrow("returned 503");
    expect(() => latestReleaseTag({ tag_name: "main" })).toThrow("not a published release tag");
    expect(() => latestReleaseTag({ tag_name: "v4.9.0", draft: true })).toThrow("not a published release tag");
  });

  test("parses only well-formed checksum manifests", () => {
    expect(parseChecksums(`${"0".repeat(64)}  a.json\n`).get("a.json")).toBe("0".repeat(64));
    expect(() => parseChecksums(`${"0".repeat(64)}  ../a.json\n`)).toThrow("malformed");
    expect(() => parseChecksums(`${"0".repeat(64)}  a\n${"1".repeat(64)}  a\n`)).toThrow("twice");
    expect(() => parseChecksums("")).toThrow("empty");
  });
});
