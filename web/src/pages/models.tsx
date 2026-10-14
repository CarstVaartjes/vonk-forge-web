import { useEffect, useMemo, useState } from "react";

import { getModel, listModels, type ModelSummary, type ModelVersionSummary } from "../api/client";
import { FacetStrip, SparkPicker } from "../catalog-setup";
import { CAPABILITY_OPTIONS, SPARK_OPTIONS, engineLabel, nodeCountMatches, type SparkFilter } from "../catalog-filters";

const PAGE_SIZE = 12;

function bytes(value?: number | null): string {
  if (!value) return "Not declared";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let amount = value;
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) { amount /= 1024; unit += 1; }
  return `${amount >= 10 || unit === 0 ? Math.round(amount) : amount.toFixed(1)} ${units[unit]}`;
}

function modelCapabilities(model: ModelSummary): string[] {
  return Array.from(new Set(model.versions.flatMap((version) => version.capabilities)));
}

function filterLabel(value: string): string {
  return CAPABILITY_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function accessLabel(version?: ModelVersionSummary): string {
  if (version?.requires_token === undefined) return "Access not declared";
  return version.requires_token ? "Token required" : "Public access";
}

// A version the library names (1.0, 2512) stays; a bare commit hash reads as
// its first eight characters, like the identity codes beside it.
function versionLabel(value: string): string {
  return /^[0-9a-f]{32,64}$/i.test(value) ? `${value.slice(0, 8)}…` : value;
}

function compactRevision(value: string): string {
  return /^[0-9a-f]{40,64}$/i.test(value) ? `${value.slice(0, 8)}…` : value;
}

function CapabilityFacts({ version }: { version: ModelVersionSummary }) {
  if (!version.capabilities.length) {
    return <p className="model-unknown">No capabilities declared for this model version.</p>;
  }
  return <ul className="model-capability-facts" aria-label="Declared capabilities">{version.capabilities.map((name) => <li key={name}><strong>{filterLabel(name)}</strong></li>)}</ul>;
}

function PublicCatalogExplainer() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (window.location.hash === "#model-recipe-explainer") setOpen(true);
  }, []);
  return <details id="model-recipe-explainer" className="public-contract-explainer" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary>How global availability becomes a local run</summary>
    <div className="public-contract-content" aria-labelledby="public-contract-heading">
      <header className="public-contract-heading">
        <h2 id="public-contract-heading">Pick a model. Choose how to run it.</h2>
        <p>Models are the AI files. Recipes describe the software and settings that run them on your Sparks.</p>
      </header>
      <div className="model-recipe-relationship" aria-label="One model can have several recipes">
      <article className="explainer-entity explainer-model">
        <h3>Model</h3>
        <p className="explainer-label">Global catalog · one exact release</p>
        <p>The files to download, the capabilities it has, and its exact versions.</p>
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
          <p className="explainer-label">Global recipe instructions · one Spark</p>
          <p>The same model, with one engine, number of Sparks, and set of settings.</p>
          <p className="explainer-fields-inline"><span>engine</span><span>Sparks</span><span>settings</span></p>
        </article>
        <article className="explainer-entity explainer-recipe">
          <h3>Another way to run it</h3>
          <p className="explainer-label">Global recipe instructions · two Sparks</p>
          <p>Same model again, with a different engine or number of Sparks.</p>
          <p className="explainer-fields-inline"><span>engine</span><span>Sparks</span><span>settings</span></p>
        </article>
      </div>
      </div>
      <p className="relationship-caption">One exact model can have several recipes. The recipe changes how the model runs; it does not change the model files.</p>
      <section className="controller-handoff" aria-labelledby="controller-handoff-heading">
        <header>
          <h3 id="controller-handoff-heading">From the catalog to your NAS</h3>
          <p>The catalog describes what is available. Your Controller prepares the files on your NAS; running starts when you choose Run.</p>
        </header>
        <div className="availability-map" aria-label="Global catalog to local run">
          <section className="availability-column availability-global" aria-labelledby="availability-global-heading">
            <h4 id="availability-global-heading">Available globally</h4>
            <ul className="availability-list">
              <li><strong>Available models</strong><span>Global catalog</span><p>Capabilities, versions, and download files.</p></li>
              <li><strong>Available recipes</strong><span>Global recipe repository</span><p>Software, settings, and the number of Sparks.</p></li>
            </ul>
          </section>
          <div className="availability-connector" aria-hidden="true"><span>prepare locally</span></div>
          <section className="availability-column availability-local" aria-labelledby="availability-local-heading">
            <h4 id="availability-local-heading">Prepared locally</h4>
            <ul className="availability-list">
              <li><strong>Local models</strong><span>Verified NAS model cache</span><p>Model files downloaded and verified on your NAS.</p></li>
              <li><strong>Local recipes</strong><span>Prepared runtime image on NAS</span><p>Recipes whose container image—the software needed to run the model—has been downloaded or built and cached on your NAS.</p></li>
            </ul>
          </section>
          <section className="availability-run" aria-labelledby="availability-run-heading">
            <h4 id="availability-run-heading">Run on Sparks</h4>
            <p>Your Controller combines the verified model cache and prepared runtime image, sends the selected assets to the chosen Sparks, and starts the application.</p>
          </section>
        </div>
        <p className="private-boundary">Local means cached on your NAS. Running starts when you choose Run. Recipe definitions stay in the global repository.</p>
        <p className="profile-note">Profiles remember your model, recipe, and Spark assignments. The public site cannot see private NAS cache, download, or running state; view that state in your <a href="/control">private Controller</a>. <a href="https://github.com/CarstVaartjes/vonk-forge-recipes/blob/main/docs/recipe-authoring.md">Read the recipe authoring guide on GitHub</a></p>
      </section>
    </div>
  </details>;
}

