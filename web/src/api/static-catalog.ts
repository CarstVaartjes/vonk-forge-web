import type { Licence, LibraryRelease, ModelPage, ModelRuns, ModelSummary, ModelVersionSummary, RecipeDetail, RecipeSummary } from "./client";


// The release build (web/scripts/recipe-release.mjs) loads this module under Node, so
// its runtime imports carry explicit .ts extensions.
import { parseCatalogSummary, type CatalogSummary } from "../catalog-stats.ts";
import { isVerified } from "../qualification-status.ts";
import { isVerifiedStatus, typesOf, type Vocabulary } from "../vocabulary.ts";
import type { CatalogIndex, CatalogModelEntry, CatalogRecipeEntry } from "./catalog-types.ts";


// The index is read through the types generated from the schema the release ships
// (catalog-types.ts), so a field the contract does not have is a `tsc` error and a
// field it has is never defaulted. Only text the site itself defines is read loosely.
export type LibraryIndex = CatalogIndex;
type RecipeDefinition = CatalogRecipeEntry["document"];
type ModelDefinition = CatalogModelEntry["document"];

const cachedIndexes = new Map<string, Promise<LibraryIndex>>();

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

// A display title with a dangling separator ("SkinTokens /") is a catalog
// typo, not information; the page shows the name without it.
export function displayTitle(value: unknown, fallback = ""): string {
  const trimmed = text(value).replace(/[\s/|·:,-]+$/u, "").trim();
  return trimmed || fallback;
}

function nodeResources(document: RecipeDefinition): { disk: number; memory: number } {
  return document.topology.roles.reduce<{ disk: number; memory: number }>(
    (maximum, role) => {
      const { disk, memory } = role.resources;
      const diskBytes = Object.values(disk).reduce((total, value) => total + value, 0);
      // Controller resource planning defines reserve_bytes as informational:
      // peak_bytes already describes the complete runtime memory requirement.
      const runtimeBytes = memory.peak_bytes;
      return {
        disk: Math.max(maximum.disk, diskBytes),
        memory: Math.max(maximum.memory, runtimeBytes),
      };
    },
    { disk: 0, memory: 0 },
  );
}

function runtimeAdapter(document: RecipeDefinition): string {
  const { engine, entrypoint } = document.runtime;
  const haystack = [engine, ...entrypoint].join(" ").toLowerCase();
  if (haystack.includes("vllm")) return "vllm";
  if (haystack.includes("sglang")) return "sglang";
  if (haystack.includes("llama")) return "llama.cpp";
  if (haystack.includes("ds4")) return "ds4";
  return engine || "custom";
}

function lowerTags(tags: string[]): string[] {
  return tags.map((value) => value.toLowerCase()).filter(Boolean);
}

// Contract major 4 keeps a model's capabilities and licence in its display
// document, not its execution document. They are a plain list of names.
function declaredCapabilities(entity: CatalogModelEntry): string[] {
  return Array.from(new Set<string>(entity.display.capabilities));
}

function executionReadiness(recipeTags: string[]): "executable" | "integration-required" | "not-executable" | "not-declared" {
  const executable = recipeTags.includes("executable");
  const notExecutable = recipeTags.some((value) => ["non-executable", "metadata-only"].includes(value));
  const integrationRequired = recipeTags.includes("integration-required");
  const declarations = Number(executable) + Number(notExecutable) + Number(integrationRequired);
  if (declarations > 1) return notExecutable ? "not-executable" : "integration-required";
  if (executable) return "executable";
  if (notExecutable) return "not-executable";
  if (integrationRequired) return "integration-required";
  return "not-declared";
}

function canonicalSource(sourceReference: string): { owner: string; repository: string } | null {
  try {
    const source = new URL(sourceReference);
    if (source.protocol !== "https:" || source.username || source.password || (source.port && source.port !== "443") || source.search) return null;
    const segments = source.pathname.split("/").filter(Boolean);
    let host = source.hostname.toLowerCase().replace(/^www\./, "");
    let canonical: string[];
    let ownerOffset = 0;
    if (host === "github.com" || host === "raw.githubusercontent.com") {
      host = "github.com";
      canonical = segments.slice(0, 2);
    } else if (host === "huggingface.co") {
      ownerOffset = segments[0] && ["datasets", "spaces"].includes(segments[0]) ? 1 : 0;
      canonical = segments.slice(0, ownerOffset + 2);
    } else if (host === "gitlab.com") {
      const separator = segments.indexOf("-");
      canonical = segments.slice(0, separator >= 0 ? separator : 2);
    } else return null;
    if (canonical.length < ownerOffset + 2) return null;
    const repositoryName = canonical.at(-1);
    const owner = canonical[ownerOffset];
    if (!repositoryName || !owner) return null;
    canonical[canonical.length - 1] = repositoryName.replace(/\.git$/, "");
    return { owner, repository: `https://${host}/${canonical.join("/")}` };
  } catch {
    return null;
  }
}


