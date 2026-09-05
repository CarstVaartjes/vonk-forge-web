import { useEffect, useMemo, useState } from "react";

import { getModel, listModels, type ModelSummary, type ModelVersionSummary } from "../api/client";

const PAGE_SIZE = 12;
const CAPABILITY_OPTIONS = ["chat", "text-generation", "text-understanding", "reasoning", "tool-use", "code-generation", "ocr", "image-generation", "image-understanding", "image-editing", "video-generation", "video-understanding", "audio-generation", "audio-understanding", "embeddings", "3d-generation"];

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

function modelCapabilities(model: ModelSummary): string[] {
  return Array.from(new Set(model.versions.flatMap((version) => version.capabilities.filter((fact) => fact.support === "supported").map((fact) => fact.name))));
}

function filterLabel(value: string): string {
  return value.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function accessLabel(version?: ModelVersionSummary): string {
  if (!version?.access) return "Access not declared";
  if (version.access.gated) return "Gated access";
  if (version.access.visibility === "public") return "Public access";
  return version.access.visibility ? `${filterLabel(version.access.visibility)} access` : "Access not declared";
}

function CapabilityFacts({ version }: { version: ModelVersionSummary }) {
  if (version.capability_evidence === "unknown") {
    return <p className="model-unknown"><span aria-hidden="true">?</span> Capability evidence not declared for this model version.</p>;
  }
  return <ul className="model-capability-facts" aria-label="Declared capabilities">{version.capabilities.map((fact) => <li key={fact.name}><strong>{fact.name}</strong><span className={`capability-${fact.support}`}>{fact.support}</span><small>{fact.evidence_status} evidence</small></li>)}</ul>;
}

export function PublicCatalogExplainer() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (window.location.hash === "#model-recipe-explainer") setOpen(true);
  }, []);
  return <details id="model-recipe-explainer" className="public-contract-explainer" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary>How a model becomes a local run</summary>
    <div className="public-contract-content" aria-labelledby="public-contract-heading">
      <header className="public-contract-heading">
        <h2 id="public-contract-heading">A model is the AI. A recipe is how you run it.</h2>
        <p>The catalog shows published details. Your Controller uses them when you choose a local run.</p>
      </header>
      <div className="model-recipe-relationship" aria-label="One model can have several recipes">
      <article className="explainer-entity explainer-model">
        <h3>Model</h3>
        <p className="explainer-label">Example · Illustrative text model</p>
        <p>One exact release: the weights and files it points to, plus what it can do.</p>
        <ul className="explainer-fields" aria-label="Model details">
          <li><strong>Family</strong><span>related models</span></li>
          <li><strong>Version</strong><span>one specific release</span></li>
          <li><strong>Variant</strong><span>a different format or precision</span></li>
        </ul>
      </article>
      <div className="relationship-join" aria-hidden="true"><span>same<br />model</span></div>
      <div className="recipe-options">
        <article className="explainer-entity explainer-recipe">
          <h3>One way to run it</h3>
          <p className="explainer-label">Recipe A · one Spark</p>
          <p>The same model, with one engine, Spark choice, and set of settings.</p>
          <p className="explainer-fields-inline"><span>engine</span><span>Sparks</span><span>settings</span></p>
        </article>
        <article className="explainer-entity explainer-recipe">
          <h3>Another way to run it</h3>
          <p className="explainer-label">Recipe B · two Sparks</p>
          <p>Same model again, with a different engine or number of Sparks.</p>
          <p className="explainer-fields-inline"><span>engine</span><span>Sparks</span><span>settings</span></p>
        </article>
      </div>
      </div>
      <p className="relationship-caption">One exact model can have several recipes. The recipe changes how the model runs; it does not change the model files.</p>
      <section className="controller-handoff" aria-labelledby="controller-handoff-heading">
        <header>
          <h3 id="controller-handoff-heading">Download once. Reuse across your Sparks.</h3>
          <p>Published model and recipe details travel to your Controller. The work of preparing a run stays on your side of the boundary.</p>
        </header>
        <div className="handoff-map">
          <div className="handoff-public">
            <strong>Published catalog</strong>
            <p>Model details, recipes, and the download sources they point to.</p>
          </div>
          <div className="handoff-arrow" aria-hidden="true"><span>choose a run</span></div>
          <div className="handoff-local">
            <strong>Your Controller</strong>
            <p>Run downloads or builds missing assets with visible progress. It caches model files and the runtime container separately on your NAS or Controller storage, reuses cached assets when you switch, copies verified assets to selected Sparks, then starts the application.</p>
            <div className="handoff-inputs" aria-label="Local Controller inputs">
              <span><strong>Model files</strong><small>download sources</small></span>
              <span><strong>Runtime container</strong><small>the software that runs the model</small></span>
            </div>
            <ol aria-label="Local Controller run sequence">
              <li>download or build</li>
              <li>local cache</li>
              <li>selected Sparks</li>
              <li>application run</li>
            </ol>
          </div>
        </div>
        <p className="private-boundary"><strong>Private by design:</strong> view downloads, running models, and Spark status in your private Controller.</p>
        <p className="profile-note">Profiles save your model and recipe choices plus Spark assignments, including idle Sparks.</p>
      </section>
    </div>
  </details>;
}

