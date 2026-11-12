import { describe, expect, test } from "vitest";

import { capabilityLabel, isVerifiedStatus, statusMeaning, typeLabel, typesOf } from "./vocabulary";
import { vocabularyFixture as vocabulary } from "./vocabulary.fixture";


describe("the release vocabulary", () => {
  test("every capability the release publishes is reachable through a model type, and the retired names are gone", () => {
    const types = new Set(vocabulary.categories.map((category) => category.id));
    expect(vocabulary.capabilities).toHaveLength(26);
    for (const capability of vocabulary.capabilities) expect(typesOf(vocabulary, [capability.name])).toEqual([capability.category]);
    expect(vocabulary.capabilities.every((capability) => types.has(capability.category))).toBe(true);
    const names = vocabulary.capabilities.map((capability) => capability.name);
    expect(names).not.toContain("embeddings");
    expect(names).not.toContain("text-understanding");
  });

  test("a model can be several types, in the vocabulary's order, and an unknown capability is none", () => {
    expect(typesOf(vocabulary, ["image-understanding", "chat"])).toEqual(["language", "vision"]);
    expect(typesOf(vocabulary, ["audio-generation", "video-generation"])).toEqual(["video", "audio"]);
    expect(typesOf(vocabulary, ["decision"])).toEqual(["other"]);
    expect(typesOf(vocabulary, ["added-by-a-newer-minor"])).toEqual([]);
    expect(typesOf(vocabulary, [])).toEqual([]);
  });

  test("labels and meanings are the published ones, and a name the release does not know is shown as itself", () => {
    expect(capabilityLabel(vocabulary, "3d-generation")).toBe("3D generation");
    expect(capabilityLabel(vocabulary, "added-by-a-newer-minor")).toBe("added-by-a-newer-minor");
    expect(typeLabel(vocabulary, "3d")).toBe("3D");
    expect(statusMeaning(vocabulary, "Working")).toBe("Passed on a real DGX Spark for this exact recipe, runtime image and model.");
    expect(statusMeaning(vocabulary, "Status from a newer library")).toBeUndefined();
  });

  test("only the statuses the vocabulary marks verified count as verified", () => {
    expect(vocabulary.statuses.filter((entry) => entry.verified).map((entry) => entry.status)).toEqual(["Working"]);
    expect(isVerifiedStatus(vocabulary, "Working")).toBe(true);
    expect(isVerifiedStatus(vocabulary, "Re-check: worked before")).toBe(false);
    expect(isVerifiedStatus(vocabulary, "Status from a newer library")).toBe(false);
  });
});
