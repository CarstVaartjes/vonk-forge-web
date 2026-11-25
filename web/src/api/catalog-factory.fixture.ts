// Builders for catalog tests: a valid default entry per kind, typed against the generated contract
// types (a field the schema lacks fails `tsc`), with deep overrides. A test builds only the entries it
// needs and states the facts it asserts on; nothing here is a snapshot of a real release. The one real
// copy is `vocabulary`, the published words, which the single-source guard compares the site against.
import { createHash } from "node:crypto";

import type { CatalogIndex, CatalogModelEntry, CatalogRecipeEntry } from "./catalog-types";

// Arrays and scalars replace; objects merge. `null` is a value (an absent optional document).
export type Overrides<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: Overrides<T[K]> }
    : T;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function merge<T>(base: T, patch: unknown): T {
  if (patch === undefined) return base;
  if (!isRecord(base) || !isRecord(patch)) return patch as T;
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) out[key] = merge(out[key], value);
  return out as T;
}

export const digestOf = (text: string): string => createHash("sha256").update(text).digest("hex");

export const catalogEnvelope = {
  schema_version: 2,
  kind: "recipe-library-index",
  contract_version: "4.8.0",
  updated_at: "2026-11-12T10:23:34Z",
  repository: "CarstVaartjes/vonk-forge-recipes",
  source_commit: "7".repeat(40),
  package_contract: {
    media_type: "application/vnd.vonk-forge.recipe-package.v2+tar+gzip",
    metadata_fields: [
      "path",
      "media_type",
      "sha256",
      "expected_bytes",
      "recipe_content_sha256",
      "minimum_consumer_schema",
      "source_bundle_sha256",
    ],
    path_prefix: "packages/",
    schema_version: 2,
  },
  vocabulary: {
    capabilities: [
      {
        category: "3d",
        description: "Creates 3D assets such as meshes from text or images.",
        label: "3D generation",
        name: "3d-generation",
      },
      {
        category: "audio",
        description: "Creates music or sound.",
        label: "Audio generation",
        name: "audio-generation",
      },
      {
        category: "audio",
        description: "Takes audio as input and answers about it.",
        label: "Audio understanding",
        name: "audio-understanding",
      },
      {
        category: "language",
        description: "Holds a conversation in turns.",
        label: "Chat",
        name: "chat",
      },
      {
        category: "code",
        description: "Writes and edits program code.",
        label: "Code generation",
        name: "code-generation",
      },
      {
        category: "other",
        description: "Chooses between options and returns the choice.",
        label: "Decision",
        name: "decision",
      },
      {
        category: "image",
        description: "Changes an existing image from an instruction.",
        label: "Image editing",
        name: "image-editing",
      },
      {
        category: "image",
        description: "Creates images from text.",
        label: "Image generation",
        name: "image-generation",
      },
      {
        category: "vision",
        description: "Takes images as input and answers about them.",
        label: "Image understanding",
        name: "image-understanding",
      },
      {
        category: "image",
        description: "Raises the resolution of an image.",
        label: "Image upscaling",
        name: "image-upscaling",
      },
      {
        category: "3d",
        description: "Estimates surface materials of a 3D asset or image.",
        label: "Material estimation",
        name: "material-estimation",
      },
      {
        category: "3d",
        description: "Recovers body motion from video.",
        label: "Motion capture",
        name: "motion-capture",
      },
      {
        category: "3d",
        description: "Creates character motion from text.",
        label: "Motion generation",
        name: "motion-generation",
      },
      {
        category: "vision",
        description: "Reads text from images and documents.",
        label: "OCR",
        name: "ocr",
      },
      {
        category: "3d",
        description: "Represents a human body by shape and pose parameters.",
        label: "Parametric body model",
        name: "parametric-body-model",
      },
      {
        category: "vision",
        description: "Finds people in images or video.",
        label: "Person detection",
        name: "person-detection",
      },
      {
        category: "language",
        description: "Works through a problem in steps before answering.",
        label: "Reasoning",
        name: "reasoning",
      },
      {
        category: "language",
        description: "A draft model that speeds up another model's text generation.",
        label: "Speculative decoding",
        name: "speculative-decoding",
      },
      {
        category: "audio",
        description: "Turns speech into text.",
        label: "Speech recognition",
        name: "speech-recognition",
      },
      {
        category: "language",
        description: "Continues or writes text from a prompt.",
        label: "Text generation",
        name: "text-generation",
      },
      {
        category: "audio",
        description: "Speaks text aloud.",
        label: "Text to speech",
        name: "text-to-speech",
      },
      {
        category: "language",
        description: "Calls functions or tools you describe.",
        label: "Tool use",
        name: "tool-use",
      },
      {
        category: "video",
        description: "Creates video clips.",
        label: "Video generation",
        name: "video-generation",
      },
      {
        category: "vision",
        description: "Takes video as input and answers about it.",
        label: "Video understanding",
        name: "video-understanding",
      },
      {
        category: "audio",
        description: "Speaks in the voice of a reference recording.",
        label: "Voice cloning",
        name: "voice-cloning",
      },
      {
        category: "audio",
        description: "Creates a new voice from a description.",
        label: "Voice design",
        name: "voice-design",
      },
    ],
    categories: [
      {
        id: "language",
        label: "Language",
      },
      {
        id: "code",
        label: "Code",
      },
      {
        id: "vision",
        label: "Vision",
      },
      {
        id: "image",
        label: "Image",
      },
      {
        id: "video",
        label: "Video",
      },
      {
        id: "audio",
        label: "Audio",
      },
      {
        id: "3d",
        label: "3D",
      },
      {
        id: "other",
        label: "Other",
      },
    ],
    statuses: [
      {
        meaning: "Passed on a real DGX Spark for this exact recipe, runtime image and model.",
        status: "Working",
        verified: true,
      },
      {
        meaning: "Passed before, but the recipe, image or model has changed since.",
        status: "Re-check: worked before",
        verified: false,
      },
      {
        meaning: "A recipe failure was followed by a change to the recipe, image or model.",
        status: "Fix to verify",
        verified: false,
      },
      {
        meaning: "Failed on a real DGX Spark with the current recipe, image and model.",
        status: "Failed: recipe",
        verified: false,
      },
      {
        meaning: "Could not run because of a platform fault, not because of the recipe.",
        status: "Blocked: platform",
        verified: false,
      },
      {
        meaning: "No hardware verdict yet.",
        status: "Untested",
        verified: false,
      },
      {
        meaning: "Needs more Sparks than the test fleet has.",
        status: "Can't test here",
        verified: false,
      },
      {
        meaning: "Being tested on hardware now; the earlier result stays visible.",
        status: "Testing now",
        verified: false,
      },
      {
        meaning: "No hardware verdict yet; the reason is shown under the badge.",
        status: "Not yet verified",
        verified: false,
      },
    ],
  },
} satisfies Omit<CatalogIndex, "catalog_entities" | "recipes" | "families">;

