import { describe, expect, test } from "vitest";

import { capabilityLabel, isVerifiedStatus, statusMeaning, typeLabel, typesOf } from "./vocabulary";
import { vocabularyFixture as vocabulary } from "./vocabulary.fixture";


describe("the release vocabulary", () => {
  test("a capability maps to its published category, a model can be several types in vocabulary order, and an unknown capability is none", () => {
    for (const capability of vocabulary.capabilities) expect(typesOf(vocabulary, [capability.name])).toEqual([capability.category]);
    expect(typesOf(vocabulary, ["image-understanding", "chat"])).toEqual(["language", "vision"]);
    expect(typesOf(vocabulary, ["audio-generation", "video-generation"])).toEqual(["video", "audio"]);
    expect(typesOf(vocabulary, ["added-by-a-newer-minor"])).toEqual([]);
    expect(typesOf(vocabulary, [])).toEqual([]);
  });

  test("labels and meanings are the published ones, and a name the release does not know is shown as itself", () => {
    expect(capabilityLabel(vocabulary, "3d-generation")).toBe("3D generation");
    expect(capabilityLabel(vocabulary, "added-by-a-newer-minor")).toBe("added-by-a-newer-minor");
    expect(typeLabel(vocabulary, "3d")).toBe("3D");
    expect(typeLabel(vocabulary, "added-by-a-newer-minor")).toBe("added-by-a-newer-minor");
    expect(statusMeaning(vocabulary, "Working")).toBe(vocabulary.statuses.find((entry) => entry.status === "Working")!.meaning);
    expect(statusMeaning(vocabulary, "Status from a newer library")).toBeUndefined();
  });

  test("only a status the vocabulary marks verified counts as verified", () => {
    expect(isVerifiedStatus(vocabulary, "Working")).toBe(true);
    expect(isVerifiedStatus(vocabulary, "Re-check: worked before")).toBe(false);
    expect(isVerifiedStatus(vocabulary, "Status from a newer library")).toBe(false);
  });
});