// A recipe selects a model by kind, identity and content digest; the entity is that exact document.
function sameReference(selected: RecipeDefinition["models"][number]["model"], entity: CatalogModelEntry): boolean {
  const { identity } = entity.document;
  return selected.kind === entity.document.kind
    && selected.publisher === identity.publisher
    && selected.slug === identity.slug
    && selected.content_sha256 === entity.content_sha256;
}

function selectedEntity(document: RecipeDefinition, index: LibraryIndex, selection = document.models[0]): CatalogModelEntry | undefined {
  return selection && index.catalog_entities.find((entity) => sameReference(selection.model, entity));
}

function modelMetadata(document: RecipeDefinition, index: LibraryIndex): { publisher: string; slug: string; title: string; family: string; versionPublisher: string; versionSlug: string; versionTitle: string } {
  const entity = selectedEntity(document, index);
  const identity = entity?.document.identity;
  const versionSlug = identity?.slug ?? "unknown";
  const versionPublisher = identity?.publisher ?? "unknown";
  const slug = identity?.model.slug ?? versionSlug;
  return {
    publisher: identity?.model.publisher ?? versionPublisher,
    slug,
    title: displayTitle(entity?.display.model_title, slug),
    family: displayTitle(entity?.display.family_title) || identity?.family.slug || displayTitle(entity?.display.model_title, slug),
    versionPublisher,
    versionSlug,
    versionTitle: versionSlug,
  };
}

function modelSize(document: ModelDefinition, deduplicate: boolean): number {
  const seen = new Set<string>();
  return document.files.reduce((total, file) => {
    if (deduplicate && seen.has(file.sha256)) return total;
    if (deduplicate) seen.add(file.sha256);
    return total + file.size_bytes;
  }, 0);
}

// An empty field is a missing one: the catalog writes "" where it has nothing to say.
function licenceOf(display: CatalogModelEntry["display"]): Licence {
  return { spdx: display.license.spdx || undefined, url: display.license.url || undefined };
}

function mapModelVersion(entity: CatalogModelEntry, index: LibraryIndex): ModelVersionSummary {
  const { document, display } = entity;
  const { identity, source, format } = document;
  const recipeSlugs = index.recipes
    .filter((recipe) => recipe.document.models.some((selection) => sameReference(selection.model, entity)))
    .map((recipe) => `${recipe.document.identity.publisher}/${recipe.document.identity.slug}`)
    .sort();
  return {
    publisher: identity.publisher,
    slug: identity.slug,
    title: identity.slug,
    version: identity.version,
    revision_id: entity.content_sha256,
    model_slug: identity.model.slug,
    variant: identity.variant || undefined,
    requires_token: document.requires_token,
    source_repository: source.repository || undefined,
    source_revision: ("revision" in source ? source.revision : "") || undefined,
    format: { precision: format.precision || undefined, quantization: format.quantization || undefined },
    sizes: { download_bytes: modelSize(document, true), installed_bytes: modelSize(document, false) },
    license: licenceOf(display),
    capabilities: declaredCapabilities(entity),
    recipe_slugs: recipeSlugs,
  };
}

function modelRuns(versions: ModelVersionSummary[], recipes: RecipeSummary[]): ModelRuns {
  const slugs = new Set(versions.flatMap((version) => version.recipe_slugs));
  return runsOf(recipes.filter((recipe) => slugs.has(`${recipe.publisher}/${recipe.slug}`)));
}