// One variant of a model: a chat model with a single weights file. Its content digest follows its
// identity unless a test states one.
export function makeModel(overrides: Overrides<CatalogModelEntry> = {}): CatalogModelEntry {
  const base: CatalogModelEntry = {
    content_sha256: "",
    source_path: "models/acme-chat-1.json",
    display: {
      kind: "model-display",
      identity: { publisher: "acme", slug: "acme-chat-1" },
      model_title: "Acme Chat",
      family_title: "Acme",
      description: "An Acme chat model.",
      capabilities: ["chat", "text-generation"],
      modalities: ["text"],
      lineage: { family: "acme", line: "acme-chat", model: "acme-chat", variant_kind: "base" },
      license: { spdx: "Apache-2.0", url: "https://example.test/license", attribution: ["Acme"] },
      tags: ["acme", "language"],
    },
    document: {
      kind: "model",
      identity: {
        publisher: "acme",
        slug: "acme-chat-1",
        model: { publisher: "acme", slug: "acme-chat" },
        variant: "1",
        version: "1",
      },
      source: { repository: "https://huggingface.co/acme/chat-1", revision: "a".repeat(40) },
      format: { precision: "bf16", quantization: "none" },
      requires_token: false,
      dependencies: [],
      files: [
        {
          id: "weights",
          path: "model.safetensors",
          roles: ["weights"],
          sha256: digestOf("acme-chat-1/model.safetensors"),
          size_bytes: 10_000_000_000,
        },
      ],
    },
  };
  const entry = merge(base, overrides);
  const { publisher, slug } = entry.document.identity;
  entry.display.identity = { publisher, slug };
  entry.source_path = overrides.source_path ?? `models/${slug}.json`;
  entry.content_sha256 = overrides.content_sha256 ?? digestOf(`model:${publisher}/${slug}`);
  return entry;
}

