import { expect, test } from "vitest";

import type { JobContract } from "./api/client";
import { jobRunCommand, optionRange } from "./job-recipe";

const slot = (id: string, extension: string, min: number) => ({ id, label: id, description: "", media_types: [], extensions: [extension], min_files: min, max_files: 2 });

test("the job command names this recipe's own required slots and every option at its default", () => {
  const job: JobContract = {
    inputs: [slot("prompt", ".txt", 1), slot("first-image", ".png", 0), slot("pair", ".glb", 2)],
    outputs: [],
    options: [{ key: "width", label: "Width", default: 960 }, { key: "mode", label: "Mode", default: "fast", allowed_values: ["fast", "slow"] }],
  };
  expect(jobRunCommand(job)).toBe("vonkctl job run ALIAS \\\n  --input prompt=prompt.txt \\\n  --input pair=pair-1.glb \\\n  --input pair=pair-2.glb \\\n  --option width=960 \\\n  --option mode=fast \\\n  --output results");
});

test("a recipe with no input slot still gets a command that parses", () => {
  expect(jobRunCommand({ inputs: [], outputs: [], options: [] })).toBe("vonkctl job run ALIAS \\\n  --output results");
});

test("option ranges read as the contract gives them", () => {
  expect(optionRange({ key: "k", label: "k", default: 1, minimum: 2, maximum: 51 })).toBe("2 to 51");
  expect(optionRange({ key: "k", label: "k", default: 1, allowed_values: [141, 245] })).toBe("one of 141, 245");
  expect(optionRange({ key: "k", label: "k", default: true })).toBe("");
});
