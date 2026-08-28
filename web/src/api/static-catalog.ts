import type { RecipeDetail, RecipePage, RecipeSummary } from "./client";


type JsonRecord = Record<string, unknown>;

interface LibraryRecipe {
  content_sha256: string;
  document: JsonRecord;
  release?: JsonRecord;
  source_path: string;
}

interface LibraryIndex {
  catalog_entities?: Array<{ document: JsonRecord }>;
  repository: string;
  recipes: LibraryRecipe[];
  schema_version: number;
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
  const distribution = record(runtime.distribution);
  const execution = record(document.execution);
  const harness = record(execution.harness);
  const haystack = [
    text(distribution.slug),
    text(harness.slug),
    ...array(runtime.entrypoint).map((value) => text(value)),
  ].join(" ").toLowerCase();
  if (haystack.includes("vllm")) return "vllm";
  if (haystack.includes("sglang")) return "sglang";
  if (haystack.includes("llama")) return "llama.cpp";
  if (haystack.includes("ds4")) return "ds4";
  return text(distribution.slug, text(harness.slug, "custom"));
}

const PUBLIC_CAPABILITIES = ["chat", "reasoning", "vision", "image-generation", "image-editing", "video", "audio", "3d"] as const;

function tags(document: JsonRecord): string[] {
  return array(record(document.metadata).tags).map((value) => text(value).toLowerCase()).filter(Boolean);
}

function publicCapabilities(document: JsonRecord, recipeTags: string[]): string[] {
  const adapters = new Set(array(document.interfaces).map((value) => text(record(value).adapter)));
  const values = new Set<string>();
  if (adapters.has("openai")) values.add("chat");
  if (recipeTags.includes("reasoning")) values.add("reasoning");
  if (recipeTags.some((value) => ["vision", "multimodal", "omni"].includes(value))) values.add("vision");
  const editing = recipeTags.some((value) => ["editing", "image-to-image", "layered"].includes(value));
  if (editing) values.add("image-editing");
  if ((adapters.has("image-job") && !editing) || recipeTags.some((value) => ["generation", "text-to-image"].includes(value))) values.add("image-generation");
  if (adapters.has("video-job") || recipeTags.includes("video")) values.add("video");
  if (adapters.has("audio-job") || recipeTags.includes("audio")) values.add("audio");
  if (adapters.has("mesh-job") || recipeTags.some((value) => ["three-d", "3d", "mesh"].includes(value))) values.add("3d");
  return PUBLIC_CAPABILITIES.filter((value) => values.has(value));
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

function modelMetadata(document: JsonRecord, index: LibraryIndex): { publisher: string; slug: string; title: string; versionPublisher: string; versionSlug: string; versionTitle: string } {
  const reference = record(document.model);
  const versionPublisher = text(reference.publisher, "unknown");
  const versionSlug = text(reference.slug, "unknown");
  let versionTitle = versionSlug;
  let publisher = versionPublisher;
  let slug = versionSlug;
  let title = slug;
  const entities = array(index.catalog_entities).map((value) => record(record(value).document));
  const version = entities.find((entity) => {
    const identity = record(entity.identity);
    return entity.kind === "model-version" && identity.publisher === versionPublisher && identity.slug === versionSlug;
  });
  versionTitle = text(record(version?.metadata).title, versionSlug);
  const modelReference = record(version?.model);
  if (text(modelReference.publisher) && text(modelReference.slug)) {
    publisher = text(modelReference.publisher);
    slug = text(modelReference.slug);
    const model = entities.find((entity) => {
      const identity = record(entity.identity);
      return entity.kind === "model" && identity.publisher === publisher && identity.slug === slug;
    });
    title = text(record(model?.metadata).title, slug);
  }
  return { publisher, slug, title, versionPublisher, versionSlug, versionTitle };
}

function publicMetadata(document: JsonRecord, index: LibraryIndex, artifacts: RecipeSummary["artifacts"]): NonNullable<RecipeSummary["catalog"]> {
  const recipeTags = tags(document);
  const metadata = record(document.metadata);
  const runtime = record(record(document.runtime).distribution);
  const topology = record(document.topology);
  const provenance = record(document.provenance);
  const model = modelMetadata(document, index);
  const source = canonicalSource(text(provenance.source_reference));
  const precisionTokens = new Set([...recipeTags, ...(text(metadata.title).toLowerCase().match(/[a-z0-9]+/g) ?? []), ...(model.versionTitle.toLowerCase().match(/[a-z0-9]+/g) ?? [])]);
  const quantizations = ["nvfp4", "bf16", "fp8", "fp4", "fp16", "int8", "int4", "exl3", "aqlm", "awq", "gptq", "gguf", "torchao"]
    .filter((value) => precisionTokens.has(value))
    .map((value) => value === "torchao" ? "TorchAO" : value.toUpperCase());
  const precision = quantizations[0] ?? null;
  return {
    description: text(metadata.description),
    tags: recipeTags,
    model_publisher: model.publisher,
    model_slug: model.slug,
    model_title: model.title,
    model_version_publisher: model.versionPublisher,
    model_version_slug: model.versionSlug,
    model_version_title: model.versionTitle,
    source_owner: source?.owner ?? null,
    source_repository: source?.repository ?? null,
    capabilities: publicCapabilities(document, recipeTags),
    qualification: qualification(recipeTags),
    execution_readiness: executionReadiness(recipeTags),
    runtime_distribution: text(runtime.slug, "unknown"),
    precision,
    quantizations,
    topology_name: text(topology.name),
    topology_mode: text(topology.mode),
    node_count: Math.max(1, number(topology.node_count)),
    expected_download_bytes: (artifacts ?? []).reduce((total, artifact) => total + (artifact.download_bytes ?? 0), 0),
  };
}

function mapRecipe(item: LibraryRecipe, index: LibraryIndex): RecipeDetail {
  const document = record(item.document);
  const identity = record(document.identity);
  const metadata = record(document.metadata);
  const build = record(document.build);
  const context = record(build.context);
  const topology = record(document.topology);
  const release = record(item.release);
  const history = array(release.history);
  const publisher = text(identity.publisher);
  const slug = text(identity.slug);
  const nodeCount = Math.max(1, number(topology.node_count));
  const resources = nodeResources(document);
  const artifacts = array(document.artifacts).map((value) => {
    const artifact = record(value);
    return {
      kind: text(artifact.kind),
      repository: text(artifact.repository),
      revision: text(artifact.revision),
      download_bytes: number(artifact.download_bytes),
      installed_bytes: number(artifact.installed_bytes),
    };
  });
  const provenance = record(document.provenance);
  const version = text(release.version);
  const sourceUrl = `https://github.com/${index.repository}/blob/main/${item.source_path}`;
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
      family: text(record(document.model).slug, publisher),
      capabilities: publicCapabilities(document, tags(document)),
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
      instruction: "Open Library in your local controller and import this immutable recipe.",
    },
    source: {
      recipe_url: sourceUrl,
      bundle_url: contextPath ? `https://github.com/${index.repository}/tree/main/${contextPath}` : undefined,
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
  if (body.schema_version !== 2 || typeof body.repository !== "string" || !Array.isArray(body.recipes)) {
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
  const recipes = index.recipes.map((item) => mapRecipe(item, index)).filter((recipe) => matches(recipe, parameters));
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
  return index.recipes.map((item) => mapRecipe(item, index));
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
  return mapRecipe(item, index);
}

export function resetStaticCatalogCacheForTests(): void {
  cachedIndex = null;
}
