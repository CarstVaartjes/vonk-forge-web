import type {
  JobSlot,
  License,
  LibraryRelease,
  ModelPage,
  ModelRuns,
  ModelSummary,
  ModelVersionSummary,
  RecipeDetail,
  RecipeSummary,
} from "./client";

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
// The indexes that finished loading, so a page that opens after one can start from them and draw
// no loading state; every derived view is built once per index (see `derived`).
const loadedIndexes = new Map<string, LibraryIndex>();

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

// A display title with a dangling separator ("SkinTokens /") is a catalog
// typo, not information; the page shows the name without it.
export function displayTitle(value: unknown, fallback = ""): string {
  const trimmed = text(value)
    .replace(/[\s/|·:,-]+$/u, "")
    .trim();
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

// Contract major 4 keeps a model's capabilities and license in its display
// document, not its execution document. They are a plain list of names.
function declaredCapabilities(entity: CatalogModelEntry): string[] {
  return Array.from(new Set<string>(entity.display.capabilities));
}

function executionReadiness(
  recipeTags: string[],
): "executable" | "integration-required" | "not-executable" | "not-declared" {
  const executable = recipeTags.includes("executable");
  const notExecutable = recipeTags.some((value) =>
    ["non-executable", "metadata-only"].includes(value),
  );
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
    if (
      source.protocol !== "https:" ||
      source.username ||
      source.password ||
      (source.port && source.port !== "443") ||
      source.search
    )
      return null;
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
function referenceKey(
  kind: string | undefined,
  publisher: string,
  slug: string,
  sha256: string,
): string {
  return `${kind}\0${publisher}\0${slug}\0${sha256}`;
}

// What is built from one index, once: its model documents by reference, its recipes as the pages show them
// (and by address), and its Models. A join through these maps is O(N+M), not a scan per recipe.
interface Derived {
  entities: Map<string, CatalogModelEntry>;
  recipes?: RecipeDetail[];
  recipesByAddress?: Map<string, RecipeDetail>;
  models?: ModelSummary[];
}
const derivedByIndex = new WeakMap<LibraryIndex, Derived>();

function derived(index: LibraryIndex): Derived {
  let found = derivedByIndex.get(index);
  if (!found) {
    const entities = new Map<string, CatalogModelEntry>();
    for (const entity of index.catalog_entities) {
      const { identity } = entity.document;
      const key = referenceKey(
        entity.document.kind,
        identity.publisher,
        identity.slug,
        entity.content_sha256,
      );
      if (!entities.has(key)) entities.set(key, entity);
    }
    found = { entities };
    derivedByIndex.set(index, found);
  }
  return found;
}

function selectedEntity(
  document: RecipeDefinition,
  index: LibraryIndex,
  selection = document.models[0],
): CatalogModelEntry | undefined {
  if (!selection) return undefined;
  const { kind, publisher, slug, content_sha256: sha256 } = selection.model;
  return derived(index).entities.get(referenceKey(kind, publisher, slug, sha256));
}

// A Family's title comes from the index `families`, keyed by the Model display's lineage; a Model without lineage has none.
function familyTitle(index: LibraryIndex, display: CatalogModelEntry["display"]): string {
  const slug = display.lineage?.family;
  return displayTitle(index.families?.find((family) => family.slug === slug)?.title);
}

// One hierarchy Model: the variants that share a lineage (family, line, model), the unique triple of the contract
// (the slug pattern allows "--", but no published slug contains it). Its page address and the catalog `model`
// parameter are built from that key. A variant without lineage (a drafter, encoder or other helper) has no place in
// the hierarchy: it is in no Model and has no row.
interface ModelGroup {
  publisher: string;
  slug: string;
  title: string;
  entities: CatalogModelEntry[];
}

const groupsByIndex = new WeakMap<
  LibraryIndex,
  { groups: ModelGroup[]; byEntity: Map<CatalogModelEntry, ModelGroup> }
>();

function modelGroups(index: LibraryIndex): NonNullable<ReturnType<typeof groupsByIndex.get>> {
  const cached = groupsByIndex.get(index);
  if (cached) return cached;
  const keyed = new Map<string, CatalogModelEntry[]>();
  for (const entity of index.catalog_entities) {
    const { lineage } = entity.display;
    if (!lineage) continue;
    const key = `${lineage.family}\0${lineage.line}\0${lineage.model}`;
    keyed.set(key, [...(keyed.get(key) ?? []), entity]);
  }
  const groups = Array.from(keyed.values()).map((entities): ModelGroup => {
    const first = entities[0]!;
    const lineage = first.display.lineage!;
    const named = index.families
      ?.find((family) => family.slug === lineage.family)
      ?.lines.find((line) => line.slug === lineage.line)
      ?.models.find((model) => model.slug === lineage.model)?.title;
    return {
      publisher: lineage.family,
      slug: `${lineage.line}--${lineage.model}`,
      title: displayTitle(named || first.display.model_title, lineage.model),
      entities,
    };
  });
  const byEntity = new Map(
    groups.flatMap((group) => group.entities.map((entity) => [entity, group] as const)),
  );
  const built = { groups, byEntity };
  groupsByIndex.set(index, built);
  return built;
}

function modelMetadata(
  document: RecipeDefinition,
  index: LibraryIndex,
): {
  publisher: string;
  slug: string;
  title: string;
  family: string;
  versionPublisher: string;
  versionSlug: string;
  versionTitle: string;
} {
  const entity = selectedEntity(document, index);
  const identity = entity?.document.identity;
  const versionSlug = identity?.slug ?? "unknown";
  const versionPublisher = identity?.publisher ?? "unknown";
  const group = entity && modelGroups(index).byEntity.get(entity);
  // A recipe's first model always has lineage (the recipe library's check-model-families); no other path.
  return {
    publisher: group?.publisher ?? "unknown",
    slug: group?.slug ?? "unknown",
    title: group?.title ?? "unknown",
    family: (entity && familyTitle(index, entity.display)) || group?.title || "unknown",
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
function licenseOf(display: CatalogModelEntry["display"]): License {
  return {
    spdx: display.license.spdx || undefined,
    url: display.license.url || undefined,
    notice: display.license.territorial_restrictions?.notice || undefined,
  };
}

// The literal "none" says the model is not quantized: no quantization, not one called NONE.
function quantizationOf(quantization: string | undefined): string | undefined {
  return quantization && quantization !== "none" ? quantization : undefined;
}

// A job recipe's contract: its job interface's slots and its typed options, labelled by the display file.
function jobContractOf(
  document: RecipeDefinition,
  display: CatalogRecipeEntry["display"],
): RecipeDetail["job"] {
  const { settings } = document;
  if (settings.kind !== "job") return undefined;
  const job = document.interfaces.find((entry) => entry.adapter !== "openai");
  const slot = ({
    id,
    label,
    description,
    media_types,
    extensions,
    min_files,
    max_files,
  }: JobSlot): JobSlot => ({
    id,
    label,
    description,
    media_types,
    extensions,
    min_files,
    max_files,
  });
  return {
    inputs: (job?.input?.slots ?? []).map(slot),
    outputs: (job?.output.slots ?? []).map(slot),
    options: Object.entries(settings.knobs ?? {}).map(([key, knob]) => ({
      key,
      label: display.knobs?.[key]?.label || key,
      description: display.knobs?.[key]?.description || undefined,
      unit: display.knobs?.[key]?.unit || undefined,
      default: knob.value,
      minimum: knob.minimum ?? undefined,
      maximum: knob.maximum ?? undefined,
      step: knob.step ?? undefined,
      allowed_values: knob.allowed_values ?? undefined,
    })),
  };
}

function mapModelVersion(entity: CatalogModelEntry, recipeSlugs: string[]): ModelVersionSummary {
  const { document, display } = entity;
  const { identity, source, format } = document;
  return {
    publisher: identity.publisher,
    slug: identity.slug,
    title: identity.slug,
    version: identity.version,
    revision_id: entity.content_sha256,
    description: display.description,
    model_slug: identity.model.slug,
    variant: identity.variant || undefined,
    requires_token: document.requires_token,
    source_repository: source.repository || undefined,
    source_revision: ("revision" in source ? source.revision : "") || undefined,
    format: {
      precision: format.precision || undefined,
      quantization: quantizationOf(format.quantization),
    },
    sizes: {
      download_bytes: modelSize(document, true),
      installed_bytes: modelSize(document, false),
    },
    license: licenseOf(display),
    capabilities: declaredCapabilities(entity),
    recipe_slugs: recipeSlugs,
  };
}

function runsOf(own: RecipeSummary[]): ModelRuns {
  const unique = (values: Array<string | null>): string[] =>
    Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort();
  return {
    spark_counts: Array.from(new Set(own.map((recipe) => recipe.catalog.node_count))).sort(
      (left, right) => left - right,
    ),
    engines: unique(own.map((recipe) => recipe.catalog.runtime_distribution)),
    creators: unique(own.map((recipe) => recipe.catalog.source_owner)),
  };
}

function mapModels(index: LibraryIndex): ModelSummary[] {
  recipesFromIndex(index);
  const byAddress = derived(index).recipesByAddress!;
  // A recipe runs its first model; a drafter or companion does not make it run that Model.
  const slugsByEntity = new Map<CatalogModelEntry, string[]>();
  for (const recipe of index.recipes) {
    const entity = selectedEntity(recipe.document, index);
    if (entity)
      slugsByEntity.set(entity, [
        ...(slugsByEntity.get(entity) ?? []),
        `${recipe.document.identity.publisher}/${recipe.document.identity.slug}`,
      ]);
  }
  return modelGroups(index)
    .groups.map(({ publisher, slug, title, entities }) => {
      const first = entities[0]!;
      const { display } = first;
      const versionRows = entities
        .map((version) => mapModelVersion(version, (slugsByEntity.get(version) ?? []).sort()))
        .sort((left, right) => left.title.localeCompare(right.title));
      const slugs = new Set(versionRows.flatMap((version) => version.recipe_slugs));
      const own = Array.from(slugs).flatMap((address) => byAddress.get(address) ?? []);
      const verifiedRecipes = own.filter(isVerified);
      return {
        publisher,
        slug,
        title,
        family: familyTitle(index, display) || undefined,
        runs: runsOf(own),
        verified_runs: runsOf(verifiedRecipes),
        verified_recipe_count: verifiedRecipes.length,
        tags: lowerTags(display.tags),
        types: typesOf(
          index.vocabulary,
          versionRows.flatMap((version) => version.capabilities),
        ),
        versions: versionRows,
        recipe_count: slugs.size,
      };
    })
    .sort((left, right) => left.title.localeCompare(right.title));
}

function publicMetadata(
  item: CatalogRecipeEntry,
  index: LibraryIndex,
  artifacts: RecipeSummary["artifacts"],
): NonNullable<RecipeSummary["catalog"]> {
  const { document, display } = item;
  const recipeTags = lowerTags(display.tags);
  const model = modelMetadata(document, index);
  const source = canonicalSource(document.provenance.source_reference ?? "");
  const modelEntity = selectedEntity(document, index);
  const quantization = quantizationOf(modelEntity?.document.format.quantization);
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
    expected_download_bytes: (artifacts ?? []).reduce(
      (total, artifact) => total + (artifact.download_bytes ?? 0),
      0,
    ),
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
    return entity
      ? entity.document.files
          .filter((file) => selectedFiles.has(file.id))
          .map((file) => ({
            repository: entity.document.source.repository,
            revision: "revision" in entity.document.source ? entity.document.source.revision : "",
            download_bytes: file.size_bytes,
          }))
      : [];
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
      measured_memory_bytes_per_node: item.measured_memory
        ? Math.max(...item.measured_memory.roles.map((role) => role.measured_peak_bytes))
        : undefined,
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
      bundle_url: contextPath
        ? `https://github.com/${index.repository}/tree/${index.source_commit}/${contextPath}`
        : undefined,
    },
    package: {
      member: packageName,
      sha256: item.package.sha256,
      bytes: item.package.expected_bytes,
      media_type: item.package.media_type,
    },
    catalog: publicMetadata(item, index, artifacts),
    evidence: lastPass
      ? {
          tested_at: lastPass.tested_at,
          spark_count: lastPass.platform.spark_count ?? undefined,
          hardware_class: lastPass.platform.hardware_class,
          evidence_ref: lastPass.evidence_refs?.[0],
          image_digest: lastPass.identity.runtime_image?.image_digest,
        }
      : null,
    chat_api: chat
      ? {
          endpoints: chat.endpoints,
          streaming: chat.streaming,
          structured_output: chat.structured_output,
          image_input: chat.input_modalities.image,
          audio_input: chat.input_modalities.audio,
        }
      : undefined,
    served_names: document.interfaces.flatMap((entry) =>
      entry.adapter === "openai" ? entry.model_aliases : [],
    ),
    credits: document.provenance.attribution,
    job: jobContractOf(document, display),
    settings: {
      context_tokens: "context_tokens" in settings ? settings.context_tokens.value : undefined,
      concurrency: "concurrency" in settings ? settings.concurrency?.value : undefined,
    },
    license: modelEntity ? licenseOf(modelEntity.display) : {},
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
  if (
    typeof release.tag !== "string" ||
    !/^v\d+\.\d+\.\d+$/.test(release.tag) ||
    typeof release.updated_at !== "string" ||
    !/^[0-9a-f]{64}$/.test(release.catalog_index_sha256 ?? "")
  ) {
    throw new Error("Recipe library returned an unsupported release manifest");
  }
  return {
    version: release.tag,
    updated_at: release.updated_at,
    index_sha256: release.catalog_index_sha256!,
  };
}

async function readIndex(url: string, signal?: AbortSignal): Promise<LibraryIndex> {
  const [rawBody, rawRelease] = await Promise.all([
    readJson(url, signal),
    readJson(releaseUrl(url), signal),
  ]);
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
  if (
    !Array.isArray(body.catalog_entities) ||
    body.catalog_entities.length === 0 ||
    !Array.isArray(body.recipes) ||
    !body.package_contract ||
    !body.vocabulary
  ) {
    throw new Error("Recipe library returned an unsupported catalog index");
  }
  if (
    typeof release.tag !== "string" ||
    !/^v\d+\.\d+\.\d+$/.test(release.tag) ||
    release.repository !== body.repository ||
    release.source_commit !== body.source_commit
  ) {
    throw new Error("Recipe library returned an index that does not match its release");
  }
  return body as LibraryIndex;
}

// One fetch per URL, shared by every caller and never aborted: a caller's signal only ends that
// caller's wait, so one page leaving cannot cancel the load another page is still waiting for.
function loadIndex(url: string, signal?: AbortSignal): Promise<LibraryIndex> {
  let shared = cachedIndexes.get(url);
  if (!shared) {
    const pending: Promise<LibraryIndex> = readIndex(url).then(
      (index) => {
        loadedIndexes.set(url, index);
        return index;
      },
      (error: unknown) => {
        if (cachedIndexes.get(url) === pending) cachedIndexes.delete(url);
        throw error;
      },
    );
    cachedIndexes.set(url, pending);
    shared = pending;
  }
  return signal ? raceAbort(shared, signal) : shared;
}

function raceAbort<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}

// The library version (its release tag, which is the contract version) and when
// its content last changed. Reads only the small release manifest.
export async function getStaticLibraryRelease(
  url: string,
  signal?: AbortSignal,
): Promise<LibraryRelease> {
  return libraryRelease(await readJson(releaseUrl(url), signal));
}

// The recipes of an accepted index, as the pages show them (mapped once per index).
export function recipesFromIndex(index: LibraryIndex): RecipeDetail[] {
  const built = derived(index);
  if (!built.recipes) {
    built.recipes = index.recipes.map((item) => mapRecipe(item, index));
    built.recipesByAddress = new Map();
    for (const recipe of built.recipes) {
      const address = `${recipe.publisher}/${recipe.slug}`;
      if (!built.recipesByAddress.has(address)) built.recipesByAddress.set(address, recipe);
    }
  }
  return built.recipes;
}

// The small summary the Pages build derived from the verified index
// (catalog-summary.json beside release.json). The home page reads only this.
export async function getStaticCatalogSummary(
  url: string,
  signal?: AbortSignal,
): Promise<CatalogSummary> {
  return parseCatalogSummary(
    await readJson(
      new URL("catalog-summary.json", new URL(url, globalThis.location?.href)).toString(),
      signal,
    ),
  );
}

// The words of the release the pages show, from the same index (one load).
export async function getStaticVocabulary(url: string, signal?: AbortSignal): Promise<Vocabulary> {
  return (await loadIndex(url, signal)).vocabulary;
}

function modelsFromIndex(index: LibraryIndex): ModelSummary[] {
  const built = derived(index);
  built.models ??= mapModels(index);
  return built.models;
}

function recipeFromIndex(index: LibraryIndex, publisher: string, slug: string): RecipeDetail {
  recipesFromIndex(index);
  const recipe = derived(index).recipesByAddress!.get(`${publisher}/${slug}`);
  if (!recipe) throw new Error("Recipe not found in the public library");
  return recipe;
}

function modelFromIndex(index: LibraryIndex, publisher: string, slug: string): ModelSummary {
  const model = modelsFromIndex(index).find(
    (item) => item.publisher === publisher && item.slug === slug,
  );
  if (!model) throw new Error("Model not found in the public library");
  return model;
}

export async function listStaticRecipeCatalog(
  url: string,
  signal?: AbortSignal,
): Promise<RecipeDetail[]> {
  return recipesFromIndex(await loadIndex(url, signal));
}

export async function listStaticModels(url: string, signal?: AbortSignal): Promise<ModelPage> {
  return { items: modelsFromIndex(await loadIndex(url, signal)) };
}

// A miss is a miss: the cached index may belong to an older release than the entry asked for, so it is
// dropped before the error, and Retry or the next page reads the index again.
async function fromIndex<T>(
  url: string,
  signal: AbortSignal | undefined,
  pick: (index: LibraryIndex) => T,
): Promise<T> {
  const index = await loadIndex(url, signal);
  try {
    return pick(index);
  } catch (error) {
    if (loadedIndexes.get(url) === index) {
      loadedIndexes.delete(url);
      cachedIndexes.delete(url);
    }
    throw error;
  }
}

export function getStaticModel(
  url: string,
  publisher: string,
  slug: string,
  signal?: AbortSignal,
): Promise<ModelSummary> {
  return fromIndex(url, signal, (index) => modelFromIndex(index, publisher, slug));
}

export function getStaticRecipe(
  url: string,
  publisher: string,
  slug: string,
  signal?: AbortSignal,
): Promise<RecipeDetail> {
  return fromIndex(url, signal, (index) => recipeFromIndex(index, publisher, slug));
}

// What a page that opens after the index loaded starts from, so moving between pages draws no loading
// state and fetches nothing. Each is null until the index has loaded (or the entry is not in it).
export function peekStaticVocabulary(url: string): Vocabulary | null {
  return loadedIndexes.get(url)?.vocabulary ?? null;
}

export function peekStaticRecipeCatalog(url: string): RecipeDetail[] | null {
  const index = loadedIndexes.get(url);
  return index ? recipesFromIndex(index) : null;
}

export function peekStaticModels(url: string): ModelPage | null {
  const index = loadedIndexes.get(url);
  return index ? { items: modelsFromIndex(index) } : null;
}

export function peekStaticRecipe(
  url: string,
  publisher: string,
  slug: string,
): RecipeDetail | null {
  const index = loadedIndexes.get(url);
  try {
    return index ? recipeFromIndex(index, publisher, slug) : null;
  } catch {
    return null;
  }
}

export function peekStaticModel(url: string, publisher: string, slug: string): ModelSummary | null {
  const index = loadedIndexes.get(url);
  try {
    return index ? modelFromIndex(index, publisher, slug) : null;
  } catch {
    return null;
  }
}

export function resetStaticCatalogCacheForTests(): void {
  cachedIndexes.clear();
  loadedIndexes.clear();
}
