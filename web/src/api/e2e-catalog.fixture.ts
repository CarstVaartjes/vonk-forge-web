// The catalog the end-to-end suite serves at /catalog/. Built on real catalog entries (a Working
// recipe and its model, from catalog.fixture.ts) so every field the contract requires is present;
// each entry changes only what the pages show. It lives under src/ so `tsc` checks it against the
// generated contract types.
import type { CatalogIndex, CatalogModelEntry, CatalogRecipeEntry } from "./catalog-types";
import { catalogIndexFixture } from "./catalog.fixture";

export const sourceCommit = "f".repeat(40);
export const recipeDigest = "a".repeat(64);
const modelDigest = "3".repeat(64);
const today = new Date().toISOString().slice(0, 10);

const baseModel: CatalogModelEntry = catalogIndexFixture.catalog_entities[0]!;
const baseRecipe: CatalogRecipeEntry = catalogIndexFixture.recipes[0]!;

function modelEntity(options: { digest: string; slug: string; logical: string; publisher: string; family: string; title: string; capabilities: CatalogModelEntry["display"]["capabilities"]; repository: string; fileDigest: string; tags?: string[] }) {
  return {
    ...baseModel,
    content_sha256: options.digest,
    document: {
      ...baseModel.document,
      identity: {
        publisher: options.publisher,
        slug: options.slug,
        family: { publisher: options.publisher, slug: options.family.toLowerCase().replaceAll(" ", "-") },
        model: { publisher: options.publisher, slug: options.logical },
        version: "1.0",
        variant: "nvfp4",
      },
      source: { repository: options.repository, revision: "c".repeat(40) },
      format: { precision: "nvfp4", quantization: "nvfp4" },
      files: [{ id: "weights", path: "weights.safetensors", sha256: options.fileDigest, size_bytes: 20_000_000_000, roles: ["weights"] }],
    },
    display: { ...baseModel.display, capabilities: options.capabilities, family_title: options.family, model_title: options.title, description: `${options.title} model`, tags: options.tags ?? [] },
  } satisfies CatalogModelEntry;
}

const notYetVerified = (nodes: number): CatalogRecipeEntry["qualification"] => ({ changed: [], reason: "needs more Sparks", required_sparks: nodes, status: "Not yet verified" });

function recipeEntry(options: { digest: string; slug: string; title: string; modelDigest: string; modelSlug: string; modelPublisher: string; status: "Working" | "Not yet verified"; nodes: number; releasedAt: string; reference: string; tags?: string[] }) {
  const selection = baseRecipe.document.models[0]!;
  const role = baseRecipe.document.topology.roles[0]!;
  return {
    ...baseRecipe,
    content_sha256: options.digest,
    source_path: `recipes/${options.slug}.json`,
    package: { ...baseRecipe.package, path: `packages/vonk-forge-${options.slug}.tar.gz`, recipe_content_sha256: options.digest },
    qualification: options.status === "Working" ? { ...baseRecipe.qualification, required_sparks: options.nodes } : notYetVerified(options.nodes),
    display: { ...baseRecipe.display, title: options.title, description: `${options.title} recipe`, tags: options.tags ?? ["candidate", "executable"], alignment: "standard" },
    release: { version: "2.1.0", released_at: options.releasedAt },
    document: {
      ...baseRecipe.document,
      identity: { publisher: "vonk-forge", slug: options.slug },
      models: [{ ...selection, model: { kind: "model", publisher: options.modelPublisher, slug: options.modelSlug, content_sha256: options.modelDigest }, files: [{ id: "weights", file_id: "weights", roles: ["entrypoint"], mount: { target: "/models" } }] }],
      runtime: { ...baseRecipe.document.runtime, engine: "vllm", entrypoint: ["vllm", "serve", "/models"] },
      execution: { build: { ...baseRecipe.document.execution.build, context: { path: "adapters/qwen" }, dockerfile: "Dockerfile" } },
      topology: {
        ...baseRecipe.document.topology,
        name: options.nodes === 1 ? "single" : "pair",
        node_count: options.nodes,
        roles: [{ ...role, resources: { disk: { ...role.resources.disk, artifact_bytes: 21_474_836_480 }, memory: { ...role.resources.memory, peak_bytes: 51_539_607_552 } } }],
      },
      provenance: { source_reference: options.reference, attribution: [options.title] },
    },
  } satisfies CatalogRecipeEntry;
}

