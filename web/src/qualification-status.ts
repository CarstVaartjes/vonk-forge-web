// The status vocabulary published by vonk-forge-recipes (contracts
// `PublishedQualificationStatusView.status`). The catalog index carries it per
// recipe as `qualification.status`; the site shows it exactly as published.
// `qualification-status.test.ts` fails when this list and the vendored contract
// schema in `src/contracts/` differ.
export const QUALIFICATION_STATUSES = [
  "Working",
  "Re-check: worked before",
  "Fix to verify",
  "Failed: recipe",
  "Not yet verified",
] as const;

export type QualificationStatus = (typeof QUALIFICATION_STATUSES)[number];

export function isQualificationStatus(value: unknown): value is QualificationStatus {
  return typeof value === "string" && (QUALIFICATION_STATUSES as readonly string[]).includes(value);
}