function runsOf(own: RecipeSummary[]): ModelRuns {
  const unique = (values: Array<string | null>): string[] => Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort();
  return {
    spark_counts: Array.from(new Set(own.map((recipe) => recipe.catalog.node_count))).sort((left, right) => left - right),
    engines: unique(own.map((recipe) => recipe.catalog.runtime_distribution)),
    creators: unique(own.map((recipe) => recipe.catalog.source_owner)),
  };
}

// The same facts restricted to recipes that passed hardware checks on a Spark.
function verifiedModelRecipes(versions: ModelVersionSummary[], recipes: RecipeSummary[]): RecipeSummary[] {
  const slugs = new Set(versions.flatMap((version) => version.recipe_slugs));
  return recipes.filter((recipe) => slugs.has(`${recipe.publisher}/${recipe.slug}`) && isVerified(recipe));
}

function mapModels(index: LibraryIndex): ModelSummary[] {
  const recipes = index.recipes.map((item) => mapRecipe(item, index));
  const groups = new Map<string, CatalogModelEntry[]>();
  for (const entity of index.catalog_entities) {
    const logical = entity.document.identity.model;
    const key = `${logical.publisher}\0${logical.slug}`;
    groups.set(key, [...(groups.get(key) ?? []), entity]);
  }
  return Array.from(groups.values()).map((variants) => {
    const first = variants[0]!;
    const { identity, display } = { identity: first.document.identity.model, display: first.display };
    const versionRows = variants.map((version) => mapModelVersion(version, index)).sort((left, right) => left.title.localeCompare(right.title));
    const verifiedRecipes = verifiedModelRecipes(versionRows, recipes);
    return {
      publisher: identity.publisher,
      slug: identity.slug,
      title: displayTitle(display.model_title, identity.slug),
      description: display.description,
      family: displayTitle(display.family_title) || first.document.identity.family.slug || undefined,
      runs: modelRuns(versionRows, recipes),
      verified_runs: runsOf(verifiedRecipes),
      verified_recipe_count: verifiedRecipes.length,
      tags: lowerTags(display.tags),
      types: typesOf(index.vocabulary, versionRows.flatMap((version) => version.capabilities)),
      revision_id: first.content_sha256,
      versions: versionRows,
      recipe_count: new Set(versionRows.flatMap((version) => version.recipe_slugs)).size,
    };
  }).sort((left, right) => left.title.localeCompare(right.title));
}

function publicMetadata(item: CatalogRecipeEntry, index: LibraryIndex, artifacts: RecipeSummary["artifacts"]): NonNullable<RecipeSummary["catalog"]> {
  const { document, display } = item;
  const recipeTags = lowerTags(display.tags);
  const model = modelMetadata(document, index);
  const source = canonicalSource(document.provenance.source_reference ?? "");
  const modelEntity = selectedEntity(document, index);
  const quantization = modelEntity?.document.format.quantization ?? "";
  const capabilities = modelEntity ? declaredCapabilities(modelEntity) : [];
  return {
    description: display.description,
    tags: recipeTags,
    model_publisher: model.publisher,
    model_slug: model.slug,
    model_title: model.title,
    model_version_publisher: model.versionPublisher,
    model_version_slug: model.versionSlug,
    model_version_title: model.versionTitle,
    model_family: model.family,
    source_owner: source?.owner ?? null,
    source_repository: source?.repository ?? null,
    alignment: display.alignment ?? "unspecified",
    capabilities,
    types: typesOf(index.vocabulary, capabilities),
    qualification: item.qualification.status,
    verified: isVerifiedStatus(index.vocabulary, item.qualification.status),
    qualification_reason: item.qualification.reason ?? null,
    execution_readiness: executionReadiness(recipeTags),
    runtime_distribution: document.runtime.engine || "unknown",
    precision: modelEntity?.document.format.precision || null,
    quantizations: quantization ? [quantization.toUpperCase()] : [],
    node_count: Math.max(1, document.topology.node_count),
    expected_download_bytes: (artifacts ?? []).reduce((total, artifact) => total + (artifact.download_bytes ?? 0), 0),
  };
}

