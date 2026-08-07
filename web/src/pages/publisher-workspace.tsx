import { useEffect, useMemo, useState } from "react";

import {
  CatalogProblem,
  forkRevision,
  getDrafts,
  getMe,
  getPublishers,
  publishDraft,
  uploadDraft,
  validateDraft,
  type Draft,
  type Me,
  type PublisherMembership,
} from "../api/client";
import { DraftEditor } from "./draft-editor";
import { SignInPage } from "./sign-in";


function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

export function PublisherWorkspacePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [publishers, setPublishers] = useState<PublisherMembership[]>([]);
  const [publisher, setPublisher] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [forkSlug, setForkSlug] = useState("");
  const forkSource = new URLSearchParams(window.location.search).get("fork_revision");

  async function refreshDrafts(namespace = publisher) {
    if (!namespace) return;
    const loaded = await getDrafts(namespace);
    setDrafts(loaded);
    setSelected((current) => current && loaded.some((draft) => draft.id === current) ? current : (loaded[0]?.id ?? null));
  }

  useEffect(() => {
    getMe()
      .then(async (identity) => {
        setMe(identity);
        const memberships = await getPublishers();
        setPublishers(memberships);
        const first = memberships.find((item) => item.role !== "viewer")?.slug ?? "";
        setPublisher(first);
        if (first) await refreshDrafts(first);
      })
      .catch((reason: unknown) => {
        if (reason instanceof CatalogProblem && reason.problem.code === "auth.required") setSignedOut(true);
        else setMessage("The publisher workspace could not be loaded.");
      });
  }, []);

  const draft = useMemo(() => drafts.find((item) => item.id === selected) ?? null, [drafts, selected]);
  if (signedOut) return <SignInPage />;
  if (!me) return <main className="status-panel" role="status">Opening your publisher workspace…{message}</main>;

  async function choose(namespace: string) {
    setPublisher(namespace);
    setConfirmed(false);
    await refreshDrafts(namespace);
  }

  async function upload(file: File | undefined) {
    if (!file || !me) return;
    setMessage(null);
    try {
      const parsed = JSON.parse(await file.text()) as Record<string, unknown>;
      const envelope = "recipe" in parsed ? parsed : { recipe: parsed };
      const created = await uploadDraft(publisher, envelope, me.csrf_token, crypto.randomUUID());
      setDrafts((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setSelected(created.id);
      setMessage("Private draft uploaded. No container or model bytes were sent.");
    } catch (reason) {
      setMessage(reason instanceof CatalogProblem ? `${reason.problem.code}: ${reason.problem.detail}` : "Choose a valid Vonk Forge JSON export.");
    }
  }

  async function requestValidation() {
    if (!draft || !me) return;
    try {
      const job = await validateDraft(draft, me.csrf_token);
      setDrafts((current) => current.map((item) => item.id === draft.id ? { ...item, state: "validating", validation: null } : item));
      setMessage(`Validation queued as ${job.job_id}. Refresh to inspect the completed report.`);
    } catch (reason) {
      setMessage(reason instanceof CatalogProblem ? `${reason.problem.code}: ${reason.problem.detail}` : "Validation could not be queued. Retry after checking service status.");
    }
  }

  async function publish() {
    if (!draft || !confirmed || !me) return;
    try {
      const result = await publishDraft(draft, me.csrf_token, crypto.randomUUID());
      setMessage(`Published immutable revision ${result.revision_number} at sha256:${result.content_sha256}.`);
      setConfirmed(false);
      await refreshDrafts();
    } catch (reason) {
      setMessage(reason instanceof CatalogProblem ? `${reason.problem.code}: ${reason.problem.detail}` : "Publication failed.");
    }
  }

  async function fork() {
    if (!forkSource || !forkSlug || !me) return;
    try {
      const created = await forkRevision(publisher, forkSource, forkSlug, me.csrf_token);
      setMessage(`Fork created as private draft ${created.draft_id}; it needs its own validation.`);
      await refreshDrafts();
    } catch (reason) {
      setMessage(reason instanceof CatalogProblem ? `${reason.problem.code}: ${reason.problem.detail}` : "The private fork could not be created.");
    }
  }

  const identity = record(draft?.recipe.identity);
  const runtime = record(draft?.recipe.runtime);
  return (
    <main className="workspace-page">
      <header className="page-intro"><p className="eyebrow">Local-first publishing</p><h1>Publisher workspace</h1><p>Build and test in your local Vonk Forge, push the digest-pinned image to your public registry, then upload only recipe metadata and evidence here.</p></header>
      <ol className="publish-flow"><li>Build locally</li><li>Test on your Sparks</li><li>Push image digest</li><li>Upload private draft</li><li>Validate metadata</li><li>Publish explicitly</li></ol>
      <section className="workspace-toolbar">
        <label>Publisher namespace<select value={publisher} onChange={(event) => choose(event.target.value)}>{publishers.filter((item) => item.role !== "viewer").map((item) => <option key={item.id} value={item.slug}>{item.name} ({item.slug})</option>)}</select></label>
        <label className="file-button">Upload local JSON<input type="file" accept="application/json,.json" onChange={(event) => upload(event.target.files?.[0])} /></label>
        <button className="button" type="button" onClick={() => refreshDrafts()}>Refresh reports</button>
      </section>
      {forkSource ? <section className="fork-panel"><h2>Fork immutable revision</h2><input aria-label="New recipe slug" value={forkSlug} onChange={(event) => setForkSlug(event.target.value)} placeholder="my-recipe" /><button className="button" onClick={fork}>Create private fork</button></section> : null}
      {message ? <div className="status-panel" role="status">{message}</div> : null}
      <div className="workspace-layout">
        <aside aria-label="Private drafts"><h2>Drafts</h2>{drafts.map((item) => <button type="button" className={item.id === selected ? "draft-link active" : "draft-link"} key={item.id} onClick={() => { setSelected(item.id); setConfirmed(false); }}>{String(record(item.recipe.metadata).title ?? item.id)}<span>v{item.version} · {item.state}</span></button>)}</aside>
        <div>{draft ? <><DraftEditor draft={draft} csrf={me.csrf_token} onChange={(changed) => setDrafts((current) => current.map((item) => item.id === changed.id ? changed : item))} /><section className="publish-confirm"><h2>Publish immutable revision</h2><dl><div><dt>Publisher</dt><dd>{publisher}</dd></div><div><dt>Recipe</dt><dd>{String(identity.slug ?? "")}</dd></div><div><dt>Image</dt><dd>{String(runtime.image ?? "")}</dd></div><div><dt>Content hash</dt><dd>sha256:{draft.content_sha256}</dd></div><div><dt>Visibility</dt><dd>Public and immutable</dd></div></dl><label><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> I confirm these exact public identifiers.</label><div className="hero-actions"><button className="button" type="button" onClick={requestValidation}>Validate this version</button><button className="button primary" type="button" disabled={!confirmed || draft.validation?.status !== "passed"} onClick={publish}>Publish publicly</button></div></section></> : <div className="status-panel">Upload a local recipe export to begin.</div>}</div>
      </div>
    </main>
  );
}
