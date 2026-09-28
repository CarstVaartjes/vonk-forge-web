#!/usr/bin/env node
// Fetch the signed vonk-forge-recipes release the site publishes, verify it,
// and write the catalog files the browser reads into web/public/catalog.
//
// Trust anchor (the same one the Controller uses): SHA256SUMS must carry a
// Sigstore attestation from publish.yml on refs/heads/main of the recipe
// repository, built on a GitHub-hosted runner. Every file written here must
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

const TAG = /^v\d+\.\d+\.\d+$/;
const DIGEST = /^[0-9a-f]{64}$/;
const COMMIT = /^[0-9a-f]{40}$/;
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

export async function resolveLatestTag(fetchImpl = fetch, token = process.env.GH_TOKEN) {
  const response = await fetchImpl(`https://api.github.com/repos/${RECIPE_REPOSITORY}/releases/latest`, {
    headers: { Accept: "application/vnd.github+json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!response.ok) fail(`latest release lookup returned ${response.status}`);
  return (await response.json()).tag_name;
}

export function downloadAsset(fetchImpl = fetch) {
  return async (tag, name) => {
    const response = await fetchImpl(`https://github.com/${RECIPE_REPOSITORY}/releases/download/${tag}/${name}`);
    if (!response.ok) fail(`${name} download returned ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  };
}

/**
 * Download, verify, and write one release into `outDir`.
 * `download(tag, name)` returns an asset's bytes; `verifySignature(checksumsPath, bundlePath)`
 * returns the verified certificate claims or throws.
 */
export async function publishRecipeRelease({ tag, outDir, download, verifySignature = verifyWithGh }) {
  if (typeof tag !== "string" || !TAG.test(tag)) fail(`invalid release tag ${JSON.stringify(tag)}`);
  const parent = path.dirname(path.resolve(outDir));
  await mkdir(parent, { recursive: true });
  const staging = await mkdtemp(path.join(parent, ".catalog-staging-"));
  try {
    const checksums = await download(tag, "SHA256SUMS");
    const bundle = await download(tag, "SHA256SUMS.sigstore.json");
    await writeFile(path.join(staging, "SHA256SUMS"), checksums);
    await writeFile(path.join(staging, "SHA256SUMS.sigstore.json"), bundle);

    const certificate = await verifySignature(path.join(staging, "SHA256SUMS"), path.join(staging, "SHA256SUMS.sigstore.json"));
    if (certificate?.sourceRepositoryIdentifier !== RECIPE_REPOSITORY_ID) fail("attestation is from another repository");
    if (certificate?.sourceRepositoryRef !== SIGNER_REF) fail("attestation is not from refs/heads/main");
    if (certificate?.runnerEnvironment !== "github-hosted") fail("attestation was not built on a GitHub-hosted runner");
    const signedCommit = certificate?.sourceRepositoryDigest;
    if (typeof signedCommit !== "string" || !COMMIT.test(signedCommit)) fail("attestation names no source commit");

    const digests = parseChecksums(checksums.toString("utf8"));
    const indexBytes = await download(tag, "catalog-index.json");
    if (sha256(indexBytes) !== digests.get("catalog-index.json")) fail("catalog-index.json does not match SHA256SUMS");
    const index = JSON.parse(indexBytes.toString("utf8"));
    if (index.kind !== "recipe-library-index" || index.schema_version !== 2) fail("unsupported catalog index");
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
  const tag = process.env.VONK_RECIPE_RELEASE || await resolveLatestTag();
  await publishRecipeRelease({ tag, outDir, download: downloadAsset() });
  console.log(`Verified ${RECIPE_REPOSITORY} ${tag} and wrote ${path.relative(process.cwd(), outDir)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
