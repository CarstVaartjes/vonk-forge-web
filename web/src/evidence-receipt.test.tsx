import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import type { ReceiptFacts } from "./catalog-stats";
import { EvidenceReceipt, evidenceLine } from "./evidence-receipt";

const facts: ReceiptFacts = {
  title: "Acme Coder two Sparks", creator: "Acme", status: "Working", tested: "2026-11-12T10:00:00Z", sparks: 2, hardwareClass: "GB10",
  measuredBytes: 119_400_000_000, contentSha256: "ab".repeat(32), imageDigest: `sha256:${"cd".repeat(32)}`, evidenceRef: "ef".repeat(32),
};

test("shows the sentence and every field the pass carries", () => {
  render(<EvidenceReceipt facts={facts} verified />);
  expect(screen.getByText("Passed hardware checks on 2 DGX Sparks, 12 Nov 2026.")).toBeVisible();
  expect(screen.getByText("GB10 · 2 Sparks")).toBeVisible();
  expect(screen.getByText("111.2 GiB per Spark, measured")).toBeVisible();
  expect(screen.getByText(`sha256:${"ab".repeat(32)}`)).toBeVisible();
  expect(screen.getByText("Runtime image")).toBeVisible();
  expect(screen.getByText("Evidence record")).toBeVisible();
});

test("leaves out what the catalog does not carry and never says measured without a measurement", () => {
  render(<EvidenceReceipt facts={{ ...facts, hardwareClass: null, measuredBytes: null, imageDigest: null, evidenceRef: null, sparks: null }} verified={false} />);
  expect(screen.getByText("Passed hardware checks, 12 Nov 2026.")).toBeVisible();
  for (const name of ["Hardware", "Memory peak", "Runtime image", "Evidence record"]) expect(screen.queryByText(name)).toBeNull();
  expect(document.body.textContent).not.toContain("measured");
});

test("one Spark reads in the singular", () => {
  expect(evidenceLine({ sparks: 1, tested: "2026-11-12T10:00:00Z" })).toBe("Passed hardware checks on 1 DGX Spark, 12 Nov 2026.");
});
