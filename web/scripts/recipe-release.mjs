#!/usr/bin/env node
// Fetch the signed vonk-forge-recipes release the site publishes, verify it,
// and write the catalog files the browser reads into web/public/catalog.
//
// The release is read from one asset, recipe-library.tar: an uncompressed tar
// of SHA256SUMS, its Sigstore bundle and every file SHA256SUMS lists. A single
// asset is downloaded atomically, unlike the per-file assets the library
// replaces one at a time.
//
// Trust anchor (the same one the Controller uses): SHA256SUMS must carry a
// Sigstore attestation from publish.yml on refs/heads/main of the recipe
// repository, built on a GitHub-hosted runner. The tar must hold exactly
// SHA256SUMS, its bundle and the listed files, and every listed member must
// match its SHA256SUMS digest. Any failure exits non-zero and leaves the
// previous output untouched, so the Pages deployment never publishes
// unverified data.
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

export const RECIPE_REPOSITORY = "CarstVaartjes/vonk-forge-recipes";
export const RECIPE_REPOSITORY_ID = "1336002555";
export const SIGNER_WORKFLOW = `${RECIPE_REPOSITORY}/.github/workflows/publish.yml`;
export const SIGNER_REF = "refs/heads/main";
// The recipe/model contract major this site renders. The library's release tag
// is the contract version; recipe updates replace that release's assets in place.
export const SUPPORTED_CONTRACT_MAJOR = 2;

const TAG = /^v\d+\.\d+\.\d+$/;
const DIGEST = /^[0-9a-f]{64}$/;
const COMMIT = /^[0-9a-f]{40}$/;
const ASSET_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
export const BUNDLE_ASSET = "recipe-library.tar";
const CHECKSUMS_ASSET = "SHA256SUMS";
const ATTESTATION_ASSET = "SHA256SUMS.sigstore.json";
const DOWNLOAD_ATTEMPTS = 3;

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

function semver(tag) {
  const match = typeof tag === "string" ? tag.match(/^v(\d+)\.(\d+)\.(\d+)$/) : null;
  return match ? match.slice(1).map(Number) : null;
}

// Pick the newest non-draft release whose tag major is the supported contract major.
export function selectReleaseTag(releases, major = SUPPORTED_CONTRACT_MAJOR) {
  let best = null;
  for (const release of Array.isArray(releases) ? releases : []) {
    const version = semver(release?.tag_name);
    if (release?.draft || !version || version[0] !== major) continue;
    if (!best || version[1] > best.version[1] || (version[1] === best.version[1] && version[2] > best.version[2])) {
      best = { tag: release.tag_name, version };
    }
  }
  if (!best) fail(`no published release for contract major ${major}`);
  return best.tag;
}

