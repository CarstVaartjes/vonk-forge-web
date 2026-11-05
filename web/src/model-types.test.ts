import { describe, expect, test } from "vitest";

import { CAPABILITY_OPTIONS } from "./catalog-filters";
import { MODEL_TYPES, hasModelType, isModelTypeId, modelTypesOf } from "./model-types";


describe("model types", () => {
  test("maps capabilities to types in one place; a model can be several types", () => {
    expect(modelTypesOf(["chat", "image-understanding"])).toEqual(["language", "vision"]);
    expect(modelTypesOf(["code-generation"])).toEqual(["code"]);
    expect(modelTypesOf(["audio-generation", "video-generation"])).toEqual(["video", "audio"]);
    expect(modelTypesOf(["3d-generation"])).toEqual(["3d"]);
    expect(modelTypesOf([])).toEqual([]);
    expect(modelTypesOf(["motion-generation"])).toEqual([]);
    expect(hasModelType(["image-editing"], "image")).toBe(true);
  });

  test("only maps capabilities the catalog filters know, each to a type", () => {
    const known = new Set<string>(CAPABILITY_OPTIONS.map((option) => option.value));
    for (const type of MODEL_TYPES) for (const capability of type.capabilities) expect(known.has(capability)).toBe(true);
    const mapped = new Set<string>(MODEL_TYPES.flatMap((type) => [...type.capabilities]));
    expect([...known].filter((capability) => !mapped.has(capability))).toEqual([]);
  });

  test("validates type ids from the URL", () => {
    expect(isModelTypeId("code")).toBe(true);
    expect(isModelTypeId("everything")).toBe(false);
  });
});