function VersionRow({ version }: { version: ModelVersionSummary }) {
  return <article className="model-version" aria-labelledby={`version-${version.publisher}-${version.slug}`}>
    <div className="model-version-heading">
      <div><p className="eyebrow">Model version</p><h3 id={`version-${version.publisher}-${version.slug}`}>{version.title}</h3><code>{version.publisher}/{version.slug}</code></div>
      <span className={`model-availability availability-${version.availability ?? "unknown"}`}>{version.availability ?? "availability not declared"}</span>
    </div>
    <dl className="model-fact-grid">
      <div><dt>Identity</dt><dd><code>{version.revision_id}</code></dd></div>
      <div><dt>Version</dt><dd>{version.version}</dd></div>
      <div><dt>Variant</dt><dd>{version.variant || "Not declared"}</dd></div>
      <div><dt>Access</dt><dd>{accessLabel(version)}</dd></div>
      <div><dt>Format</dt><dd>{[version.format?.container, version.format?.quantization].filter(Boolean).join(" · ") || "Not declared"}</dd></div>
      <div><dt>Weights</dt><dd>{bytes(version.sizes?.download_bytes)} download · {bytes(version.sizes?.installed_bytes)} installed</dd></div>
      <div><dt>Parameters</dt><dd>{count(version.parameters?.total)} total{version.parameters?.active ? ` · ${count(version.parameters.active)} active` : ""}</dd></div>
      <div><dt>Source</dt><dd>{version.source_repository ? <a href={version.source_repository}>Pinned source ↗</a> : "Not declared"}{version.source_revision ? <code>{version.source_revision}</code> : null}</dd></div>
      <div><dt>Recipes</dt><dd>{version.recipe_slugs.length ? <span className="model-recipe-links">{version.recipe_slugs.map((path) => <a key={path} href={`/recipes?q=${encodeURIComponent(path)}`}>{path}</a>)}</span> : "No public recipe"}</dd></div>
    </dl>
    <div className="model-version-capabilities"><strong>Capabilities</strong><CapabilityFacts version={version} /></div>
    {version.license?.spdx ? <p className="model-license">License: <a href={version.license.url}>{version.license.spdx}</a>{version.license.operator_acceptance_required ? " · operator acceptance required" : ""}</p> : null}
  </article>;
}

function initialFilters() {
  const params = new URLSearchParams(window.location.search);
  return { query: params.get("q") ?? "", publisher: params.get("publisher") ?? "", capability: params.get("capability") ?? "", recipes: params.get("recipes") ?? "", sort: params.get("sort") ?? "name", page: Math.max(1, Number(params.get("page")) || 1) };
}

