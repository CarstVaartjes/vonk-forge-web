import { formatDate } from "./dates";
import { gibLabel } from "./catalog-filters";
import type { ReceiptFacts } from "./catalog-stats";

// The one lead line of a pass. Without a Spark count it says only that the recipe passed; the
// measured memory joins it only when the library recorded a measurement.
export function evidenceLine({ sparks, measuredBytes }: Pick<ReceiptFacts, "sparks" | "measuredBytes">): string {
  const passed = sparks === null ? "Passed hardware checks" : `Passed on ${sparks} Spark${sparks === 1 ? "" : "s"}`;
  return measuredBytes === null ? passed : `${passed} · ${gibLabel(measuredBytes, 1)} per Spark, measured`;
}

// The ticket for one hardware pass: the status, one lead line, the creator and the fields the
// catalog holds for that pass. With `meaning` (the vocabulary's words for the status) a "What this means"
// disclosure opens inline. The three hashes sit behind "Details". A field the release does not
// carry is left out, never filled in. `showTitle` is off where the page already names the recipe.
export function EvidenceReceipt({ facts, verified, showTitle = true, meaning }: { facts: ReceiptFacts; verified: boolean; showTitle?: boolean; meaning?: string }) {
  const rows: Array<{ name: string; value: string; mono?: boolean }> = [];
  if (facts.hardwareClass) rows.push({ name: "Hardware", value: facts.hardwareClass });
  rows.push({ name: "Tested", value: formatDate(facts.tested) });
  const hashes: typeof rows = [{ name: "Recipe", value: `sha256:${facts.contentSha256}`, mono: true }];
  if (facts.imageDigest) hashes.push({ name: "Runtime image", value: facts.imageDigest, mono: true });
  if (facts.evidenceRef) hashes.push({ name: "Evidence record", value: facts.evidenceRef, mono: true });
  const list = (items: typeof rows) => (
    <dl>
      {items.map(({ name, value, mono }) => (
        <div key={name}><dt>{name}</dt><dd className={mono ? "mono" : undefined} title={mono ? value : undefined}>{value}</dd></div>
      ))}
    </dl>
  );
  return (
    <section className="card receipt" aria-label="Hardware evidence">
      <div className="receipt-top">
        <span className="receipt-label">Hardware evidence</span>
        <span className={`status ${verified ? "ok" : "warn"}`}>{facts.status}</span>
      </div>
      {showTitle ? <h3>{facts.title}</h3> : null}
      <p className="receipt-lead">{evidenceLine(facts)}</p>
      {facts.creator ? <p className="receipt-by">Recipe by <span className="src">{facts.creator}</span></p> : null}
      {list(rows)}
      {meaning ? <details className="receipt-details"><summary>What this means</summary><p className="receipt-meaning">{meaning}</p></details> : null}
      <details className="receipt-details">
        <summary>Details</summary>
        {list(hashes)}
      </details>
    </section>
  );
}
