import { useEffect, useState } from "react";

import { CatalogProblem, type Draft, updateDraft } from "../api/client";
import { ValidationReport } from "../components/validation-report";


export function DraftEditor({
  draft,
  csrf,
  onChange,
}: {
  draft: Draft;
  csrf: string;
  onChange: (draft: Draft) => void;
}) {
  const [source, setSource] = useState(() => JSON.stringify(draft.recipe, null, 2));
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => setSource(JSON.stringify(draft.recipe, null, 2)), [draft]);

  async function save() {
    setMessage(null);
    try {
      const value = JSON.parse(source) as Record<string, unknown>;
      onChange(await updateDraft(draft, value, csrf));
      setMessage("Draft saved. Validation must be rerun for this version.");
    } catch (reason) {
      if (reason instanceof SyntaxError) setMessage("The editor does not contain valid JSON.");
      else if (reason instanceof CatalogProblem && reason.problem.code === "draft.version_conflict") setMessage("This draft changed elsewhere. Reload it before applying your edits.");
      else if (reason instanceof CatalogProblem) setMessage(`${reason.problem.code}: ${reason.problem.detail}`);
      else setMessage("The draft could not be saved.");
    }
  }

  return (
    <section className="draft-editor">
      <div className="editor-heading">
        <div><p className="eyebrow">Private draft v{draft.version}</p><h2>{String((draft.recipe.metadata as Record<string, unknown> | undefined)?.title ?? "Untitled recipe")}</h2></div>
        <span className="hash">sha256:{draft.content_sha256}</span>
      </div>
      <label className="json-editor">Recipe JSON<textarea value={source} onChange={(event) => setSource(event.target.value)} spellCheck={false} /></label>
      <button className="button" type="button" onClick={save}>Save corrections</button>
      {message ? <p role="status">{message}</p> : null}
      <ValidationReport draft={draft} />
    </section>
  );
}
