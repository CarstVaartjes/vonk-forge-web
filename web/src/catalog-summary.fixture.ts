// A summary of a small release, for tests of what the home page draws: three Working one-Spark
// recipes (two language, vision and audio, one 3D; one has a measured peak) and an eight-Spark
// recipe that is not verified.
import {
  catalogEnvelope,
  makeCatalog,
  makeModel,
  makeRecipe,
  notYetVerified,
} from "./api/catalog-factory.fixture";
import { parseLibraryIndex, recipesFromIndex } from "./api/static-catalog";
import { type CatalogSummary, deriveCatalogStats } from "./catalog-stats";

const multimodal = [
  "audio-understanding",
  "chat",
  "image-understanding",
  "text-generation",
] as const;
const gemma = makeModel({
  document: { identity: { publisher: "google", slug: "gemma-4" } },
  display: { capabilities: [...multimodal] },
});
const shapes = makeModel({
  document: { identity: { publisher: "vast-ai", slug: "shapes" } },
  display: {
    capabilities: ["3d-generation"],
    lineage: { family: "vast-ai", line: "shapes", model: "shapes", variant_kind: "base" },
  },
});
const large = makeModel({ document: { identity: { publisher: "inkling", slug: "inkling" } } });

const index = makeCatalog({
  models: [gemma, shapes, large],
  recipes: [
    makeRecipe(
      {
        document: { identity: { publisher: "vonk-forge", slug: "gemma-vllm" } },
        display: { title: "Gemma vLLM single Spark" },
        release: { version: "1.0.0", released_at: "2026-11-03" },
        measured_memory: {
          roles: [
            {
              role: "entrypoint",
              peak_bytes: 10_735_910_912,
              measured_peak_bytes: 10_735_910_912,
              exceeds_admission_maximum: false,
            },
          ],
        },
      },
      { model: gemma },
    ),
    makeRecipe(
      {
        document: { identity: { publisher: "vonk-forge", slug: "gemma-llamacpp" } },
        display: { title: "Gemma llama.cpp single Spark" },
        release: { version: "1.0.0", released_at: "2026-11-04" },
      },
      { model: gemma },
    ),
    makeRecipe(
      {
        document: { identity: { publisher: "vonk-forge", slug: "shapes-pytorch" } },
        display: { title: "Shapes single Spark" },
        release: { version: "1.0.0", released_at: "2026-10-26" },
      },
      { model: shapes },
    ),
    makeRecipe(
      {
        document: {
          identity: { publisher: "vonk-forge", slug: "inkling-eight" },
          topology: { name: "eight", node_count: 8 },
        },
        display: { title: "Inkling eight Sparks" },
        qualification: notYetVerified(8),
        release: { version: "1.0.0", released_at: "2026-11-01" },
      },
      { model: large },
    ),
  ],
});
const release = {
  repository: index.repository,
  tag: `v${catalogEnvelope.contract_version}`,
  contract_version: index.contract_version,
  updated_at: index.updated_at,
  source_commit: index.source_commit,
  catalog_index_sha256: "a".repeat(64),
};

export const summaryFixture: CatalogSummary = {
  summary_version: 2,
  release: release.tag,
  catalog_index_sha256: release.catalog_index_sha256,
  ...deriveCatalogStats(
    recipesFromIndex(parseLibraryIndex(index, release)),
    index.vocabulary,
    index.updated_at,
  ),
};