export const e2eCatalogIndex = {
  ...catalogIndexFixture,
  source_commit: sourceCommit,
  catalog_entities: [
    modelEntity({ digest: modelDigest, slug: "qwen-fast-nvfp4", logical: "qwen-fast", publisher: "qwen", family: "Qwen", title: "Qwen Fast", capabilities: ["chat", "reasoning"], repository: "https://huggingface.co/Qwen/Qwen-Fast", fileDigest: "b".repeat(64), tags: ["language"] }),
    modelEntity({ digest: "4".repeat(64), slug: "qwen-code-bf16", logical: "qwen-code", publisher: "qwen", family: "Qwen", title: "Qwen Code", capabilities: ["code-generation"], repository: "https://huggingface.co/qwen/Qwen-Code", fileDigest: "c".repeat(64) }),
    modelEntity({ digest: "5".repeat(64), slug: "acme-coder-bf16", logical: "acme-coder", publisher: "acme", family: "Acme Coder", title: "Acme Coder", capabilities: ["code-generation", "text-generation"], repository: "https://github.com/Acme/Acme-Coder", fileDigest: "d".repeat(64) }),
    modelEntity({ digest: "6".repeat(64), slug: "acme-vision-bf16", logical: "acme-vision", publisher: "acme", family: "Acme", title: "Acme Vision", capabilities: ["image-understanding", "text-generation"], repository: "https://github.com/Acme/Acme-Vision", fileDigest: "e".repeat(64) }),
    modelEntity({ digest: "7".repeat(64), slug: "acme-shapes-bf16", logical: "acme-shapes", publisher: "acme", family: "Acme", title: "Acme Shapes", capabilities: ["3d-generation"], repository: "https://github.com/Acme/Acme-Shapes", fileDigest: "f".repeat(64) }),
  ],
  recipes: [
    recipeEntry({ digest: recipeDigest, slug: "qwen-fast", title: "Qwen Fast", modelDigest, modelSlug: "qwen-fast-nvfp4", modelPublisher: "qwen", status: "Working", nodes: 2, releasedAt: "2026-08-07", reference: "https://huggingface.co/Qwen/Qwen-Fast", tags: ["candidate", "executable", "chat", "nvfp4"] }),
    recipeEntry({ digest: "8".repeat(64), slug: "qwen-code", title: "Qwen Code", modelDigest: "4".repeat(64), modelSlug: "qwen-code-bf16", modelPublisher: "qwen", status: "Not yet verified", nodes: 1, releasedAt: "2026-08-01", reference: "https://huggingface.co/qwen/Qwen-Code" }),
    recipeEntry({ digest: "9".repeat(64), slug: "acme-coder", title: "Acme Coder", modelDigest: "5".repeat(64), modelSlug: "acme-coder-bf16", modelPublisher: "acme", status: "Working", nodes: 1, releasedAt: today, reference: "https://github.com/Acme/Acme-Coder" }),
    recipeEntry({ digest: "2".repeat(64), slug: "acme-shapes", title: "Acme Shapes", modelDigest: "7".repeat(64), modelSlug: "acme-shapes-bf16", modelPublisher: "acme", status: "Working", nodes: 1, releasedAt: "2026-08-03", reference: "https://github.com/Acme/Acme-Shapes" }),
    recipeEntry({ digest: "1".repeat(64), slug: "acme-vision", title: "Acme Vision", modelDigest: "6".repeat(64), modelSlug: "acme-vision-bf16", modelPublisher: "acme", status: "Working", nodes: 1, releasedAt: "2026-08-02", reference: "https://github.com/Acme/Acme-Vision" }),
  ],
} satisfies CatalogIndex;



