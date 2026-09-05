import type { ModelPage, ModelSummary, ModelVersionSummary, RecipeDetail, RecipePage, RecipeSummary } from "./client";


type JsonRecord = Record<string, unknown>;

interface LibraryRecipe {
  content_sha256: string;
  document: JsonRecord;
  package: { expected_bytes: number; media_type: string; minimum_consumer_schema: number; path: string; recipe_content_sha256: string; sha256: string };
  release?: JsonRecord;
  source_path: string;
}

interface LibraryIndex {
  catalog_entities: LibraryEntity[];
  repository: string;
  recipes: LibraryRecipe[];
  schema_version: number;
  kind: "recipe-library-index";
  source_commit: string;
  package_contract: { media_type: string; path_prefix: string; schema_version: 2 };
}

interface LibraryEntity {
  content_sha256?: string;
  document: JsonRecord;
  source_path?: string;
}

interface CatalogReference {
  kind: string;
  publisher: string;
  slug: string;
  content_sha256: string;
}

let cachedIndex: LibraryIndex | null = null;

function record(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null ? value as JsonRecord : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function number(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function optionalNumber(value: unknown): number | null | undefined {
  if (value === null) return null;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function nodeResources(document: JsonRecord): { disk: number; memory: number } {
  const topology = record(document.topology);
  const roles = array(topology.roles).map(record);
  return roles.reduce<{ disk: number; memory: number }>(
    (maximum, role) => {
      const resources = record(role.resources);
      const disk = record(resources.disk);
      const memory = record(resources.memory);
      const diskBytes = Object.values(disk).reduce<number>((total, value) => total + number(value), 0);
      const runtimeBytes = Math.max(
        number(memory.startup_peak_bytes),
        number(memory.steady_state_bytes) + number(memory.runtime_growth_bytes) + number(memory.system_reserve_bytes),
      );
      return {
        disk: Math.max(maximum.disk, diskBytes),
        memory: Math.max(maximum.memory, runtimeBytes),
      };
    },
    { disk: 0, memory: 0 },
  );
}

function runtimeAdapter(document: JsonRecord): string {
  const runtime = record(document.runtime);
  const engine = text(runtime.engine);
  const haystack = [
    engine,
    ...array(runtime.entrypoint).map((value) => text(value)),
  ].join(" ").toLowerCase();
  if (haystack.includes("vllm")) return "vllm";
  if (haystack.includes("sglang")) return "sglang";
  if (haystack.includes("llama")) return "llama.cpp";
  if (haystack.includes("ds4")) return "ds4";
  return engine || "custom";
}

const PUBLIC_CAPABILITIES = [
  "chat", "text-generation", "text-understanding", "reasoning", "tool-use", "code-generation", "ocr",
  "image-generation", "image-understanding", "image-editing", "video-generation", "video-understanding",
  "audio-generation", "audio-understanding", "embeddings", "3d-generation",
] as const;

function tags(document: JsonRecord): string[] {
  return array(record(document.metadata).tags).map((value) => text(value).toLowerCase()).filter(Boolean);
}

function publicCapabilities(document: JsonRecord, recipeTags: string[]): string[] {
  void recipeTags;
  const declaration = record(document.capabilities);
  const facts = array(declaration.facts).map(record);
  const values = new Set(facts.filter((fact) => fact.support === "supported").map((fact) => text(fact.capability)));
  return PUBLIC_CAPABILITIES.filter((value) => values.has(value));
}

function modelVersionCapabilities(document: JsonRecord): string[] {
  return publicCapabilities(document, []);
}

function qualification(recipeTags: string[]): "candidate" | "cataloged" {
  return recipeTags.includes("accepted") && !recipeTags.includes("candidate") ? "cataloged" : "candidate";
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

function modelMetadata(document: JsonRecord, index: LibraryIndex): { publisher: string; slug: string; title: string; versionPublisher: string; versionSlug: string; versionTitle: string; versionRevisionId: string } {
  const selected = recipeModelSelections(document)[0];
  const versionEntity = index.catalog_entities.find((entity) => selected && sameReference(selected.model, entity));
  const version = versionEntity?.document;
  const versionIdentity = entityIdentity(version ?? {});
  const logical = modelIdentity(version ?? {});
  const versionTitle = text(record(version?.metadata).title, text(versionIdentity.slug, "unknown"));
  const versionPublisher = text(versionIdentity.publisher, "unknown");
  const versionSlug = text(versionIdentity.slug, "unknown");
  const slug = text(logical.slug, versionSlug);
  return {
    publisher: text(logical.publisher, versionPublisher),
    slug,
    title: text(logical.title, slug),
    versionPublisher,
    versionSlug,
    versionTitle,
    versionRevisionId: text(versionEntity?.content_sha256),
  };
}

function entityIdentity(document: JsonRecord): { publisher: string; slug: string } {
  const identity = record(document.identity);
  return { publisher: text(identity.publisher), slug: text(identity.slug) };
}

function reference(value: unknown): CatalogReference {
  const source = record(value);
  const document = record(source.document);
  const identity = record(document.identity);
  return {
    kind: text(source.kind, text(document.kind)),
    publisher: text(source.publisher, text(identity.publisher)),
    slug: text(source.slug, text(identity.slug)),
    content_sha256: text(source.content_sha256),
  };
}

function sameReference(left: unknown, right: unknown): boolean {
  const a = reference(left);
  const b = reference(right);
  return Boolean(a.kind && a.publisher && a.slug && a.content_sha256)
    && a.kind === b.kind
    && a.publisher === b.publisher
    && a.slug === b.slug
    && a.content_sha256 === b.content_sha256;
}

function explicitCapabilities(document: JsonRecord): { values: Array<{ name: string; support: "supported" | "unsupported" | "unknown"; evidence_status: "declared" | "tested" | "contradicted" | "unknown"; evidence_digest?: string | null }>; evidence: "declared" | "unknown" } {
  const declaration = record(document.capabilities);
  const raw = declaration.facts;
  if (!Array.isArray(raw)) return { values: [], evidence: "unknown" };
  const values = raw.map((value) => {
    const fact = record(value);
    const name = text(fact.capability);
    const support = ["supported", "unsupported", "unknown"].includes(text(fact.support)) ? text(fact.support) as "supported" | "unsupported" | "unknown" : "unknown";
    const evidence_status = ["declared", "tested", "contradicted", "unknown"].includes(text(fact.evidence_status)) ? text(fact.evidence_status) as "declared" | "tested" | "contradicted" | "unknown" : "unknown";
    return { name, support, evidence_status, evidence_digest: text(fact.evidence_digest) || null };
  }).filter((value) => value.name);
  return { values, evidence: values.length && declaration.provenance ? "declared" : "unknown" };
}

function modelIdentity(document: JsonRecord): JsonRecord {
  return record(record(document.identity).model);
}

function modelFamily(document: JsonRecord): JsonRecord {
  return record(record(document.identity).family);
}

function modelFiles(document: JsonRecord): JsonRecord[] {
  return array(document.files).map(record);
}

function modelSize(document: JsonRecord, deduplicate: boolean): number {
  const files = modelFiles(document);
  const seen = new Set<string>();
  return files.reduce((total, file) => {
    const digest = text(file.sha256);
    if (deduplicate && digest && seen.has(digest)) return total;
    if (deduplicate && digest) seen.add(digest);
    return total + number(file.size_bytes);
  }, 0);
}

function mapModelVersion(
  entity: LibraryEntity,
  recipes: RecipeSummary[],
): ModelVersionSummary {
  const document = entity.document;
  const identity = entityIdentity(document);
  const logicalModel = modelIdentity(document);
  const metadata = record(document.metadata);
  const source = record(document.source);
  const format = record(document.format);
  const parameters = record(document.parameters);
  const limits = record(document.limits);
  const license = record(document.license);
  const capabilities = explicitCapabilities(document);
  const recipeSlugs = recipes
    .filter((recipe) => recipeModels(recipe).some((candidate) => sameReference(candidate, entity)))
    .map((recipe) => `${recipe.publisher}/${recipe.slug}`)
    .sort();
  return {
    publisher: identity.publisher,
    slug: identity.slug,
    title: text(metadata.title, identity.slug),
    version: text(record(document.identity).version, identity.slug),
    revision_id: text(entity.content_sha256, "unknown"),
    model_publisher: text(logicalModel.publisher),
    model_slug: text(logicalModel.slug),
    model_title: text(logicalModel.title, text(logicalModel.slug)),
    variant: text(record(document.identity).variant) || undefined,
    access: {
      visibility: text(record(document.access).visibility) || undefined,
      gated: typeof record(document.access).gated === "boolean" ? record(document.access).gated as boolean : undefined,
      authentication: text(record(document.access).authentication) || undefined,
    },
    source_repository: text(source.repository) || undefined,
    source_revision: text(source.revision) || undefined,
    format: { container: text(format.container) || undefined, precision: text(format.precision) || undefined, quantization: text(format.quantization) || undefined },
    parameters: { total: optionalNumber(parameters.total), active: optionalNumber(parameters.active) },
    limits: { context_tokens: optionalNumber(limits.context_tokens), resolution_pixels: optionalNumber(limits.resolution_pixels), frames: optionalNumber(limits.frames), sample_rate_hz: optionalNumber(limits.sample_rate_hz) },
    sizes: { download_bytes: modelSize(document, true), installed_bytes: modelSize(document, false) },
    license: { spdx: text(license.spdx) || undefined, url: text(license.url) || undefined, attribution: array(license.attribution).map((value) => text(value)).filter(Boolean), operator_acceptance_required: typeof license.operator_acceptance_required === "boolean" ? license.operator_acceptance_required : undefined },
    availability: ["active", "withdrawn", "superseded"].includes(text(document.availability)) ? text(document.availability) as ModelVersionSummary["availability"] : undefined,
    tags: array(metadata.tags).map((value) => text(value).toLowerCase()).filter(Boolean),
    capabilities: capabilities.values,
    capability_evidence: capabilities.evidence,
    recipe_slugs: recipeSlugs,
  };
}

function recipeModels(recipe: RecipeSummary): JsonRecord[] {
  return array((recipe as RecipeSummary & { latest_revision: { document: JsonRecord } }).latest_revision.document.models)
    .map((selection) => record(record(selection).model));
}

function recipeModelSelections(document: JsonRecord): JsonRecord[] {
  return array(document.models).map(record);
}

function mapModels(index: LibraryIndex, baseUrl: string): ModelSummary[] {
  const entities = index.catalog_entities;
  const recipes = index.recipes.map((item) => mapRecipe(item, index, baseUrl));
  const models = entities.filter((entity) => entity.document.kind === "model");
  const groups = new Map<string, LibraryEntity[]>();
  for (const entity of models) {
    const logical = modelIdentity(entity.document);
    const key = `${text(logical.publisher)}\0${text(logical.slug)}`;
    groups.set(key, [...(groups.get(key) ?? []), entity]);
  }
  return Array.from(groups.values()).map((variants) => {
    const first = variants[0]!;
    const identity = modelIdentity(first.document);
    const family = modelFamily(first.document);
    const versionRows = variants.map((version) => mapModelVersion(version, recipes)).sort((left, right) => left.title.localeCompare(right.title));
    return {
      publisher: text(identity.publisher),
      slug: text(identity.slug),
      title: text(identity.title, text(identity.slug)),
      description: text(record(first.document.metadata).description),
      family: text(family.slug) || undefined,
      tags: array(record(first.document.metadata).tags).map((value) => text(value).toLowerCase()).filter(Boolean),
      revision_id: text(first.content_sha256, "unknown"),
      versions: versionRows,
      recipe_count: new Set(versionRows.flatMap((version) => version.recipe_slugs)).size,
    };
  }).sort((left, right) => left.title.localeCompare(right.title));
}

function publicMetadata(document: JsonRecord, index: LibraryIndex, artifacts: RecipeSummary["artifacts"]): NonNullable<RecipeSummary["catalog"]> {
  const recipeTags = tags(document);
  const metadata = record(document.metadata);
  const runtime = record(document.runtime);
  const topology = record(document.topology);
  const provenance = record(document.provenance);
  const model = modelMetadata(document, index);
  const source = canonicalSource(text(provenance.source_reference));
  const alignmentValue = text(metadata.alignment, "unspecified");
  const alignment = ["standard", "abliterated", "derisked", "other-modified", "unspecified"].includes(alignmentValue) ? alignmentValue as NonNullable<RecipeSummary["catalog"]>["alignment"] : "unspecified";
  const selected = recipeModelSelections(document)[0];
  const modelEntity = index.catalog_entities.find((entity) => selected && sameReference(selected.model, entity));
  const format = record(modelEntity?.document.format);
  const quantization = text(format.quantization);
  const quantizations = quantization ? [quantization.toUpperCase()] : [];
  const precision = text(format.precision) || null;
  return {
    description: text(metadata.description),
    tags: recipeTags,
    model_publisher: model.publisher,
    model_slug: model.slug,
    model_title: model.title,
    model_version_publisher: model.versionPublisher,
    model_version_slug: model.versionSlug,
    model_version_title: model.versionTitle,
    model_version_content_sha256: model.versionRevisionId || null,
    source_owner: source?.owner ?? null,
    source_repository: source?.repository ?? null,
    alignment,
    capabilities: modelEntity ? modelVersionCapabilities(modelEntity.document) : [],
    qualification: qualification(recipeTags),
    execution_readiness: executionReadiness(recipeTags),
    runtime_distribution: text(runtime.engine, "unknown"),
    precision,
    quantizations,
    topology_name: text(topology.name),
    topology_mode: text(topology.mode),
    node_count: Math.max(1, number(topology.node_count)),
    expected_download_bytes: (artifacts ?? []).reduce((total, artifact) => total + (artifact.download_bytes ?? 0), 0),
  };
}

function mapRecipe(item: LibraryRecipe, index: LibraryIndex, baseUrl: string): RecipeDetail {
  const document = record(item.document);
  const identity = record(document.identity);
  const metadata = record(document.metadata);
  const execution = record(document.execution);
  const build = record(execution.build);
  const context = record(build.context);
  const topology = record(document.topology);
  const release = record(item.release);
  const history = array(release.history);
  const publisher = text(identity.publisher);
  const slug = text(identity.slug);
  const nodeCount = Math.max(1, number(topology.node_count));
  const resources = nodeResources(document);
  const artifacts = recipeModelSelections(document).flatMap((selection) => {
    const entity = index.catalog_entities.find((candidate) => sameReference(selection.model, candidate));
    const source = record(entity?.document.source);
    const selectedFiles = new Set(array(selection.files).map((value) => text(record(value).file_id)));
    return entity ? modelFiles(entity.document)
      .filter((file) => selectedFiles.has(text(file.id)))
      .map((file) => ({
        kind: "model-file",
        repository: text(source.repository),
        revision: text(source.revision),
        download_bytes: number(file.size_bytes),
        installed_bytes: number(file.size_bytes),
      })) : [];
  });
  const provenance = record(document.provenance);
  const version = text(release.version);
  const sourceUrl = `https://github.com/${index.repository}/blob/${index.source_commit}/${item.source_path}`;
  const packageUrl = new URL(item.package.path, baseUrl).toString();
  const contextPath = text(context.path);

  return {
    publisher,
    slug,
    title: text(metadata.title, slug),
    official: publisher === "vonk-forge",
    revision_number: Math.max(1, history.length),
    revision_id: item.content_sha256,
    content_sha256: item.content_sha256,
    published_at: text(release.released_at),
    version: version || undefined,
    runtime: {
      adapter: runtimeAdapter(document),
      entrypoint: array(record(document.runtime).entrypoint).map((value) => text(value)).filter(Boolean),
    },
    build: {
      context: {
        sha256: text(context.sha256),
        expected_bytes: number(context.expected_bytes),
      },
      dockerfile: text(build.dockerfile),
    },
    artifacts,
    provenance: {
      source_kind: text(provenance.source_kind),
      source_reference: text(provenance.source_reference) || null,
      attribution: array(provenance.attribution).map((value) => text(value)).filter(Boolean),
    },
    workload: {
      family: modelMetadata(document, index).slug || publisher,
      capabilities: publicMetadata(document, index, artifacts).capabilities,
    },
    deployment_profiles: [{ name: text(topology.name, nodeCount === 1 ? "single" : `${nodeCount}-node`), node_count: nodeCount }],
    capacity: {
      profile_node_counts: [nodeCount],
      maximum_installed_bytes_per_node: resources.disk || undefined,
      maximum_runtime_memory_bytes_per_node: resources.memory || undefined,
    },
    moderation_warning: null,
    facts: {
      declared: true,
      source_bundle_observed: Boolean(text(context.sha256)),
      publisher_tested: false,
      publisher_tested_label: "No accepted publisher test report",
      vonk_verified: false,
      last_validation: null,
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
      url: packageUrl,
      sha256: item.package.sha256,
      bytes: item.package.expected_bytes,
      media_type: item.package.media_type,
    },
    catalog: publicMetadata(document, index, artifacts),
    latest_revision: {
      revision_number: Math.max(1, history.length),
      content_sha256: item.content_sha256,
      document,
    },
  };
}

async function loadIndex(url: string, signal?: AbortSignal): Promise<LibraryIndex> {
  if (cachedIndex) return cachedIndex;
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal });
  if (!response.ok) throw new Error(`Recipe library returned ${response.status}`);
  const body = await response.json() as Partial<LibraryIndex>;
  const entities = body.catalog_entities;
  const validEntities = Array.isArray(entities) && entities.length > 0 && entities.every((value) => {
    const entity = record(value);
    const document = record(entity.document);
    const identity = record(document.identity);
    return /^[0-9a-f]{64}$/.test(text(entity.content_sha256))
      && typeof document.kind === "string"
      && typeof identity.publisher === "string"
      && typeof identity.slug === "string";
  });
  if (body.schema_version !== 2 || body.kind !== "recipe-library-index" || typeof body.repository !== "string" || typeof body.source_commit !== "string" || !validEntities || !Array.isArray(body.recipes) || !body.package_contract || body.package_contract.schema_version !== 2 || typeof body.package_contract.media_type !== "string" || typeof body.package_contract.path_prefix !== "string") {
    throw new Error("Recipe library returned an unsupported catalog index");
  }
  cachedIndex = body as LibraryIndex;
  return cachedIndex;
}

function matches(recipe: RecipeSummary, parameters: URLSearchParams): boolean {
  const query = (parameters.get("q") ?? "").trim().toLowerCase();
  const runtime = parameters.get("runtime") ?? "";
  const topology = parameters.get("topology") ?? "";
  const official = parameters.get("official") ?? "";
  const searchable = [
    recipe.title,
    recipe.publisher,
    recipe.slug,
    recipe.workload.family,
    ...(recipe.workload.capabilities ?? []),
  ].join(" ").toLowerCase();
  if (query && !searchable.includes(query)) return false;
  if (runtime && recipe.runtime.adapter !== runtime) return false;
  const nodes = recipe.capacity?.profile_node_counts?.[0] ?? 1;
  if (topology === "single" && nodes !== 1) return false;
  if (topology === "distributed" && nodes <= 1) return false;
  if (official === "true" && !recipe.official) return false;
  if (official === "false" && recipe.official) return false;
  return true;
}

export async function listStaticRecipes(
  url: string,
  parameters: URLSearchParams,
  signal?: AbortSignal,
): Promise<RecipePage> {
  const index = await loadIndex(url, signal);
  const sort = parameters.get("sort") ?? "newest";
  const offset = Math.max(0, Number.parseInt(parameters.get("cursor") ?? "0", 10) || 0);
  const pageSize = 24;
  const recipes = index.recipes.map((item) => mapRecipe(item, index, url)).filter((recipe) => matches(recipe, parameters));
  recipes.sort((left, right) => {
    if (sort === "title") return left.title.localeCompare(right.title);
    if (sort === "disk") return (left.capacity?.maximum_installed_bytes_per_node ?? Number.MAX_SAFE_INTEGER) - (right.capacity?.maximum_installed_bytes_per_node ?? Number.MAX_SAFE_INTEGER);
    if (sort === "memory") return (left.capacity?.maximum_runtime_memory_bytes_per_node ?? Number.MAX_SAFE_INTEGER) - (right.capacity?.maximum_runtime_memory_bytes_per_node ?? Number.MAX_SAFE_INTEGER);
    return right.published_at.localeCompare(left.published_at) || left.title.localeCompare(right.title);
  });
  return {
    items: recipes.slice(offset, offset + pageSize),
    next_cursor: offset + pageSize < recipes.length ? String(offset + pageSize) : null,
  };
}

export async function listStaticRecipeCatalog(url: string, signal?: AbortSignal): Promise<RecipeSummary[]> {
  const index = await loadIndex(url, signal);
  return index.recipes.map((item) => mapRecipe(item, index, url));
}

export async function listStaticModels(url: string, signal?: AbortSignal): Promise<ModelPage> {
  const index = await loadIndex(url, signal);
  return { items: mapModels(index, url) };
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
  const item = index.recipes.find((candidate) => {
    const identity = record(record(candidate.document).identity);
    return identity.publisher === publisher && identity.slug === slug;
  });
  if (!item) throw new Error("Recipe not found in the public library");
  return mapRecipe(item, index, url);
}

export function resetStaticCatalogCacheForTests(): void {
  cachedIndex = null;
}