function VersionRow({ version }: { version: ModelVersionSummary }) {
  return <article className="model-version" aria-labelledby={`version-${version.publisher}-${version.slug}`}>
    <div className="model-version-heading">
      <div><h3 id={`version-${version.publisher}-${version.slug}`}>{version.title}</h3><span className="model-meta">Model version</span><code>{version.publisher}/{version.slug}</code></div>
    </div>
    <dl className="model-fact-grid">
      <div><dt>Identity</dt><dd><code title={version.revision_id} aria-label={`Model identity ${version.revision_id}`}>{compactRevision(version.revision_id)}</code></dd></div>
      <div><dt>Version</dt><dd>{versionLabel(version.version)}</dd></div>
      <div><dt>Variant</dt><dd>{version.variant || "Not declared"}</dd></div>
      <div><dt>Access</dt><dd>{accessLabel(version)}</dd></div>
      <div><dt>Format</dt><dd>{[version.format?.precision, version.format?.quantization].filter(Boolean).join(" · ") || "Not declared"}</dd></div>
      <div><dt>Weights</dt><dd>{bytes(version.sizes?.download_bytes)} download · {bytes(version.sizes?.installed_bytes)} installed</dd></div>
      <div><dt>Source</dt><dd>{version.source_repository ? <a href={version.source_repository}>Pinned source repository</a> : "Not declared"}{version.source_revision ? <code title={version.source_revision} aria-label={`Source revision ${version.source_revision}`}>{compactRevision(version.source_revision)}</code> : null}</dd></div>
      <div><dt>Recipes</dt><dd>{version.recipe_slugs.length ? <span className="model-recipe-links">{version.recipe_slugs.map((path) => <a key={path} href={`/recipes?q=${encodeURIComponent(path)}`}>{path}</a>)}</span> : "No public recipe"}</dd></div>
    </dl>
    <div className="model-version-capabilities"><strong>Capabilities</strong><CapabilityFacts version={version} /></div>
    {version.license?.spdx ? <p className="model-license">License: <a href={version.license.url}>{version.license.spdx}</a></p> : null}
  </article>;
}

type SetupFacet = "sparks" | "family" | "engine";
type ModelFilters = ReturnType<typeof initialFilters>;

function runsOn(model: ModelSummary, sparks: SparkFilter): boolean {
  return !sparks || model.runs.spark_counts.some((count) => nodeCountMatches(count, sparks));
}

// The setup facets (Spark count, family, engine), with one left open for its own counts.
function setupMatches(model: ModelSummary, filters: ModelFilters, omit: SetupFacet | null): boolean {
  return (omit === "sparks" || runsOn(model, filters.sparks))
    && (omit === "family" || !filters.family || (model.family ?? "Model") === filters.family)
    && (omit === "engine" || !filters.engine || model.runs.engines.includes(filters.engine));
}