export function ModelsPage() {
  const [models, setModels] = useState<ModelSummary[] | null>(null);
  const [filters, setFilters] = useState(initialFilters);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    listModels(controller.signal).then((page) => setModels(page.items)).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [attempt]);
  const publishers = useMemo(() => Array.from(new Set((models ?? []).map((model) => model.publisher))).sort(), [models]);
  const filtered = useMemo(() => {
    const needle = filters.query.trim().toLowerCase();
    const result = (models ?? []).filter((model) => {
      const capabilities = modelCapabilities(model);
      const matchesText = !needle || [model.title, model.publisher, model.slug, model.family, ...model.tags].join(" ").toLowerCase().includes(needle);
      const matchesRecipes = !filters.recipes || filters.recipes === "all" || (filters.recipes === "recipes" ? model.recipe_count > 0 : model.recipe_count === 0);
      return matchesText && (!filters.publisher || model.publisher === filters.publisher) && (!filters.capability || capabilities.includes(filters.capability)) && matchesRecipes;
    });
    return result.sort((left, right) => filters.sort === "recipes" ? right.recipe_count - left.recipe_count || left.title.localeCompare(right.title, undefined, { numeric: true }) : filters.sort === "versions" ? right.versions.length - left.versions.length || left.title.localeCompare(right.title, undefined, { numeric: true }) : left.title.localeCompare(right.title, undefined, { numeric: true }));
  }, [filters, models]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  function updateFilters(next: Partial<typeof filters>) {
    const updated = { ...filters, ...next, page: next.page ?? 1 };
    setFilters(updated);
    const params = new URLSearchParams();
    if (updated.query) params.set("q", updated.query);
    if (updated.publisher) params.set("publisher", updated.publisher);
    if (updated.capability) params.set("capability", updated.capability);
    if (updated.recipes) params.set("recipes", updated.recipes);
    if (updated.sort !== "name") params.set("sort", updated.sort);
    if (updated.page > 1) params.set("page", String(updated.page));
    window.history.replaceState({}, "", `/models${params.toString() ? `?${params}` : ""}`);
  }
  function clearFilters() { updateFilters({ query: "", publisher: "", capability: "", recipes: "", sort: "name" }); }
  useEffect(() => { document.title = "Models · Vonk Forge"; }, []);
  return <main className="models-page">
    <header className="page-intro models-intro"><div><p className="eyebrow">Public model index</p><h1>Models, with their exact versions.</h1></div><p>Start with a model, then inspect its exact versions and variants and the recipes that bind them. Details come from the published catalog; local cache and running state stay in your Controller.</p></header>
    <section className="model-index-tools" aria-label="Model index controls"><label htmlFor="model-search">Find a model</label><input id="model-search" type="search" value={filters.query} onChange={(event) => updateFilters({ query: event.target.value })} placeholder="Search model, family, publisher, or tag" /><label htmlFor="model-publisher">Publisher</label><select id="model-publisher" value={filters.publisher} onChange={(event) => updateFilters({ publisher: event.target.value })}><option value="">All publishers</option>{publishers.map((publisher) => <option key={publisher} value={publisher}>{publisher}</option>)}</select><label htmlFor="model-capability">Capability</label><select id="model-capability" value={filters.capability} onChange={(event) => updateFilters({ capability: event.target.value })}><option value="">All declared capabilities</option>{CAPABILITY_OPTIONS.map((capability) => <option key={capability} value={capability}>{filterLabel(capability)}</option>)}</select><label htmlFor="model-recipes">Recipe support</label><select id="model-recipes" value={filters.recipes} onChange={(event) => updateFilters({ recipes: event.target.value })}><option value="">All models</option><option value="recipes">Has public recipes</option><option value="none">No public recipes</option></select><label htmlFor="model-sort">Sort</label><select id="model-sort" value={filters.sort} onChange={(event) => updateFilters({ sort: event.target.value })}><option value="name">Name</option><option value="versions">Most versions</option><option value="recipes">Most recipes</option></select><span aria-live="polite">{models ? `${filtered.length} of ${models.length} models` : "Loading models…"}</span>{(filters.query || filters.publisher || filters.capability || filters.recipes || filters.sort !== "name") ? <button className="text-button" type="button" onClick={clearFilters}>Clear filters</button> : null}</section>
    <PublicCatalogExplainer />
    {error ? <div className="status-panel error" role="alert"><h2>Models are temporarily unavailable.</h2><p>The public model index could not be loaded. Try again when the catalog source is reachable.</p><button className="button" type="button" onClick={() => { setModels(null); setAttempt((value) => value + 1); }}>Retry</button></div> : null}
    {!models && !error ? <div className="status-panel" role="status">Loading immutable model index…</div> : null}
    {models && filtered.length === 0 ? <div className="status-panel"><h2>No matching models.</h2><p>Try a broader family, publisher, or capability.</p><button className="button" type="button" onClick={clearFilters}>Show all models</button></div> : null}
    {models && visible.length ? <ul className="model-list" aria-label="Models">{visible.map((model) => { const capabilities = modelCapabilities(model); const version = model.versions[0]; const key = `${model.publisher}/${model.slug}`; return <li key={key}><a className="model-row" href={`/models/${model.publisher}/${model.slug}`}><span className="model-row-main"><span className="eyebrow">{model.family ? `Family · ${model.family}` : "Model"}</span><strong>{model.title}</strong><code>{model.publisher}/{model.slug}</code></span><span className="model-row-facts">{version ? <><span><small>Version</small>{version.version}</span><span><small>Variant</small>{version.variant || "Not declared"}</span><span><small>Access</small>{accessLabel(version)}</span></> : null}</span><span className="model-row-capabilities" aria-label="Declared capabilities">{capabilities.slice(0, 3).map((capability) => <span key={capability}>{filterLabel(capability)}</span>)}{!capabilities.length ? <span>Capability evidence unknown</span> : null}</span><span className="model-row-action"><span>{model.recipe_count} {model.recipe_count === 1 ? "recipe" : "recipes"}</span><span className="button primary">View versions</span></span></a></li>; })}</ul> : null}
    {models && filtered.length > PAGE_SIZE ? <nav className="model-pagination" aria-label="Model pages"><button className="button" type="button" disabled={page <= 1} onClick={() => updateFilters({ page: page - 1 })}>Previous</button><span aria-live="polite">Page {page} of {pageCount}</span><button className="button" type="button" disabled={page >= pageCount} onClick={() => updateFilters({ page: page + 1 })}>Next</button></nav> : null}
  </main>;
}