function mapRecipe(item: CatalogRecipeEntry, index: LibraryIndex): RecipeDetail {
  const { document, display } = item;
  const { publisher, slug } = document.identity;
  const { build } = document.execution;
  const nodeCount = Math.max(1, document.topology.node_count);
  const resources = nodeResources(document);
  const artifacts = document.models.flatMap((selection) => {
    const entity = selectedEntity(document, index, selection);
    const selectedFiles = new Set(selection.files.map((file) => file.file_id));
    return entity ? entity.document.files
      .filter((file) => selectedFiles.has(file.id))
      .map((file) => ({
        repository: entity.document.source.repository,
        revision: "revision" in entity.document.source ? entity.document.source.revision : "",
        download_bytes: file.size_bytes,
      })) : [];
  });
  const sourceUrl = `https://github.com/${index.repository}/blob/${index.source_commit}/${item.source_path}`;
  const packageName = item.package.path.startsWith(index.package_contract.path_prefix)
    ? item.package.path.slice(index.package_contract.path_prefix.length)
    : item.package.path;
  const contextPath = build.context.path;
  const lastPass = item.qualification.last_pass;
  const api = item.api?.api;
  // Only a chat-shaped API has endpoints and streaming facts.
  const chat = api && "endpoints" in api ? api : null;
  const settings = document.settings;
  const modelEntity = selectedEntity(document, index);

  return {
    publisher,
    slug,
    title: display.title,
    official: publisher === "vonk-forge",
    content_sha256: item.content_sha256,
    published_at: item.release.released_at,
    version: item.release.version || undefined,
    runtime: { adapter: runtimeAdapter(document) },
    build: {
      dockerfile: build.dockerfile,
    },
    artifacts,
    capacity: {
      profile_node_counts: [nodeCount],
      maximum_installed_bytes_per_node: resources.disk || undefined,
      maximum_runtime_memory_bytes_per_node: resources.memory || undefined,
      measured_memory_bytes_per_node: item.measured_memory ? Math.max(...item.measured_memory.roles.map((role) => role.measured_peak_bytes)) : undefined,
    },
    moderation_warning: null,
    facts: {
      // The build context ships inside the package the Pages build verified.
      source_bundle_observed: Boolean(contextPath),
    },
    import: {
      uri: `vonk://catalog/${publisher}/${slug}@sha256:${item.content_sha256}`,
      instruction: "Use this exact recipe in your local Controller.",
    },
    source: {
      recipe_url: sourceUrl,
      bundle_url: contextPath ? `https://github.com/${index.repository}/tree/${index.source_commit}/${contextPath}` : undefined,
    },
    package: {
      member: packageName,
      sha256: item.package.sha256,
      bytes: item.package.expected_bytes,
      media_type: item.package.media_type,
    },
    catalog: publicMetadata(item, index, artifacts),
    evidence: lastPass ? {
      tested_at: lastPass.tested_at,
      spark_count: lastPass.platform.spark_count ?? undefined,
      hardware_class: lastPass.platform.hardware_class,
      evidence_ref: lastPass.evidence_refs?.[0],
      image_digest: lastPass.identity.runtime_image?.image_digest,
    } : null,
    chat_api: chat ? { endpoints: chat.endpoints, streaming: chat.streaming, structured_output: chat.structured_output, image_input: chat.input_modalities.image, audio_input: chat.input_modalities.audio } : undefined,
    served_names: document.interfaces.flatMap((entry) => (entry.adapter === "openai" ? entry.model_aliases : [])),
    credits: document.provenance.attribution,
    settings: {
      context_tokens: "context_tokens" in settings ? settings.context_tokens.value : undefined,
      concurrency: "concurrency" in settings ? settings.concurrency?.value : undefined,
    },
    license: modelEntity ? licenceOf(modelEntity.display) : {},
    latest_revision: {
      content_sha256: item.content_sha256,
      document,
    },
  };
}

interface ReleaseManifest {
  repository: string;
  tag: string;
  contract_version: string;
  updated_at: string;
  source_commit: string;
  catalog_index_sha256: string;
}

// The Pages build writes the verified release's index and a manifest naming
// that release beside it; both are read from this site's own origin.
async function readJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal });
  if (!response.ok) throw new Error(`Recipe library returned ${response.status}`);
  return response.json();
}

function releaseUrl(indexUrl: string): string {
  return new URL("release.json", new URL(indexUrl, globalThis.location?.href)).toString();
}

