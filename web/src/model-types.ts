// The one place that maps model capabilities to the types a visitor picks from.
// The home tiles, the catalog type chips and the `type` URL parameter all read
// this list; a capability not listed here belongs to no type and is still found
// under "All".
export const MODEL_TYPES = [
  { id: "language", label: "Language", tile: "Language & chat", capabilities: ["chat", "text-generation", "text-understanding", "reasoning", "tool-use", "embeddings"] },
  { id: "code", label: "Code", tile: "Code", capabilities: ["code-generation"] },
  { id: "vision", label: "Vision", tile: "Vision", capabilities: ["image-understanding", "video-understanding", "ocr"] },
  { id: "image", label: "Image", tile: "Image", capabilities: ["image-generation", "image-editing"] },
  { id: "video", label: "Video", tile: "Video", capabilities: ["video-generation"] },
  { id: "audio", label: "Audio", tile: "Audio & music", capabilities: ["audio-generation", "audio-understanding"] },
  { id: "3d", label: "3D", tile: "3D", capabilities: ["3d-generation"] },
] as const;

export type ModelTypeId = typeof MODEL_TYPES[number]["id"];

const TYPE_IDS = new Set<string>(MODEL_TYPES.map((type) => type.id));

export function isModelTypeId(value: string): value is ModelTypeId {
  return TYPE_IDS.has(value);
}

export function modelTypeLabel(id: ModelTypeId): string {
  return MODEL_TYPES.find((type) => type.id === id)!.label;
}

// A model can be several types (a vision-language model is Language and Vision).
export function hasModelType(capabilities: readonly string[], id: ModelTypeId): boolean {
  const type = MODEL_TYPES.find((candidate) => candidate.id === id)!;
  return type.capabilities.some((capability) => capabilities.includes(capability));
}

export function modelTypesOf(capabilities: readonly string[]): ModelTypeId[] {
  return MODEL_TYPES.filter((type) => hasModelType(capabilities, type.id)).map((type) => type.id);
}