const passRecord = (
  recipeDigest: string,
  modelDigests: string[],
  sparks: number,
): NonNullable<CatalogRecipeEntry["qualification"]["last_pass"]> => ({
  outcome: "passed",
  cause_code: "qualification.hardware_pass",
  cause_summary: "Hardware checks passed",
  tested_at: "2026-11-03T23:29:07.790267Z",
  evidence_refs: [digestOf(`evidence:${recipeDigest}`)],
  platform: {
    controller_source_sha: "c".repeat(40),
    hardware_class: "GB10",
    spark_count: sparks,
    topology: sparks === 1 ? "single" : "multi",
  },
  identity: {
    content_sha256: recipeDigest,
    model_digests: modelDigests,
    models_resolved: true,
    required_sparks: sparks,
    runtime_image: {
      build_key: digestOf(`build:${recipeDigest}`),
      image_digest: `sha256:${digestOf(`image:${recipeDigest}`)}`,
    },
    source_bundle_sha256: digestOf(`bundle:${recipeDigest}`),
  },
  quality_notes: [],
});

// One recipe: a Working single-Spark vLLM chat recipe that runs `model` (the default model when none
// is given) with a hardware pass on record. Digest, package path and the model reference follow the
// identity and the model unless a test states them.
export function makeRecipe(
  overrides: Overrides<CatalogRecipeEntry> = {},
  { model = makeModel() }: { model?: CatalogModelEntry } = {},
): CatalogRecipeEntry {
  const slug = overrides.document?.identity?.slug ?? "acme-chat-vllm-single";
  const publisher = overrides.document?.identity?.publisher ?? "vonk-forge";
  const base: CatalogRecipeEntry = {
    source_path: `recipes/${slug}.json`,
    content_sha256: "",
    source_bundle_sha256: digestOf(`bundle:${slug}`),
    api: null,
    display: {
      kind: "recipe-display",
      identity: { publisher, slug },
      title: "Acme Chat vLLM single Spark",
      description: "Serves Acme Chat with vLLM on one Spark.",
      tags: ["executable", "vllm", "single"],
      alignment: "unspecified",
    },
    document: {
      kind: "recipe",
      identity: { publisher, slug },
      release: { version: "1.0.0", released_at: "2026-11-03" },
      models: [],
      provenance: {
        source_reference: "https://github.com/NVIDIA/dgx-spark-playbooks/blob/main/chat",
        attribution: ["NVIDIA"],
      },
      runtime: {
        engine: "vllm",
        entrypoint: ["/opt/vonk/bin/vllm", "serve", "/models"],
        arguments: [{ name: "served-model-name", setting: null, value: "acme-chat" }],
        environment: [],
        lifecycle: { stop_timeout_seconds: 180 },
      },
      execution: {
        build: {
          base_image: { digest: digestOf("vllm"), repository: "docker.io/vllm/vllm-openai" },
          context: { path: `adapters/${slug}` },
          dockerfile: `adapters/${slug}/Dockerfile`,
          network: { hosts: [] },
          patches: [],
        },
      },
      interfaces: [
        {
          adapter: "openai",
          health_path: "/v1/models",
          model_aliases: ["acme-chat"],
          port: 8000,
        },
      ],
      settings: {
        kind: "generation",
        concurrency: null,
        max_batch_tokens: null,
        knobs: {},
        context_tokens: { change_effect: "restart", value: 131072 },
      },
      topology: {
        name: "solo",
        node_count: 1,
        parallelism: { backend: "local", data: 1, pipeline: 1, tensor: 1 },
        roles: [
          {
            name: "entrypoint",
            count: 1,
            endpoint_owner: true,
            resources: {
              disk: {
                artifact_bytes: 10_000_000_000,
                image_bytes: 20_000_000_000,
                safety_margin_bytes: 10_000_000_000,
                working_bytes: 10_000_000_000,
              },
              memory: { peak_bytes: 60_000_000_000, reserve_bytes: 8_000_000_000 },
            },
          },
        ],
        start_order: ["entrypoint"],
      },
      validation: {
        serving: {
          interface: "openai",
          checks: [
            {
              name: "health",
              kind: "openai.health",
              assertions: ["endpoint.healthy"],
              request: { body: null, method: "GET", path: "/v1/models", transport: "http" },
            },
          ],
        },
      },
    },
    package: {
      media_type: "application/vnd.vonk-forge.recipe-package.v2+tar+gzip",
      minimum_consumer_schema: 2,
      path: `packages/${slug}.tar.gz`,
      expected_bytes: 3000,
      sha256: digestOf(`package:${slug}`),
      recipe_content_sha256: "",
      source_bundle_sha256: digestOf(`bundle:${slug}`),
    },
    release: { version: "1.0.0", released_at: "2026-11-03" },
    qualification: { status: "Working", required_sparks: 1, changed: [] },
    prebuilt_image: {
      build_key: digestOf(`build:${slug}`),
      reference: `ghcr.io/example/${slug}@sha256:${digestOf(`image:${slug}`)}`,
    },
    served_capabilities: model.display.capabilities,
  };
  const entry = merge(base, overrides);
  const digest = overrides.content_sha256 ?? digestOf(`recipe:${publisher}/${slug}`);
  entry.content_sha256 = digest;
  entry.package.recipe_content_sha256 = digest;
  // Settings are one document of a kind, so a stated one replaces the default instead of merging.
  if (overrides.document?.settings)
    entry.document.settings = overrides.document
      .settings as CatalogRecipeEntry["document"]["settings"];
  if (!overrides.document?.models) {
    entry.document.models = [
      {
        id: "primary",
        model: {
          kind: "model",
          publisher: model.document.identity.publisher,
          slug: model.document.identity.slug,
          content_sha256: model.content_sha256,
        },
        files: model.document.files.map((file) => ({
          id: file.id,
          file_id: file.id,
          roles: ["entrypoint"],
          mount: { target: "/models" },
        })),
      },
    ];
  }
  if (entry.qualification.status === "Working" && !overrides.qualification?.last_pass) {
    entry.qualification.last_pass = passRecord(
      digest,
      [model.content_sha256],
      entry.qualification.required_sparks,
    );
  }
  return entry;
}