export function ModelDetailPage({ publisher, slug }: { publisher: string; slug: string }) {
  const [model, setModel] = useState<ModelSummary | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { const controller = new AbortController(); setError(false); getModel(publisher, slug, controller.signal).then(setModel).catch(() => { if (!controller.signal.aborted) setError(true); }); return () => controller.abort(); }, [publisher, slug, attempt]);
  useEffect(() => { if (model) document.title = `${model.title} · Models · Vonk Forge`; }, [model]);
  if (error) return <main className="status-panel error"><h1>Model unavailable</h1><p>This model is not present in the published index.</p><button className="button" type="button" onClick={() => { setModel(null); setAttempt((value) => value + 1); }}>Retry</button></main>;
  if (!model) return <main className="status-panel" role="status">Loading immutable model…</main>;
  return <main className="model-detail-page"><header className="page-intro"><p className="eyebrow">{model.family ? `Model family · ${model.family}` : "Model"}</p><h1>{model.title}</h1><p className="recipe-path">{model.publisher}/{model.slug}</p><p className="model-detail-identity">Immutable model identity <code>{model.revision_id}</code></p><p>{model.description || "No description published."}</p></header><div className="model-detail-actions"><a className="button" href="/models">All models</a><a className="button" href={`/recipes?q=${encodeURIComponent(model.title)}`}>Compare recipes</a><a className="button primary" href="/control#library-import">Open Controller instructions</a></div><section className="model-detail-boundary"><div><h2>Versions and weight variants</h2><p>Each row is a published version and variant. Download size, source revision, format, license, access, and capability evidence appear when the catalog declares them.</p></div><div className="model-version-list">{model.versions.map((version) => <VersionRow key={`${version.publisher}/${version.slug}-${version.revision_id}`} version={version} />)}</div></section></main>;
}