export async function resolveReleaseTag(fetchImpl = fetch, token = process.env.GH_TOKEN) {
  const releases = [];
  for (let page = 1; ; page += 1) {
    const response = await fetchImpl(`https://api.github.com/repos/${RECIPE_REPOSITORY}/releases?per_page=100&page=${page}`, {
      headers: { Accept: "application/vnd.github+json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!response.ok) fail(`release listing returned ${response.status}`);
    const batch = await response.json();
    if (!Array.isArray(batch)) fail("release listing is not a list");
    releases.push(...batch);
    if (batch.length < 100) break;
  }
  return selectReleaseTag(releases);
}

const cString = (bytes) => {
  const end = bytes.indexOf(0);
  return bytes.subarray(0, end < 0 ? bytes.length : end).toString("utf8");
};

function tarNumber(field, what) {
  if (field[0] & 0x80) fail(`tar ${what} uses an unsupported encoding`);
  const text = cString(field).trim();
  if (!/^[0-7]+$/.test(text)) fail(`tar ${what} is not a number`);
  return Number.parseInt(text, 8);
}

// Parse an extended header ("<len> <key>=<value>\n" records) for path and size.
function paxRecords(body) {
  const records = {};
  let offset = 0;
  while (offset < body.length) {
    const space = body.indexOf(0x20, offset);
    const length = Number(body.subarray(offset, space).toString("ascii"));
    if (space < 0 || !Number.isInteger(length) || length < 1 || offset + length > body.length) fail("malformed tar extended header");
    const record = body.subarray(space + 1, offset + length - 1).toString("utf8");
    const equals = record.indexOf("=");
    if (equals < 0) fail("malformed tar extended header");
    records[record.slice(0, equals)] = record.slice(equals + 1);
    offset += length;
  }
  return records;
}

/**
 * Read an uncompressed ustar/PAX archive into a Map of member name to bytes.
 * Only regular files with flat asset names are accepted; directories, links,
 * devices, duplicate names and truncated archives are rejected.
 */
export function readTar(buffer) {
  const members = new Map();
  let offset = 0;
  let extended = {};
  for (;;) {
    if (offset + 512 > buffer.length) fail("tar archive is truncated");
    const header = buffer.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) {
      if (Object.keys(extended).length) fail("tar archive ends after an extended header");
      if (!buffer.subarray(offset).every((byte) => byte === 0)) fail("tar archive has data after its end");
      return members;
    }
    let checksum = 0;
    for (let index = 0; index < 512; index += 1) checksum += index >= 148 && index < 156 ? 0x20 : header[index];
    if (tarNumber(header.subarray(148, 156), "checksum") !== checksum) fail("tar header checksum does not match");
    const type = String.fromCharCode(header[156] || 0x30);
    let size = tarNumber(header.subarray(124, 136), "size");
    const bodyStart = offset + 512;
    const bodyEnd = () => bodyStart + size;
    if (type === "x") {
      if (bodyEnd() > buffer.length) fail("tar archive is truncated");
      extended = { ...extended, ...paxRecords(buffer.subarray(bodyStart, bodyEnd())) };
      offset = bodyStart + Math.ceil(size / 512) * 512;
      continue;
    }
    if (type !== "0") fail(`tar member type ${JSON.stringify(type)} is not a regular file`);
    const prefix = header.subarray(257, 262).toString("ascii") === "ustar" ? cString(header.subarray(345, 500)) : "";
    const ownName = cString(header.subarray(0, 100));
    const name = extended.path ?? (prefix ? `${prefix}/${ownName}` : ownName);
    if (extended.size !== undefined) size = Number(extended.size);
    extended = {};
    if (!ASSET_NAME.test(name)) fail(`tar member name ${JSON.stringify(name)} is not a flat asset name`);
    if (members.has(name)) fail(`tar lists ${name} twice`);
    if (!Number.isSafeInteger(size) || size < 0 || bodyEnd() > buffer.length) fail("tar archive is truncated");
    members.set(name, buffer.subarray(bodyStart, bodyEnd()));
    offset = bodyStart + Math.ceil(size / 512) * 512;
  }
}

const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

// The bundle is replaced in place by the library's publication, so it can be
// briefly absent or fail mid-transfer: retry a few times before giving up.
export function downloadBundle(fetchImpl = fetch, wait = pause) {
  return async (tag) => {
    let problem = "";
    for (let attempt = 1; attempt <= DOWNLOAD_ATTEMPTS; attempt += 1) {
      if (attempt > 1) await wait(5000 * (attempt - 1));
      try {
        const response = await fetchImpl(`https://github.com/${RECIPE_REPOSITORY}/releases/download/${tag}/${BUNDLE_ASSET}`);
        if (response.ok) return Buffer.from(await response.arrayBuffer());
        problem = `returned ${response.status}`;
      } catch (error) {
        problem = `failed: ${error instanceof Error ? error.message : error}`;
      }
    }
    return fail(`${BUNDLE_ASSET} download ${problem}`);
  };
}

/**
 * Download, verify, and write one release into `outDir`.
 * `downloadBundle(tag)` returns recipe-library.tar's bytes; `verifySignature(checksumsPath, bundlePath)`
 * returns the verified certificate claims or throws.
 */
export async function publishRecipeRelease({ tag, outDir, downloadBundle: download, verifySignature = verifyWithGh }) {
  if (typeof tag !== "string" || !TAG.test(tag)) fail(`invalid release tag ${JSON.stringify(tag)}`);
  if (semver(tag)[0] !== SUPPORTED_CONTRACT_MAJOR) fail(`release ${tag} is not for contract major ${SUPPORTED_CONTRACT_MAJOR}`);
  const parent = path.dirname(path.resolve(outDir));
  await mkdir(parent, { recursive: true });
  const staging = await mkdtemp(path.join(parent, ".catalog-staging-"));
  try {
    const members = readTar(await download(tag));
    const checksums = members.get(CHECKSUMS_ASSET);
    const bundle = members.get(ATTESTATION_ASSET);
    if (!checksums || !bundle) fail(`${BUNDLE_ASSET} lacks ${CHECKSUMS_ASSET} or ${ATTESTATION_ASSET}`);
    await writeFile(path.join(staging, CHECKSUMS_ASSET), checksums);
    await writeFile(path.join(staging, ATTESTATION_ASSET), bundle);

    const certificate = await verifySignature(path.join(staging, "SHA256SUMS"), path.join(staging, "SHA256SUMS.sigstore.json"));
    if (certificate?.sourceRepositoryIdentifier !== RECIPE_REPOSITORY_ID) fail("attestation is from another repository");
    if (certificate?.sourceRepositoryRef !== SIGNER_REF) fail("attestation is not from refs/heads/main");
    if (certificate?.runnerEnvironment !== "github-hosted") fail("attestation was not built on a GitHub-hosted runner");
    const signedCommit = certificate?.sourceRepositoryDigest;
    if (typeof signedCommit !== "string" || !COMMIT.test(signedCommit)) fail("attestation names no source commit");

    // The signed manifest is the only authority: the tar holds exactly it, its
    // bundle and the files it lists, and each listed member matches its digest.
    const digests = parseChecksums(checksums.toString("utf8"));
    const unlisted = [...members.keys()].filter((name) => name !== CHECKSUMS_ASSET && name !== ATTESTATION_ASSET && !digests.has(name));
    if (unlisted.length) fail(`${BUNDLE_ASSET} holds files SHA256SUMS does not list: ${unlisted.slice(0, 3).join(", ")}`);
    for (const [name, digest] of digests) {
      const member = members.get(name);
      if (!member) fail(`${BUNDLE_ASSET} lacks ${name}, which SHA256SUMS lists`);
      if (sha256(member) !== digest) fail(`${name} does not match SHA256SUMS`);
    }
    const indexBytes = members.get("catalog-index.json");
    if (!indexBytes) fail("SHA256SUMS does not list catalog-index.json");
    const index = JSON.parse(indexBytes.toString("utf8"));
    if (index.kind !== "recipe-library-index" || index.schema_version !== 2) fail("unsupported catalog index");
    if (semver(`v${index.contract_version}`)?.[0] !== SUPPORTED_CONTRACT_MAJOR) fail(`unsupported contract version ${JSON.stringify(index.contract_version)}`);
    if (typeof index.updated_at !== "string" || Number.isNaN(Date.parse(index.updated_at))) fail("index has no updated_at");
    if (index.repository !== RECIPE_REPOSITORY) fail(`index names repository ${index.repository}`);
    if (index.source_commit !== signedCommit) fail("index source_commit differs from the signed commit");
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

    await writeFile(path.join(staging, "catalog-index.json"), indexBytes);
    await writeFile(path.join(staging, "release.json"), `${JSON.stringify({
      repository: RECIPE_REPOSITORY,
      tag,
      contract_version: index.contract_version,
      updated_at: index.updated_at,
      source_commit: signedCommit,
      sha256sums_sha256: sha256(checksums),
      catalog_index_sha256: digests.get("catalog-index.json"),
    }, null, 2)}\n`);
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
  await publishRecipeRelease({ tag, outDir, downloadBundle: downloadBundle() });
  console.log(`Verified ${RECIPE_REPOSITORY} ${tag} and wrote ${path.relative(process.cwd(), outDir)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