// The search-row filters, shared by the list and the setup counts.
function baseMatches(model: ModelSummary, filters: ModelFilters): boolean {
  const needle = filters.query.trim().toLowerCase();
  const capabilities = modelCapabilities(model);
  const matchesText = !needle || [model.title, model.publisher, model.slug, model.family, ...model.tags].join(" ").toLowerCase().includes(needle);
  const matchesRecipes = !filters.recipes || filters.recipes === "all" || (filters.recipes === "recipes" ? model.recipe_count > 0 : model.recipe_count === 0);
  return matchesText && (!filters.publisher || model.publisher === filters.publisher) && (!filters.capability || capabilities.includes(filters.capability)) && matchesRecipes;
}

function initialFilters() {
  const params = new URLSearchParams(window.location.search);
  const sparks = params.get("sparks") ?? "";
  return { query: params.get("q") ?? "", publisher: params.get("publisher") ?? "", capability: params.get("capability") ?? "", recipes: params.get("recipes") ?? "", family: params.get("family") ?? "", engine: params.get("engine") ?? "", sparks: (SPARK_OPTIONS.some((option) => option.value === sparks) ? sparks : "") as SparkFilter, sort: params.get("sort") ?? "name", page: Math.max(1, Number(params.get("page")) || 1) };
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
    const result = (models ?? []).filter((model) => baseMatches(model, filters) && setupMatches(model, filters, null));
    return result.sort((left, right) => filters.sort === "recipes" ? right.recipe_count - left.recipe_count || left.title.localeCompare(right.title, undefined, { numeric: true }) : filters.sort === "versions" ? right.versions.length - left.versions.length || left.title.localeCompare(right.title, undefined, { numeric: true }) : left.title.localeCompare(right.title, undefined, { numeric: true }));
  }, [filters, models]);
  // Counts for the setup picker: every other filter applied, the picked facet left open.
  const facetCount = (omit: SetupFacet, predicate: (model: ModelSummary) => boolean) => (models ?? []).filter((model) => predicate(model) && baseMatches(model, filters) && setupMatches(model, filters, omit)).length;
  const sparkCounts = Object.fromEntries([...SPARK_OPTIONS.map((option) => option.value), ""].map((value) => [value, facetCount("sparks", (model) => runsOn(model, value as SparkFilter))])) as Record<SparkFilter, number>;
  const families = useMemo(() => Array.from(new Set((models ?? []).map((model) => model.family ?? "Model"))).sort(), [models]);
  const engines = useMemo(() => Array.from(new Set((models ?? []).flatMap((model) => model.runs.engines))).sort(), [models]);
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
    if (updated.family) params.set("family", updated.family);
    if (updated.engine) params.set("engine", updated.engine);
    if (updated.sparks) params.set("sparks", updated.sparks);
    if (updated.sort !== "name") params.set("sort", updated.sort);
    if (updated.page > 1) params.set("page", String(updated.page));
    window.history.replaceState({}, "", `/models${params.toString() ? `?${params}` : ""}`);
  }
  function clearFilters() { updateFilters({ query: "", publisher: "", capability: "", recipes: "", family: "", engine: "", sparks: "", sort: "name" }); }
  useEffect(() => { document.title = "Models · Vonk Forge"; }, []);
  return <main className="models-page">
    <header className="page-intro models-intro"><div><h1>Models, with their exact versions.</h1></div><p>Start with a model, then inspect its exact versions and variants and the recipes that bind them. Details come from the published catalog; local cache and running state stay in your Controller.</p></header>
    {models ? (
      <section className="catalog-setup" aria-labelledby="model-setup-title">
        <div className="catalog-setup-heading">
          <h2 id="model-setup-title">Start from your setup.</h2>
          <p>Pick what you have. A model stays in the list while at least one of its public recipes runs on that many Sparks and that engine.</p>
        </div>
        <SparkPicker value={filters.sparks} noun="models" counts={sparkCounts} onChange={(value) => updateFilters({ sparks: value })} />
        <div className="catalog-setup-facets">
          <FacetStrip label="Model family" value={filters.family} onChange={(value) => updateFilters({ family: value })} options={families.map((value) => ({ value, label: value, count: facetCount("family", (model) => (model.family ?? "Model") === value) }))} />
          <FacetStrip label="Engine" value={filters.engine} onChange={(value) => updateFilters({ engine: value })} options={engines.map((value) => ({ value, label: engineLabel(value), count: facetCount("engine", (model) => model.runs.engines.includes(value)) }))} />
        </div>
      </section>
    ) : null}
    <section className="model-index-tools" aria-label="Model index controls"><label htmlFor="model-search">Find a model</label><input id="model-search" type="search" value={filters.query} onChange={(event) => updateFilters({ query: event.target.value })} placeholder="Search model, family, publisher, or tag" /><label htmlFor="model-publisher">Publisher</label><select id="model-publisher" value={filters.publisher} onChange={(event) => updateFilters({ publisher: event.target.value })}><option value="">All publishers</option>{publishers.map((publisher) => <option key={publisher} value={publisher}>{publisher}</option>)}</select><label htmlFor="model-capability">Capability</label><select id="model-capability" value={filters.capability} onChange={(event) => updateFilters({ capability: event.target.value })}><option value="">All declared capabilities</option>{CAPABILITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><label htmlFor="model-recipes">Recipe support</label><select id="model-recipes" value={filters.recipes} onChange={(event) => updateFilters({ recipes: event.target.value })}><option value="">All models</option><option value="recipes">Has public recipes</option><option value="none">No public recipes</option></select><label htmlFor="model-sort">Sort</label><select id="model-sort" value={filters.sort} onChange={(event) => updateFilters({ sort: event.target.value })}><option value="name">Name</option><option value="versions">Most versions</option><option value="recipes">Most recipes</option></select><span aria-live="polite">{models ? `${filtered.length} of ${models.length} models` : error ? "Model index unavailable" : "Loading models…"}</span>{(filters.query || filters.publisher || filters.capability || filters.recipes || filters.family || filters.engine || filters.sparks || filters.sort !== "name") ? <button className="text-button" type="button" onClick={clearFilters}>Clear filters</button> : null}</section>
    <PublicCatalogExplainer />
    {error ? <div className="status-panel error" role="alert"><h2>Models are temporarily unavailable.</h2><p>The public model index could not be loaded. Try again when the catalog source is reachable.</p><button className="button" type="button" onClick={() => { setModels(null); setAttempt((value) => value + 1); }}>Retry</button></div> : null}
    {!models && !error ? <div className="status-panel" role="status">Loading immutable model index…</div> : null}
    {models && filtered.length === 0 ? <div className="status-panel"><h2>No matching models.</h2><p>Try a broader family, publisher, or capability.</p><button className="button" type="button" onClick={clearFilters}>Show all models</button></div> : null}
    {models && visible.length ? <ul className="model-list" aria-label="Models">{visible.map((model) => { const capabilities = modelCapabilities(model); const version = model.versions[0]; const key = `${model.publisher}/${model.slug}`; return <li key={key}><a className="model-row" href={`/models/${model.publisher}/${model.slug}`}><span className="model-row-main"><strong>{model.title}</strong><span className="model-meta">{model.family ? `Family · ${model.family}` : "Model"}</span><code>{model.publisher}/{model.slug}</code></span><span className="model-row-facts">{version ? <><span><small>Version</small>{versionLabel(version.version)}</span><span><small>Runs on</small>{model.runs.spark_counts.length ? model.runs.spark_counts.map((count) => `${count} Spark${count === 1 ? "" : "s"}`).join(" · ") : "No public recipe"}</span><span><small>Engines</small>{model.runs.engines.length ? model.runs.engines.map(engineLabel).join(" · ") : "—"}</span><span><small>Access</small>{accessLabel(version)}</span></> : null}</span><span className="model-row-capabilities" aria-label="Declared capabilities">{capabilities.slice(0, 3).map((capability) => <span key={capability}>{filterLabel(capability)}</span>)}{!capabilities.length ? <span>No capabilities declared</span> : null}</span><span className="model-row-action"><span>{model.recipe_count} {model.recipe_count === 1 ? "recipe" : "recipes"}</span><span className="button primary">View versions</span></span></a></li>; })}</ul> : null}
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
  return <main className="model-detail-page"><header className="page-intro"><h1>{model.title}</h1><p className="model-meta">{model.family ? `Model family · ${model.family}` : "Model"}</p><p className="recipe-path">{model.publisher}/{model.slug}</p><p className="model-detail-identity">Immutable model identity <code>{model.revision_id}</code></p><p>{model.description || "No description published."}</p></header><div className="model-detail-actions"><a className="button" href="/models">All models</a><a className="button" href={`/recipes?q=${encodeURIComponent(model.title)}`}>Compare recipes</a><a className="button primary" href="/control#library-import">Open Controller instructions</a></div><section className="model-detail-boundary"><div><h2>Versions and weight variants</h2><p>Each row is a published version and variant. Download size, source revision, format, license, access, and capabilities appear when the catalog declares them.</p></div><div className="model-version-list">{model.versions.map((version) => <VersionRow key={`${version.publisher}/${version.slug}-${version.revision_id}`} version={version} />)}</div></section></main>;
}
