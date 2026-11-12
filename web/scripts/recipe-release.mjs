#!/usr/bin/env node
// Fetch the signed vonk-forge-recipes release the site publishes, verify it,
// and write the catalog files the browser reads into web/public/catalog.
//
// The release is read from its single `recipe-library.tar` asset: an
// uncompressed tar of flat regular files (SHA256SUMS, SHA256SUMS.sigstore.json
// and every file SHA256SUMS lists). It is read member by member without ever
// trusting a member name as a path.
//
// Trust anchor (the same one the Controller uses): SHA256SUMS must carry a
// Sigstore attestation from publish.yml on refs/heads/main of the recipe
// repository, built on a GitHub-hosted runner. Every file in the bundle must
// match its SHA256SUMS digest. Any failure exits non-zero and leaves the
// previous output untouched, so the Pages deployment never publishes
// unverified data.
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { chmod, mkdir, mkdtemp, open, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";

// The home-page summary is derived with the same TypeScript the pages use (Node strips the types).
import { buildCatalogSummary } from "../src/catalog-summary.ts";

export const RECIPE_REPOSITORY = "CarstVaartjes/vonk-forge-recipes";
export const RECIPE_REPOSITORY_ID = "1336002555";
export const SIGNER_WORKFLOW = `${RECIPE_REPOSITORY}/.github/workflows/publish.yml`;
export const SIGNER_REF = "refs/heads/main";
// The site follows the library's newest release, whatever its contract major: the release tag
// is the contract version, and recipe updates replace that release's assets in place. A breaking
// major turns CI and the deploy red at `tsc`, against the schema that release ships, until the
// fix lands (docs/operations/cloudflare-pages.md).

// The release ships the JSON Schema of its own catalog-index.json (an OpenAPI components
// document). Its constants are the envelope checks, and web/scripts/generate-catalog-types.mjs
// compiles the site's types from it.
export const SCHEMA_NAME = "catalog-index-v2.schema.json";

const TAG = /^v\d+\.\d+\.\d+$/;
const DIGEST = /^[0-9a-f]{64}$/;
const COMMIT = /^[0-9a-f]{40}$/;
const BUNDLE_NAME = "recipe-library.tar";
const CHECKSUMS_NAME = "SHA256SUMS";
const SIGNATURE_NAME = "SHA256SUMS.sigstore.json";
const MAX_BUNDLE_BYTES = 4 * 1024 ** 3;
const MAX_BUNDLE_MEMBERS = 8192;
const MAX_SMALL_BYTES = 64 * 1024 * 1024; // SHA256SUMS, its bundle, the index
const BLOCK = 512;
const ASSET_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function fail(message) {
  throw new Error(`recipe release rejected: ${message}`);
}

export function parseChecksums(text) {
  const digests = new Map();
  for (const line of text.split("\n")) {
    if (!line) continue;
    const match = line.match(/^([0-9a-f]{64}) [ *]([^/\\]+)$/);
    if (!match || !ASSET_NAME.test(match[2])) fail(`malformed SHA256SUMS line: ${JSON.stringify(line)}`);
    if (digests.has(match[2])) fail(`SHA256SUMS lists ${match[2]} twice`);
    digests.set(match[2], match[1]);
  }
  if (!digests.size) fail("SHA256SUMS is empty");
  return digests;
}

// Verify the Sigstore bundle with the GitHub CLI and return the signing
// certificate's claims. `gh` checks the signature, the transparency log, the
// signer workflow, the source ref, and that the attestation's subject is this
// exact SHA256SUMS file.
export async function verifyWithGh(checksumsPath, bundlePath) {
  const { stdout } = await promisify(execFile)("gh", [
    "attestation", "verify", checksumsPath,
    "--bundle", bundlePath,
    "--repo", RECIPE_REPOSITORY,
    "--signer-workflow", SIGNER_WORKFLOW,
    "--source-ref", SIGNER_REF,
    "--deny-self-hosted-runners",
    "--format", "json",
  ], { maxBuffer: 16 * 1024 * 1024 });
  const results = JSON.parse(stdout);
  if (!Array.isArray(results) || results.length !== 1) fail("expected exactly one verified attestation");
  return results[0].verificationResult.signature.certificate;
}

// The library marks its newest published release `--latest`; GitHub's "latest release" is that one.
export function latestReleaseTag(release) {
  if (release?.draft || release?.prerelease || typeof release?.tag_name !== "string" || !TAG.test(release.tag_name)) {
    fail(`latest release ${JSON.stringify(release?.tag_name)} is not a published release tag`);
  }
  return release.tag_name;
}

export async function resolveReleaseTag(fetchImpl = fetch, token = process.env.GH_TOKEN) {
  const response = await fetchImpl(`https://api.github.com/repos/${RECIPE_REPOSITORY}/releases/latest`, {
    headers: { Accept: "application/vnd.github+json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!response.ok) fail(`latest release lookup returned ${response.status}`);
  return latestReleaseTag(await response.json());
}

// Stream the release's single bundle asset to `destination`, bounded in size.
export function downloadBundle(fetchImpl = fetch) {
  return async (tag, destination) => {
    const response = await fetchImpl(`https://github.com/${RECIPE_REPOSITORY}/releases/download/${tag}/${BUNDLE_NAME}`);
    if (!response.ok || !response.body) fail(`${BUNDLE_NAME} download returned ${response.status}`);
    let received = 0;
    const bound = new Transform({
      transform(chunk, _encoding, callback) {
        received += chunk.length;
        callback(received > MAX_BUNDLE_BYTES ? new Error(`recipe release rejected: ${BUNDLE_NAME} exceeds ${MAX_BUNDLE_BYTES} bytes`) : null, chunk);
      },
    });
    await pipeline(Readable.fromWeb(response.body), bound, createWriteStream(destination));
  };
}

function octal(field, what) {
  const text = field.toString("latin1").replace(/\0.*$/s, "").trim();
  if (!/^[0-7]+$/.test(text)) fail(`bundle has an unsupported ${what} field`);
  return parseInt(text, 8);
}

/**
 * Read a bundle tar, rejecting anything but unique flat regular files. Returns
 * a Map of member name to { size, digest, bytes } where `bytes` is kept only
 * for the small members the trust chain needs (SHA256SUMS, its Sigstore
 * bundle, the index). Nothing from the archive is written under its own name.
 */
export async function readBundle(file, keep = new Set([CHECKSUMS_NAME, SIGNATURE_NAME, SCHEMA_NAME, "catalog-index.json"])) {
  const handle = await open(file, "r");
  try {
    const total = (await handle.stat()).size;
    if (total > MAX_BUNDLE_BYTES) fail(`${BUNDLE_NAME} exceeds ${MAX_BUNDLE_BYTES} bytes`);
    const members = new Map();
    const header = Buffer.alloc(BLOCK);
    const chunk = Buffer.alloc(1024 * 1024);
    const readAt = async (buffer, length, position) => {
      const { bytesRead } = await handle.read(buffer, 0, length, position);
      if (bytesRead !== length) fail(`${BUNDLE_NAME} is truncated`);
    };
    let offset = 0;
    for (;;) {
      if (offset + BLOCK > total) fail(`${BUNDLE_NAME} has no end-of-archive marker`);
      await readAt(header, BLOCK, offset);
      offset += BLOCK;
      if (header.every((byte) => byte === 0)) break;
      let sum = 0;
      for (let i = 0; i < BLOCK; i += 1) sum += i >= 148 && i < 156 ? 32 : header[i];
      if (octal(header.subarray(148, 156), "checksum") !== sum) fail(`${BUNDLE_NAME} has a corrupt member header`);
      const name = header.subarray(0, 100).toString("latin1").replace(/\0.*$/s, "");
      const type = String.fromCharCode(header[156]);
      if ((type !== "0" && type !== "\0") || header[345] !== 0 || !ASSET_NAME.test(name) || members.has(name) || members.size >= MAX_BUNDLE_MEMBERS) {
        fail(`bundle member ${JSON.stringify(name)} is not a unique flat regular file`);
      }
      const size = octal(header.subarray(124, 136), "size");
      if (offset + size > total || (keep.has(name) && size > MAX_SMALL_BYTES)) fail(`bundle member ${name} has an invalid size`);
      const hash = createHash("sha256");
      const parts = [];
      for (let done = 0; done < size;) {
        const length = Math.min(chunk.length, size - done);
        await readAt(chunk, length, offset + done);
        hash.update(chunk.subarray(0, length));
        if (keep.has(name)) parts.push(Buffer.from(chunk.subarray(0, length)));
        done += length;
      }
      members.set(name, { size, digest: hash.digest("hex"), bytes: keep.has(name) ? Buffer.concat(parts) : null });
      offset += Math.ceil(size / BLOCK) * BLOCK;
    }
    return members;
  } finally {
    await handle.close();
  }
}

// The envelope constants the release's own schema declares.
function envelopeConstants(schema) {
  const schemas = schema?.components?.schemas;
  const properties = schemas?.CatalogIndex?.properties;
  const constants = {
    schemaVersion: properties?.schema_version?.const,
    kind: properties?.kind?.const,
    packageSchemaVersion: schemas?.PackageContract?.properties?.schema_version?.const,
  };
  if (Object.values(constants).some((value) => value === undefined)) fail(`${SCHEMA_NAME} declares no envelope constants`);
  return constants;
}

/**
 * Download, verify, and write one release into `outDir`.
 * `download(tag, destination)` writes the release's bundle tar to `destination`; `verifySignature(checksumsPath, bundlePath)`
 * returns the verified certificate claims or throws.
 */
export async function publishRecipeRelease({ tag, outDir, download, verifySignature = verifyWithGh }) {
  if (typeof tag !== "string" || !TAG.test(tag)) fail(`invalid release tag ${JSON.stringify(tag)}`);
  const parent = path.dirname(path.resolve(outDir));
  await mkdir(parent, { recursive: true });
  const staging = await mkdtemp(path.join(parent, ".catalog-staging-"));
  try {
    const tarPath = path.join(staging, `.${BUNDLE_NAME}`);
    await download(tag, tarPath);
    const members = await readBundle(tarPath);
    await rm(tarPath);
    const checksums = members.get(CHECKSUMS_NAME)?.bytes;
    const bundle = members.get(SIGNATURE_NAME)?.bytes;
    if (!checksums || !bundle) fail(`${BUNDLE_NAME} lacks ${CHECKSUMS_NAME} or ${SIGNATURE_NAME}`);
    await writeFile(path.join(staging, CHECKSUMS_NAME), checksums);
    await writeFile(path.join(staging, SIGNATURE_NAME), bundle);

    const certificate = await verifySignature(path.join(staging, CHECKSUMS_NAME), path.join(staging, SIGNATURE_NAME));
    if (certificate?.sourceRepositoryIdentifier !== RECIPE_REPOSITORY_ID) fail("attestation is from another repository");
    if (certificate?.sourceRepositoryRef !== SIGNER_REF) fail("attestation is not from refs/heads/main");
    if (certificate?.runnerEnvironment !== "github-hosted") fail("attestation was not built on a GitHub-hosted runner");
    const signedCommit = certificate?.sourceRepositoryDigest;
    if (typeof signedCommit !== "string" || !COMMIT.test(signedCommit)) fail("attestation names no source commit");

    const digests = parseChecksums(checksums.toString("utf8"));
    // Every listed file must be in the bundle with its signed digest, and the
    // bundle holds nothing else but SHA256SUMS and its Sigstore bundle.
    for (const [name, digest] of digests) {
      const member = members.get(name);
      if (!member) fail(`${name} is listed in SHA256SUMS but missing from ${BUNDLE_NAME}`);
      if (member.digest !== digest) fail(`${name} does not match SHA256SUMS`);
    }
    for (const name of members.keys()) {
      if (name !== CHECKSUMS_NAME && name !== SIGNATURE_NAME && !digests.has(name)) fail(`${name} is in ${BUNDLE_NAME} but not signed by SHA256SUMS`);
    }
    const indexBytes = members.get("catalog-index.json")?.bytes;
    if (!indexBytes) fail("catalog-index.json is missing from SHA256SUMS");
    const schemaBytes = members.get(SCHEMA_NAME)?.bytes;
    if (!schemaBytes || !digests.has(SCHEMA_NAME)) fail(`${SCHEMA_NAME} is missing from SHA256SUMS`);
    const constants = envelopeConstants(JSON.parse(schemaBytes.toString("utf8")));
    const index = JSON.parse(indexBytes.toString("utf8"));
    if (index.kind !== constants.kind || index.schema_version !== constants.schemaVersion) fail("unsupported catalog index");
    if (`v${index.contract_version}` !== tag) fail(`index contract_version ${JSON.stringify(index.contract_version)} is not release ${tag}`);
    if (typeof index.updated_at !== "string" || Number.isNaN(Date.parse(index.updated_at))) fail("index has no updated_at");
    if (index.repository !== RECIPE_REPOSITORY) fail(`index names repository ${index.repository}`);
    if (index.source_commit !== signedCommit) fail("index source_commit differs from the signed commit");
    if (index.package_contract?.schema_version !== constants.packageSchemaVersion) fail("unsupported package contract");
    const prefix = index.package_contract?.path_prefix;
    if (typeof prefix !== "string" || !Array.isArray(index.recipes)) fail("index has no package contract");
    for (const recipe of index.recipes) {
      const packagePath = recipe?.package?.path;
      const name = typeof packagePath === "string" && packagePath.startsWith(prefix) ? packagePath.slice(prefix.length) : "";
      if (!ASSET_NAME.test(name)) fail(`package path ${JSON.stringify(packagePath)} is not a release asset`);
      if (!DIGEST.test(recipe.package.sha256 ?? "") || digests.get(name) !== recipe.package.sha256) {
        fail(`package ${name} is not signed with the digest the index declares`);
      }
    }

    const manifest = {
      repository: RECIPE_REPOSITORY,
      tag,
      contract_version: index.contract_version,
      updated_at: index.updated_at,
      source_commit: signedCommit,
      sha256sums_sha256: sha256(checksums),
      catalog_index_sha256: digests.get("catalog-index.json"),
    };
    // The summary the home page reads instead of the full index. An index the
    // adapter refuses fails the build here; a release with nothing verified is a valid summary of zeros.
    const summary = buildCatalogSummary(index, manifest);
    await writeFile(path.join(staging, "catalog-index.json"), indexBytes);
    await writeFile(path.join(staging, SCHEMA_NAME), schemaBytes);
    await writeFile(path.join(staging, "release.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    await writeFile(path.join(staging, "catalog-summary.json"), `${JSON.stringify(summary)}\n`);
    await chmod(staging, 0o755);
    await rm(outDir, { recursive: true, force: true });
    await rename(staging, outDir);
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}

async function main() {
  const webRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const outDir = path.join(webRoot, "public", "catalog");
  const tag = process.env.VONK_RECIPE_RELEASE || await resolveReleaseTag();
  await publishRecipeRelease({ tag, outDir, download: downloadBundle() });
  console.log(`Verified ${RECIPE_REPOSITORY} ${tag} and wrote ${path.relative(process.cwd(), outDir)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
