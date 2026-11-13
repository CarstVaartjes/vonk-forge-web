import { gibLabel } from "./catalog-filters";
import type { ReceiptFacts } from "./catalog-stats";

// When the library recorded no Spark count, the line says only when the recipe passed.
export function evidenceLine({ sparks, tested }: Pick<ReceiptFacts, "sparks" | "tested">): string {
  const date = dateLabel(tested);
  return sparks === null ? `Passed hardware checks, ${date}.` : `Passed hardware checks on ${sparks} DGX Spark${sparks === 1 ? "" : "s"}, ${date}.`;
}

function dateLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

// The ticket for one hardware pass: the status, the evidence sentence and the fields the catalog
// holds for that pass. A field the release does not carry is left out, never filled in.
export function EvidenceReceipt({ facts, verified }: { facts: ReceiptFacts; verified: boolean }) {
  const rows: Array<{ name: string; value: string; mono?: boolean }> = [{ name: "Result", value: evidenceLine(facts) }];
  if (facts.hardwareClass) rows.push({ name: "Hardware", value: facts.sparks === null ? facts.hardwareClass : `${facts.hardwareClass} · ${facts.sparks} Spark${facts.sparks === 1 ? "" : "s"}` });
  if (facts.measuredBytes !== null) rows.push({ name: "Memory peak", value: `${gibLabel(facts.measuredBytes, 1)} per Spark, measured` });
  rows.push({ name: "Recipe", value: `sha256:${facts.contentSha256}`, mono: true });
  if (facts.imageDigest) rows.push({ name: "Runtime image", value: facts.imageDigest, mono: true });
  if (facts.evidenceRef) rows.push({ name: "Evidence record", value: facts.evidenceRef, mono: true });
  return (
    <section className="card receipt" aria-label="Hardware evidence">
      <div className="receipt-top">
        <span className="receipt-label">Hardware evidence</span>
        <span className={`status ${verified ? "ok" : "warn"}`}>{facts.status}</span>
      </div>
      <h3>{facts.title}</h3>
      {facts.creator ? <p className="receipt-by">Recipe by <span className="src">{facts.creator}</span></p> : null}
      <dl>
        {rows.map(({ name, value, mono }) => (
          <div key={name}><dt>{name}</dt><dd className={mono ? "mono" : undefined} title={mono ? value : undefined}>{value}</dd></div>
        ))}
      </dl>
    </section>
  );
}
