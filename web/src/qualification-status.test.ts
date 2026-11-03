import { describe, expect, test } from "vitest";
import schema from "./contracts/published-qualification-status-v1.schema.json";
import { QUALIFICATION_STATUSES, isQualificationStatus } from "./qualification-status";

describe("published qualification status vocabulary", () => {
  test("matches the vendored contract schema enum exactly", () => {
    expect([...QUALIFICATION_STATUSES]).toEqual(schema.properties.status.enum);
  });

  test("accepts only published statuses", () => {
    for (const status of schema.properties.status.enum) expect(isQualificationStatus(status)).toBe(true);
    for (const value of ["candidate", "cataloged", "Untested", "working", "", undefined, 1]) expect(isQualificationStatus(value)).toBe(false);
  });
});