// The published chat API document of a recipe: the OpenAI-shaped endpoints with streaming, structured
// output and image and audio input.
export function makeChatApi(
  slug: string,
  publisher = "vonk-forge",
): NonNullable<CatalogRecipeEntry["api"]> {
  return {
    kind: "recipe-api",
    identity: { publisher, slug },
    option_choices: [],
    api: {
      mode: "chat",
      audio_output: false,
      default_output_tokens: { remaining: "context" },
      endpoints: ["/v1/chat/completions", "/v1/completions", "/v1/responses", "/v1/messages"],
      input_modalities: { audio: true, image: true, pdf: false, text: true, video: false },
      max_input_tokens: null,
      max_output_tokens: { setting: "context_tokens" },
      reasoning: { kind: "none" },
      streaming: true,
      structured_output: true,
      system_messages: true,
      tools: { kind: "none" },
    },
  };
}

// What a recipe that needs more Sparks than the test fleet has publishes: no hardware verdict.
export const notYetVerified = (sparks: number): CatalogRecipeEntry["qualification"] => ({
  status: "Not yet verified",
  reason: "needs more Sparks",
  required_sparks: sparks,
  changed: [],
});

export function makeCatalog(
  parts: {
    models?: CatalogModelEntry[];
    recipes?: CatalogRecipeEntry[];
    families?: CatalogIndex["families"];
  } & Overrides<Omit<CatalogIndex, "catalog_entities" | "recipes" | "families">> = {},
): CatalogIndex {
  const { models, recipes, families, ...envelope } = parts;
  const catalogModels = models ?? [makeModel()];
  return {
    ...merge<Omit<CatalogIndex, "catalog_entities" | "recipes" | "families">>(
      catalogEnvelope,
      envelope,
    ),
    families: families ?? [],
    catalog_entities: catalogModels,
    recipes: recipes ?? [makeRecipe({}, { model: catalogModels[0]! })],
  };
}
