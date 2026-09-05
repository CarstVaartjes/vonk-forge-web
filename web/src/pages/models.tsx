import { useEffect, useMemo, useState } from "react";

import { getModel, listModels, type ModelSummary, type ModelVersionSummary } from "../api/client";

function bytes(value?: number | null): string {
  if (!value) return "Not declared";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let amount = value;
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) { amount /= 1024; unit += 1; }
  return `${amount >= 10 || unit === 0 ? Math.round(amount) : amount.toFixed(1)} ${units[unit]}`;
}

function count(value?: number | null): string {
  if (!value) return "Not declared";
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function CapabilityFacts({ version }: { version: ModelVersionSummary }) {
  if (version.capability_evidence === "unknown") {
    return <p className="model-unknown"><span aria-hidden="true">?</span> Capability evidence not declared for this model version.</p>;
  }
  return <ul className="model-capability-facts" aria-label="Declared capabilities">{version.capabilities.map((fact) => <li key={fact.name}><strong>{fact.name}</strong><span className={`capability-${fact.support}`}>{fact.support}</span><small>{fact.evidence_status} evidence</small></li>)}</ul>;
}

function VersionRow({ version }: { version: ModelVersionSummary }) {
  return <article className="model-version" aria-labelledby={`version-${version.publisher}-${version.slug}`}>
    <div className="model-version-heading">
      <div><p className="eyebrow">Model version</p><h3 id={`version-${version.publisher}-${version.slug}`}>{version.title}</h3><code>{version.publisher}/{version.slug}</code></div>
      <span className={`model-availability availability-${version.availability ?? "unknown"}`}>{version.availability ?? "availability not declared"}</span>
    </div>
    <div className="model-fact-grid">
      <div><dt>Version</dt><dd>{version.version}</dd></div>
      <div><dt>Format</dt><dd>{[version.format?.container, version.format?.quantization].filter(Boolean).join(" · ") || "Not declared"}</dd></div>
      <div><dt>Weights</dt><dd>{bytes(version.sizes?.download_bytes)} download · {bytes(version.sizes?.installed_bytes)} installed</dd></div>
      <div><dt>Parameters</dt><dd>{count(version.parameters?.total)} total{version.parameters?.active ? ` · ${count(version.parameters.active)} active` : ""}</dd></div>
      <div><dt>Source</dt><dd>{version.source_repository ? <a href={version.source_repository}>Pinned source ↗</a> : "Not declared"}{version.source_revision ? <code>{version.source_revision}</code> : null}</dd></div>
      <div><dt>Recipes</dt><dd>{version.recipe_slugs.length ? <span className="model-recipe-links">{version.recipe_slugs.map((path) => <a key={path} href={`/recipes/${path}`}>{path.split("/").slice(1).join("/")}</a>)}</span> : "No public recipe"}</dd></div>
    </div>
    <div className="model-version-capabilities"><strong>Capabilities</strong><CapabilityFacts version={version} /></div>
    {version.license?.spdx ? <p className="model-license">License: <a href={version.license.url}>{version.license.spdx}</a>{version.license.operator_acceptance_required ? " · operator acceptance required" : ""}</p> : null}
  </article>;
}

export function ModelsPage() {
  const [models, setModels] = useState<ModelSummary[] | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    listModels(controller.signal).then((page) => setModels(page.items)).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, []);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (models ?? []).filter((model) => !needle || [model.title, model.publisher, model.slug, model.family, ...model.tags].join(" ").toLowerCase().includes(needle));
  }, [models, query]);
  useEffect(() => { document.title = "Models · Vonk Forge"; }, []);
  return <main className="models-page">
    <header className="page-intro models-intro"><div><p className="eyebrow">Public model index</p><h1>Models, with their exact versions.</h1></div><p>Start with a model family, then inspect the immutable weight variant and the recipes that bind it. Facts come from the published model-version authority; local cache and running state stay in your Controller.</p></header>
    <section className="model-index-tools" aria-label="Model index controls"><label htmlFor="model-search">Find a model</label><input id="model-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search family, publisher, or tag" /><span aria-live="polite">{models ? `${filtered.length} of ${models.length} models` : "Loading models…"}</span></section>
    {error ? <div className="status-panel error" role="alert"><h2>Models are temporarily unavailable.</h2><p>The public model index could not be loaded. Try again when the catalog source is reachable.</p></div> : null}
    {!models && !error ? <div className="status-panel" role="status">Loading immutable model index…</div> : null}
    {models && filtered.length === 0 ? <div className="status-panel"><h2>No matching models.</h2><p>Try a broader family, publisher, or tag.</p></div> : null}
    {models && filtered.length ? <div className="model-list">{filtered.map((model) => <article className="model-card" key={`${model.publisher}/${model.slug}`}><div className="model-card-heading"><div><p className="eyebrow">{model.family ? `Family · ${model.family}` : "Model"}</p><h2><a href={`/models/${model.publisher}/${model.slug}`}>{model.title}</a></h2><code>{model.publisher}/{model.slug}</code></div><span className="model-recipe-count">{model.recipe_count} {model.recipe_count === 1 ? "recipe" : "recipes"}</span></div><p>{model.description || "No description published."}</p><ul className="model-tags" aria-label="Model tags">{model.tags.slice(0, 6).map((tag) => <li key={tag}>{tag}</li>)}</ul><div className="model-card-footer"><span>{model.versions.length} {model.versions.length === 1 ? "version" : "versions"}</span><span>Immutable identity <code>{model.revision_id.slice(0, 12)}…</code></span><a className="text-link" href={`/models/${model.publisher}/${model.slug}`}>Inspect versions →</a></div></article>)}</div> : null}
  </main>;
}

export function ModelDetailPage({ publisher, slug }: { publisher: string; slug: string }) {
  const [model, setModel] = useState<ModelSummary | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => { const controller = new AbortController(); getModel(publisher, slug, controller.signal).then(setModel).catch(() => { if (!controller.signal.aborted) setError(true); }); return () => controller.abort(); }, [publisher, slug]);
  useEffect(() => { if (model) document.title = `${model.title} · Models · Vonk Forge`; }, [model]);
  if (error) return <main className="status-panel error"><h1>Model unavailable</h1><p>This model is not present in the published index.</p></main>;
  if (!model) return <main className="status-panel" role="status">Loading immutable model…</main>;
  return <main className="model-detail-page"><header className="page-intro"><p className="eyebrow">{model.family ? `Model family · ${model.family}` : "Model"}</p><h1>{model.title}</h1><p className="recipe-path">{model.publisher}/{model.slug} · immutable identity <code>{model.revision_id}</code></p><p>{model.description || "No description published."}</p></header><div className="model-detail-actions"><a className="button" href="/models">All models</a><a className="button secondary" href={`/recipes?model_family=${encodeURIComponent(model.title)}`}>Compare recipes</a></div><section className="model-detail-boundary"><div><h2>Versions and weight variants</h2><p>Each row is a published model-version identity. Download size, source revision, format, license, and capability evidence are shown only when declared by that version.</p></div><div className="model-version-list">{model.versions.map((version) => <VersionRow key={`${version.publisher}/${version.slug}`} version={version} />)}</div></section></main>;
}