function libraryRelease(value: unknown): LibraryRelease {
  const release = record(value) as Partial<ReleaseManifest>;
  if (typeof release.tag !== "string" || !/^v\d+\.\d+\.\d+$/.test(release.tag) || typeof release.updated_at !== "string" || !/^[0-9a-f]{64}$/.test(release.catalog_index_sha256 ?? "")) {
    throw new Error("Recipe library returned an unsupported release manifest");
  }
  return { version: release.tag, updated_at: release.updated_at, index_sha256: release.catalog_index_sha256! };
}

async function readIndex(url: string, signal?: AbortSignal): Promise<LibraryIndex> {
  const [rawBody, rawRelease] = await Promise.all([readJson(url, signal), readJson(releaseUrl(url), signal)]);
  return parseLibraryIndex(rawBody, rawRelease);
}

// Accepts an index only when it has the shape the pages need and belongs to the named
// release; anything else is refused rather than defaulted. The envelope's version and
// kind were checked against the release's own schema, and the index's contract version
// against the release tag, when the build verified the bundle (recipe-release.mjs). The build (which derives the home summary) and the browser both read
// through this.
export function parseLibraryIndex(rawBody: unknown, rawRelease: unknown): LibraryIndex {
  const body = rawBody as Partial<LibraryIndex>;
  const release = record(rawRelease) as Partial<ReleaseManifest>;
  if (!Array.isArray(body.catalog_entities) || body.catalog_entities.length === 0 || !Array.isArray(body.recipes) || !body.package_contract || !body.vocabulary) {
    throw new Error("Recipe library returned an unsupported catalog index");
  }
  if (typeof release.tag !== "string" || !/^v\d+\.\d+\.\d+$/.test(release.tag) || release.repository !== body.repository || release.source_commit !== body.source_commit) {
    throw new Error("Recipe library returned an index that does not match its release");
  }
  return body as LibraryIndex;
}

function loadIndex(url: string, signal?: AbortSignal): Promise<LibraryIndex> {
  const cached = cachedIndexes.get(url);
  if (cached) return cached;
  const pending = readIndex(url, signal).catch((error: unknown) => {
    if (cachedIndexes.get(url) === pending) cachedIndexes.delete(url);
    throw error;
  });
  cachedIndexes.set(url, pending);
  return pending;
}

// The library version (its release tag, which is the contract version) and when
// its content last changed. Reads only the small release manifest.
export async function getStaticLibraryRelease(url: string, signal?: AbortSignal): Promise<LibraryRelease> {
  return libraryRelease(await readJson(releaseUrl(url), signal));
}

// The recipes of an accepted index, as the pages show them.
export function recipesFromIndex(index: LibraryIndex): RecipeDetail[] {
  return index.recipes.map((item) => mapRecipe(item, index));
}

// The small summary the Pages build derived from the verified index
// (catalog-summary.json beside release.json). The home page reads only this.
export async function getStaticCatalogSummary(url: string, signal?: AbortSignal): Promise<CatalogSummary> {
  return parseCatalogSummary(await readJson(new URL("catalog-summary.json", new URL(url, globalThis.location?.href)).toString(), signal));
}

// The words of the release the pages show, from the same index (one load).
export async function getStaticVocabulary(url: string, signal?: AbortSignal): Promise<Vocabulary> {
  return (await loadIndex(url, signal)).vocabulary;
}

export async function listStaticRecipeCatalog(url: string, signal?: AbortSignal): Promise<RecipeSummary[]> {
  return recipesFromIndex(await loadIndex(url, signal));
}

export async function listStaticModels(url: string, signal?: AbortSignal): Promise<ModelPage> {
  const index = await loadIndex(url, signal);
  return { items: mapModels(index) };
}

export async function getStaticModel(url: string, publisher: string, slug: string, signal?: AbortSignal): Promise<ModelSummary> {
  const page = await listStaticModels(url, signal);
  const model = page.items.find((item) => item.publisher === publisher && item.slug === slug);
  if (!model) throw new Error("Model not found in the public library");
  return model;
}

export async function getStaticRecipe(
  url: string,
  publisher: string,
  slug: string,
  signal?: AbortSignal,
): Promise<RecipeDetail> {
  const index = await loadIndex(url, signal);
  const item = index.recipes.find((candidate) => candidate.document.identity.publisher === publisher && candidate.document.identity.slug === slug);
  if (!item) throw new Error("Recipe not found in the public library");
  return mapRecipe(item, index);
}

export function resetStaticCatalogCacheForTests(): void {
  cachedIndexes.clear();
}
