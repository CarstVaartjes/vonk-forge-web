import type { Draft } from "../api/client";


const repair: Record<string, string> = {
  "source.dockerfile_present": "Upload the exact source bundle containing the declared Dockerfile.",
  "evidence.publisher_submitted_accepted": "Run the recipe locally through Vonk Forge and upload its complete test report.",
  "evidence.recipe_mismatch": "Retest the current canonical recipe hash.",
  "evidence.source_bundle_mismatch": "Retest the exact source bundle digest in this draft.",
};


export function ValidationReport({ draft }: { draft: Draft }) {
  const schemaProblems = draft.validation_problems.length > 0 ? (
    <section className="validation-panel failed" aria-live="polite">
      <h3>Recipe schema needs repair</h3>
      <ul className="validation-checks">
        {draft.validation_problems.map((problem) => (
          <li className="failed" key={`${problem.path}:${problem.rule}`}>
            <strong>Repair · {problem.path}</strong>
            <span>{problem.rule}: {problem.message}</span>
          </li>
        ))}
      </ul>
    </section>
  ) : null;
  if (!draft.validation) {
    return (
      <>
        {schemaProblems}
        <section className="validation-panel pending" aria-live="polite">
          <h3>Validation not complete</h3>
          <p>
            The worker will inspect the canonical source manifest, immutable artifact
            metadata, capacity envelopes, and publisher-submitted evidence. It will not execute the workload. Retry
            validation after repairing a terminal failure.
          </p>
        </section>
      </>
    );
  }
  return (
    <>
      {schemaProblems}
      <section className={`validation-panel ${draft.validation.status}`} aria-live="polite">
        <h3>Validation {draft.validation.status}</h3>
        <ul className="validation-checks">
          {draft.validation.checks.map((check) => (
            <li key={check.code} className={check.passed ? "passed" : "failed"}>
              <strong>{check.passed ? "Pass" : "Repair"} · {check.code}</strong>
              <span>{check.detail}</span>
              {!check.passed && repair[check.code] ? <span>{repair[check.code]}</span> : null}
            </li>
          ))}
        </ul>
        <p className="evidence-note">
          Local results are publisher-submitted evidence, not Vonk-certified execution.
        </p>
      </section>
    </>
  );
}
