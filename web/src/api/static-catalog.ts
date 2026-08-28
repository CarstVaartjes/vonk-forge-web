import type { RecipeDetail, RecipePage, RecipeSummary } from "./client";


type JsonRecord = Record<string, unknown>;

interface LibraryRecipe {
  content_sha256: string;
  document: JsonRecord;
  release?: JsonRecord;
  source_path: string;
}

interface LibraryIndex {
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

function mapRecipe(item: LibraryRecipe, repository: string): RecipeDetail {
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
  const sourceUrl = `https://github.com/${repository}/blob/main/${item.source_path}`;
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
      capabilities: array(metadata.tags).map((value) => text(value)).filter(Boolean),
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
      bundle_url: contextPath ? `https://github.com/${repository}/tree/main/${contextPath}` : undefined,
    },
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
  if (topology === "gang" && nodes <= 1) return false;
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
  const recipes = index.recipes.map((item) => mapRecipe(item, index.repository)).filter((recipe) => matches(recipe, parameters));
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
  return mapRecipe(item, index.repository);
}

export function resetStaticCatalogCacheForTests(): void {
  cachedIndex = null;
}
