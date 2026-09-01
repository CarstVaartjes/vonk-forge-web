import { useEffect, useMemo, useState } from "react";

import { CatalogProblem, loadRecipeCatalog, type RecipeSummary } from "../api/client";
import {
  CAPABILITY_OPTIONS,
  ALIGNMENT_OPTIONS,
  MODEL_TYPE_OPTIONS,
  READINESS_OPTIONS,
  filtersFromParameters,
  humanize,
  metadata,
  modelTypeMatches,
  modelVersionKey,
  recipeMatches,
  sortRecipes,
  sourceLabel,
  updatedMatches,
  type FilterFacet,
  type ModelType,
  type RecipeSort,
  type SortDirection,
  type SparkFilter,
  type UpdatedFilter,
} from "../catalog-filters";


const PAGE_SIZE = 24;

type CatalogView = "table" | "cards";

const SORT_LABELS: Record<RecipeSort, string> = {
  catalog: "Recently updated",
  model: "Model",
  recipe: "Recipe",
  creator: "Creator",
  version: "Version",
  quantization: "Quantization",
  alignment: "Alignment",
  sparks: "Sparks",
  runtime: "Runtime",
  readiness: "Readiness",
  qualification: "Qualification",
  updated: "Updated",
  download: "Download",
  memory: "Memory",
};

function defaultDirection(sort: RecipeSort): SortDirection {
  return sort === "catalog" ? "desc" : "asc";
}

function bytes(value: number | undefined): string {
  if (value === undefined) return "Not declared";
  const gib = value / 1024 ** 3;
  return `${gib >= 10 ? gib.toFixed(0) : gib.toFixed(1)} GiB`;
}

function capabilityLabel(value: string): string {
  return CAPABILITY_OPTIONS.find((option) => option.value === value)?.label ?? humanize(value);
}

function recipeAlignmentLabel(value: string): string {
  return ALIGNMENT_OPTIONS.find((option) => option.value === value)?.label ?? humanize(value);
}

function updatedLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : new Intl.DateTimeFormat(undefined, {dateStyle: "medium"}).format(date);
}

function sortIndicator(sort: RecipeSort, active: RecipeSort, direction: SortDirection): string {
  if (sort !== active) return "";
  return direction === "asc" ? " ↑" : " ↓";
}

function SortButton({sort, active, direction, onSort}: {sort: RecipeSort; active: RecipeSort; direction: SortDirection; onSort: (sort: RecipeSort) => void}) {
  const label = SORT_LABELS[sort];
  const isActive = sort === active;
  return <button type="button" className={`catalog-sort-button${isActive ? " is-active" : ""}`} onClick={() => onSort(sort)} aria-label={`Sort by ${label}${isActive ? `, currently ${direction === "asc" ? "ascending" : "descending"}` : ""}`}><span>{label}</span><span className="catalog-sort-icon" aria-hidden="true">{isActive ? sortIndicator(sort, active, direction) : "↕"}</span></button>;
}

export function RecipeCard({ recipe }: { recipe: RecipeSummary }) {
  const counts = recipe.capacity?.profile_node_counts ?? [];
  const catalog = metadata(recipe);
  return (
    <article className="recipe-card">
      <div className="card-heading">
        <div>
          <p className="recipe-path">{recipe.publisher}/{recipe.slug}</p>
          <h2><a href={`/recipes/${recipe.publisher}/${recipe.slug}`}>{recipe.title}</a></h2>
        </div>
        <span className={`badge ${catalog.qualification === "cataloged" ? "accepted" : "candidate"}`}>
          {catalog.qualification === "cataloged" ? "Accepted" : "Candidate"}
        </span>
      </div>
      {recipe.moderation_warning ? <p className="warning" role="status">{recipe.moderation_warning}</p> : null}
      <dl className="recipe-facts">
        <div><dt>Runtime</dt><dd>{humanize(recipe.runtime.adapter ?? catalog.runtime_distribution)}</dd></div>
        <div><dt>Required</dt><dd>{counts.length ? counts.map((value) => `${value} Spark${value === 1 ? "" : "s"}`).join(", ") : "Unknown"}</dd></div>
        <div><dt>Disk / Spark</dt><dd>{bytes(recipe.capacity?.maximum_installed_bytes_per_node)}</dd></div>
        <div><dt>Memory / Spark</dt><dd>{bytes(recipe.capacity?.maximum_runtime_memory_bytes_per_node)}</dd></div>
      </dl>
      <div className="trust-row" aria-label="Recipe contract">
        <span>{READINESS_OPTIONS.find((option) => option.value === catalog.execution_readiness)?.label ?? humanize(catalog.execution_readiness)}</span>
        {catalog.quantizations.length ? <span>{catalog.quantizations.join(" · ")}</span> : null}
        <span>{recipe.facts?.source_bundle_observed ? "Source verified" : "Source pending"}</span>
        <span>{recipe.facts?.publisher_tested ? "Publisher-tested" : "No accepted test report"}</span>
      </div>
      {catalog.capabilities.length ? (
        <div className="recipe-capabilities" aria-label={`${recipe.title} capabilities`}>
          {catalog.capabilities.map((capability) => <span key={capability}>{capabilityLabel(capability)}</span>)}
        </div>
      ) : null}
      <p className="evidence-note">Publisher-submitted evidence is not a Vonk endorsement.</p>
      <p className="hash">Model · {catalog.model_publisher}/{catalog.model_slug}</p>
      <p className="hash">{recipe.version ? `v${recipe.version}` : `rev ${recipe.revision_number}`} · sha256:{recipe.content_sha256}</p>
    </article>
  );
}

function RecipeTable({recipes, activeSort, direction, onSort}: {recipes: RecipeSummary[]; activeSort: RecipeSort; direction: SortDirection; onSort: (sort: RecipeSort) => void}) {
  return <div className="catalog-table-scroll" role="region" aria-label="Recipe list" tabIndex={0}>
    <table className="catalog-table">
      <caption className="visually-hidden">Publisher-submitted evidence is not a Vonk endorsement.</caption>
      <thead><tr>
        {(["model", "recipe", "creator", "version", "quantization", "alignment", "sparks", "runtime", "readiness", "qualification", "updated", "download", "memory"] as RecipeSort[]).map((sort) => <th key={sort} scope="col" aria-sort={sort === activeSort ? direction === "asc" ? "ascending" : "descending" : "none"}><SortButton sort={sort} active={activeSort} direction={direction} onSort={onSort}/></th>)}
        <th scope="col"><span className="visually-hidden">Open</span></th>
      </tr></thead>
      <tbody>{recipes.map((recipe) => {
        const facts = metadata(recipe);
        const counts = recipe.capacity?.profile_node_counts ?? [];
        return <tr key={`${recipe.publisher}/${recipe.slug}`}>
          <td className="catalog-table-model"><h2><a href={`/recipes/${recipe.publisher}/${recipe.slug}`}>{recipe.title}</a></h2><span>{facts.model_title} · {facts.model_slug}</span></td>
          <td className="catalog-table-recipe"><strong>{facts.model_version_title}</strong><span>{recipe.publisher}/{recipe.slug}</span><span>{recipe.version ? `v${recipe.version}` : `rev ${recipe.revision_number}`} · sha256:{recipe.content_sha256}</span></td>
          <td>{facts.source_owner ?? "—"}</td>
          <td>{facts.quantizations.length ? facts.quantizations.join(" · ") : "—"}</td>
          <td><span className={`catalog-alignment alignment-${facts.alignment}`}>{recipeAlignmentLabel(facts.alignment)}</span></td>
          <td className="catalog-table-number">{counts.length ? counts.join(" / ") : facts.node_count}</td>
          <td>{humanize(recipe.runtime.adapter ?? facts.runtime_distribution)}</td>
          <td><span className={`catalog-readiness readiness-${facts.execution_readiness}`}>{READINESS_OPTIONS.find((option) => option.value === facts.execution_readiness)?.label ?? humanize(facts.execution_readiness)}</span></td>
          <td><span className={`badge ${facts.qualification === "cataloged" ? "accepted" : "candidate"}`}>{facts.qualification === "cataloged" ? "Accepted" : "Candidate"}</span><span className="catalog-table-substatus"><span>{recipe.facts?.source_bundle_observed ? "Source verified" : "Source pending"}</span><span>{recipe.facts?.publisher_tested ? "Publisher-tested" : "No accepted test report"}</span></span></td>
          <td className="catalog-table-date">{updatedLabel(recipe.published_at)}</td>
          <td className="catalog-table-number">{bytes(facts.expected_download_bytes)}</td>
          <td className="catalog-table-number"><span>{bytes(recipe.capacity?.maximum_installed_bytes_per_node)}</span><span>{bytes(recipe.capacity?.maximum_runtime_memory_bytes_per_node)}</span></td>
          <td className="catalog-table-action"><a className="button" href={`/recipes/${recipe.publisher}/${recipe.slug}`}>Open</a></td>
        </tr>;
      })}</tbody>
    </table>
  </div>;
}

type ActiveFilter = { key: string; label: string; remove: () => void };

export function RecipesPage({ fixedPublisher }: { fixedPublisher?: string } = {}) {
  const [parameters, setParameters] = useState(() => new URLSearchParams(window.location.search));
  const [catalog, setCatalog] = useState<RecipeSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const filters = filtersFromParameters(parameters);
  const view: CatalogView = parameters.get("view") === "cards" ? "cards" : "table";
  const more = parameters.get("more") === "1";
  const offset = Math.max(0, Number.parseInt(parameters.get("cursor") ?? "0", 10) || 0);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    loadRecipeCatalog(controller.signal)
      .then(setCatalog)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof CatalogProblem ? reason.problem.detail : reason instanceof Error ? reason.message : "The public recipe index could not be loaded.");
        }
      });
    return () => controller.abort();
  }, [retry]);

  const available = useMemo(
    () => (catalog ?? []).filter((recipe) => !fixedPublisher || recipe.publisher === fixedPublisher),
    [catalog, fixedPublisher],
  );
  const filtered = useMemo(
    () => sortRecipes(available.filter((recipe) => recipeMatches(recipe, filters)), filters.sort, filters.direction),
    [available, filters],
  );
  const pageItems = filtered.slice(offset, offset + PAGE_SIZE);

  function replace(next: URLSearchParams) {
    const suffix = next.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${suffix ? `?${suffix}` : ""}`);
    setParameters(next);
  }

  function update(name: string, value: string) {
    const next = new URLSearchParams(parameters);
    if (value) next.set(name, value); else next.delete(name);
    if (name !== "cursor") next.delete("cursor");
    replace(next);
  }

  function updateSort(sort: RecipeSort) {
    const next = new URLSearchParams(parameters);
    const direction = filters.sort === sort ? filters.direction === "asc" ? "desc" : "asc" : defaultDirection(sort);
    next.set("sort", sort);
    next.set("direction", direction);
    next.delete("cursor");
    replace(next);
  }

  function updateView(nextView: CatalogView) {
    const next = new URLSearchParams(parameters);
    if (nextView === "table") next.delete("view"); else next.set("view", nextView);
    replace(next);
  }

  function toggleCapability(capability: string) {
    const next = new URLSearchParams(parameters);
    const values = next.getAll("capability");
    next.delete("capability");
    for (const value of values.includes(capability) ? values.filter((value) => value !== capability) : [...values, capability]) next.append("capability", value);
    next.delete("cursor");
    replace(next);
  }

  function clearAll() {
    const next = new URLSearchParams();
    if (more) next.set("more", "1");
    replace(next);
  }

  function count(facet: FilterFacet, predicate: (recipe: RecipeSummary) => boolean): number {
    return available.filter((recipe) => recipeMatches(recipe, filters, facet) && predicate(recipe)).length;
  }

  function capabilityCount(capability: string): number {
    const otherCapabilities = filters.capabilities.filter((value) => value !== capability);
    return available.filter((recipe) => {
      const facts = metadata(recipe);
      return recipeMatches(recipe, filters, "capability") && otherCapabilities.every((value) => facts.capabilities.includes(value)) && facts.capabilities.includes(capability);
    }).length;
  }

  function modelTypeCount(modelType: ModelType): number {
    return available.filter((recipe) => recipeMatches(recipe, { ...filters, model: "" }, "modelType") && modelTypeMatches(recipe, modelType)).length;
  }

  function updateModelType(modelType: ModelType) {
    const selectedModelMatches = !filters.model || available.some((recipe) => `${metadata(recipe).model_publisher}/${metadata(recipe).model_slug}` === filters.model && modelTypeMatches(recipe, modelType));
    const next = new URLSearchParams(parameters);
    if (modelType) next.set("model_type", modelType); else next.delete("model_type");
    if (!selectedModelMatches) { next.delete("model"); next.delete("model_version"); }
    next.delete("cursor");
    replace(next);
  }

  function updateModel(model: string) {
    const selectedVersionMatches = !filters.modelVersion || available.some((recipe) => `${metadata(recipe).model_publisher}/${metadata(recipe).model_slug}` === model && modelVersionKey(recipe) === filters.modelVersion);
    const next = new URLSearchParams(parameters);
    if (model) next.set("model", model); else next.delete("model");
    if (!selectedVersionMatches) next.delete("model_version");
    next.delete("cursor");
    replace(next);
  }

  const models = useMemo(() => {
    const identities = new Map<string, string>();
    for (const recipe of available.filter((item) => modelTypeMatches(item, filters.modelType))) {
      const facts = metadata(recipe);
      identities.set(`${facts.model_publisher}/${facts.model_slug}`, facts.model_title);
    }
    const titleCounts = [...identities.values()].reduce((counts, title) => counts.set(title, (counts.get(title) ?? 0) + 1), new Map<string, number>());
    return [...identities].map(([value, title]) => [value, titleCounts.get(title) === 1 ? title : `${title} · ${value}`] as const).sort((left, right) => left[1].localeCompare(right[1]));
  }, [available, filters.modelType]);
  const modelVersions = useMemo(() => {
    const identities = new Map<string, string>();
    for (const recipe of available.filter((item) => modelTypeMatches(item, filters.modelType) && (!filters.model || `${metadata(item).model_publisher}/${metadata(item).model_slug}` === filters.model))) identities.set(modelVersionKey(recipe), metadata(recipe).model_version_title);
    const titleCounts = [...identities.values()].reduce((counts, title) => counts.set(title, (counts.get(title) ?? 0) + 1), new Map<string, number>());
    return [...identities].map(([value, title]) => [value, titleCounts.get(title) === 1 ? title : `${title} · ${value}`] as const).sort((left, right) => left[1].localeCompare(right[1]));
  }, [available, filters.model, filters.modelType]);
  const sourceOwners = useMemo(() => Array.from(new Set(available.flatMap((recipe) => metadata(recipe).source_owner ? [metadata(recipe).source_owner as string] : []))).sort(), [available]);
  const repositories = useMemo(() => Array.from(new Set(available.flatMap((recipe) => metadata(recipe).source_repository ? [metadata(recipe).source_repository as string] : []))).sort(), [available]);
  const runtimes = useMemo(() => Array.from(new Set(available.map((recipe) => metadata(recipe).runtime_distribution))).sort(), [available]);
  const quantizations = useMemo(() => Array.from(new Set(available.flatMap((recipe) => metadata(recipe).quantizations))).sort(), [available]);
  const alignments = useMemo(() => ALIGNMENT_OPTIONS.filter((option) => available.some((recipe) => metadata(recipe).alignment === option.value)), [available]);
  const topologies = useMemo(() => Array.from(new Set(available.map((recipe) => metadata(recipe).topology_mode))).sort(), [available]);

  const applied: ActiveFilter[] = [];
  const addApplied = (key: string, label: string, parameter: string) => applied.push({ key, label, remove: () => update(parameter, "") });
  if (filters.query) addApplied("query", `Search: ${filters.query}`, "q");
  if (filters.modelType) addApplied("modelType", `Type: ${MODEL_TYPE_OPTIONS.find((option) => option.value === filters.modelType)?.label ?? filters.modelType}`, "model_type");
  if (filters.model) addApplied("model", `Model: ${models.find(([value]) => value === filters.model)?.[1] ?? filters.model}`, "model");
  if (filters.modelVersion) addApplied("modelVersion", `Model version: ${modelVersions.find(([value]) => value === filters.modelVersion)?.[1] ?? filters.modelVersion}`, "model_version");
  if (filters.readiness) addApplied("readiness", `Readiness: ${READINESS_OPTIONS.find((option) => option.value === filters.readiness)?.label ?? filters.readiness}`, "readiness");
  if (filters.sparks) addApplied("sparks", `Sparks: ${filters.sparks}`, "sparks");
  if (filters.qualification) addApplied("qualification", `Qualification: ${filters.qualification === "cataloged" ? "Accepted" : "Candidate"}`, "qualification");
  if (filters.sourceOwner) addApplied("sourceOwner", `Creator: ${filters.sourceOwner}`, "creator");
  if (filters.repository) addApplied("repository", `Repository: ${sourceLabel(filters.repository)}`, "repository");
  if (filters.runtime) addApplied("runtime", `Runtime: ${humanize(filters.runtime)}`, "runtime");
  if (filters.quantization) addApplied("quantization", `Quantization: ${filters.quantization}`, "quantization");
  if (filters.alignment) addApplied("alignment", `Alignment: ${ALIGNMENT_OPTIONS.find((option) => option.value === filters.alignment)?.label ?? filters.alignment}`, "alignment");
  if (filters.updated) addApplied("updated", `Updated: last ${filters.updated} days`, "updated");
  if (filters.topology) addApplied("topology", `Topology: ${humanize(filters.topology)}`, "topology");
  for (const capability of filters.capabilities) applied.push({ key: `capability:${capability}`, label: `Capability: ${capabilityLabel(capability)}`, remove: () => toggleCapability(capability) });

  return (
    <main className="catalog-page">
      <header className="page-intro catalog-intro">
        <h1>{fixedPublisher ? `${fixedPublisher} recipes` : "Find the right recipe."}</h1>
        <p>Use the same immutable catalog facts and filtering language as your local Controller. Installation state remains private to your own infrastructure.</p>
      </header>

      {error ? <div className="status-panel error catalog-error" role="alert"><h2>Recipes are temporarily out of reach.</h2><p>{error} Retry the public index, or inspect the version-controlled library directly.</p><div className="hero-actions"><button className="button primary" type="button" onClick={() => setRetry((value) => value + 1)}>Try again</button><a className="button" href="https://github.com/CarstVaartjes/vonk-forge-recipes">Open recipe library</a></div></div> : null}
      {!catalog && !error ? <div className="status-panel" role="status">Loading the public recipe index…</div> : null}

      {catalog ? <div className="catalog-browser">
        <button type="button" className="button catalog-filter-toggle" aria-expanded={mobileFiltersOpen} aria-controls="catalog-filter-rail" onClick={() => setMobileFiltersOpen((open) => !open)}>{mobileFiltersOpen ? "Hide filters" : "Show filters"}{applied.length ? <span>{applied.length} applied</span> : null}</button>

        <form id="catalog-filter-rail" className={`catalog-filter-rail${mobileFiltersOpen ? " is-mobile-open" : ""}`} aria-label="Recipe filters" onSubmit={(event) => event.preventDefault()}>
          <div className="catalog-filter-heading"><h2>Filters</h2>{applied.length ? <button type="button" onClick={clearAll}>Clear all</button> : null}</div>
          <label className="catalog-search"><span>Find a recipe</span><input type="search" value={filters.query} onChange={(event) => update("q", event.target.value)} placeholder="Model, modality, runtime…" /></label>
          <div className="catalog-filter-grid">
          <label><span>Model type</span><select aria-label="Filter by model type" value={filters.modelType} onChange={(event) => updateModelType(event.target.value as ModelType)}><option value="">All types ({modelTypeCount("")})</option>{MODEL_TYPE_OPTIONS.map((option) => { const availableCount = modelTypeCount(option.value); return <option key={option.value} value={option.value} disabled={availableCount === 0}>{option.label} ({availableCount})</option>; })}</select></label>
          <label><span>Model</span><select aria-label="Filter by model" value={filters.model} onChange={(event) => updateModel(event.target.value)}><option value="">All models ({count("model", () => true)})</option>{models.map(([value, label]) => { const availableCount = count("model", (recipe) => `${metadata(recipe).model_publisher}/${metadata(recipe).model_slug}` === value); return <option key={value} value={value} disabled={availableCount === 0}>{label} ({availableCount})</option>; })}</select></label>
          <label><span>Model version</span><select aria-label="Filter by model version" value={filters.modelVersion} onChange={(event) => update("model_version", event.target.value)}><option value="">All versions ({count("modelVersion", () => true)})</option>{modelVersions.map(([value, label]) => { const availableCount = count("modelVersion", (recipe) => modelVersionKey(recipe) === value); return <option key={value} value={value} disabled={availableCount === 0}>{label} ({availableCount})</option>; })}</select></label>
          <label><span>Quantization / format</span><select aria-label="Filter by quantization" value={filters.quantization} onChange={(event) => update("quantization", event.target.value)}><option value="">Any format</option>{quantizations.map((value) => { const availableCount = count("quantization", (recipe) => metadata(recipe).quantizations.includes(value)); return <option key={value} value={value} disabled={availableCount === 0}>{value} ({availableCount})</option>; })}</select></label>
          <label><span>Alignment</span><select aria-label="Filter by alignment" value={filters.alignment} onChange={(event) => update("alignment", event.target.value)}><option value="">Any alignment ({count("alignment", () => true)})</option>{alignments.map((option) => { const availableCount = count("alignment", (recipe) => metadata(recipe).alignment === option.value); return <option key={option.value} value={option.value} disabled={availableCount === 0}>{option.label} ({availableCount})</option>; })}</select></label>
          <label><span>Required Sparks</span><select aria-label="Filter by required Sparks" value={filters.sparks} onChange={(event) => update("sparks", event.target.value)}><option value="">Any count ({count("sparks", () => true)})</option>{(["1", "2", "3", "4+"] as SparkFilter[]).map((value) => { const availableCount = count("sparks", (recipe) => value === "4+" ? metadata(recipe).node_count >= 4 : metadata(recipe).node_count === Number(value)); return <option key={value} value={value} disabled={availableCount === 0}>{value}{value === "1" ? " Spark" : " Sparks"} ({availableCount})</option>; })}</select></label>
          <label><span>Recipe creator</span><select aria-label="Filter by recipe creator" value={filters.sourceOwner} onChange={(event) => update("creator", event.target.value)}><option value="">All creators</option>{sourceOwners.map((value) => { const availableCount = count("sourceOwner", (recipe) => metadata(recipe).source_owner === value); return <option key={value} value={value} disabled={availableCount === 0}>{value} ({availableCount})</option>; })}</select></label>
          <label><span>Updated</span><select aria-label="Filter by updated date" value={filters.updated} onChange={(event) => update("updated", event.target.value)}><option value="">Any time ({count("updated", () => true)})</option>{(["7", "30", "90", "365"] as UpdatedFilter[]).map((value) => { const availableCount = count("updated", (recipe) => updatedMatches(recipe, value)); return <option key={value} value={value} disabled={availableCount === 0}>Last {value} days ({availableCount})</option>; })}</select></label>
          </div>
          <div className="catalog-local-boundary"><strong>Local recipe status</strong><p>Imported, current, and update status appear only inside <a href="/control">your local Controller</a>.</p></div>
          <label><span>Execution readiness</span><select aria-label="Filter by execution readiness" value={filters.readiness} onChange={(event) => update("readiness", event.target.value)}><option value="">Any readiness ({count("readiness", () => true)})</option>{READINESS_OPTIONS.map((option) => { const availableCount = count("readiness", (recipe) => metadata(recipe).execution_readiness === option.value); return <option key={option.value} value={option.value} disabled={availableCount === 0}>{option.label} ({availableCount})</option>; })}</select></label>
          <fieldset className="catalog-capabilities"><legend>Capabilities <span>Must all match</span></legend>{CAPABILITY_OPTIONS.map((option) => { const selected = filters.capabilities.includes(option.value); const availableCount = capabilityCount(option.value); return <label className={availableCount === 0 && !selected ? "is-disabled" : ""} key={option.value}><input type="checkbox" checked={selected} disabled={availableCount === 0 && !selected} onChange={() => toggleCapability(option.value)} /><span>{option.label}</span><small>{availableCount}</small></label>; })}</fieldset>
          <button type="button" className="button catalog-more-toggle" aria-expanded={more} aria-controls="catalog-more-filters" onClick={() => update("more", more ? "" : "1")}>{more ? "Hide more filters" : "More filters"}</button>
          <div id="catalog-more-filters" className="catalog-more-filters" hidden={!more}>
            <div className="catalog-filter-grid">
            <label><span>Qualification</span><select aria-label="Filter by qualification" value={filters.qualification} onChange={(event) => update("qualification", event.target.value)}><option value="">Any status ({count("qualification", () => true)})</option><option value="cataloged" disabled={count("qualification", (recipe) => metadata(recipe).qualification === "cataloged") === 0}>Accepted ({count("qualification", (recipe) => metadata(recipe).qualification === "cataloged")})</option><option value="candidate" disabled={count("qualification", (recipe) => metadata(recipe).qualification === "candidate") === 0}>Candidate ({count("qualification", (recipe) => metadata(recipe).qualification === "candidate")})</option></select></label>
            <label><span>Original repository</span><select aria-label="Filter by original repository" value={filters.repository} onChange={(event) => update("repository", event.target.value)}><option value="">All repositories</option>{repositories.map((value) => { const availableCount = count("repository", (recipe) => metadata(recipe).source_repository === value); return <option key={value} value={value} disabled={availableCount === 0}>{sourceLabel(value)} ({availableCount})</option>; })}</select></label>
            <label><span>Runtime</span><select aria-label="Filter by runtime" value={filters.runtime} onChange={(event) => update("runtime", event.target.value)}><option value="">All runtimes</option>{runtimes.map((value) => { const availableCount = count("runtime", (recipe) => metadata(recipe).runtime_distribution === value); return <option key={value} value={value} disabled={availableCount === 0}>{humanize(value)} ({availableCount})</option>; })}</select></label>
            <label><span>Topology</span><select aria-label="Filter by topology" value={filters.topology} onChange={(event) => update("topology", event.target.value)}><option value="">Any topology</option>{topologies.map((value) => { const availableCount = count("topology", (recipe) => metadata(recipe).topology_mode === value); return <option key={value} value={value} disabled={availableCount === 0}>{humanize(value)} ({availableCount})</option>; })}</select></label>
            </div>
          </div>
        </form>

        <section className="catalog-results" aria-label="Recipe results">
          <div className="catalog-results-heading"><div><p aria-live="polite"><strong>{filtered.length}</strong> of {available.length} recipes</p><small className="catalog-results-hint">Click any column heading to sort{filters.sort !== "catalog" ? ` · ${SORT_LABELS[filters.sort]} ${filters.direction === "asc" ? "ascending" : "descending"}` : ""}</small></div><div className="catalog-view-tools"><div className="catalog-view-toggle" role="group" aria-label="Catalog view"><button type="button" className={view === "table" ? "is-active" : ""} aria-pressed={view === "table"} onClick={() => updateView("table")}>List</button><button type="button" className={view === "cards" ? "is-active" : ""} aria-pressed={view === "cards"} onClick={() => updateView("cards")}>Cards</button></div><label><span>Quick sort</span><select aria-label="Sort recipes" value={filters.sort} onChange={(event) => updateSort(event.target.value as RecipeSort)}>{Object.entries(SORT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div></div>
          {applied.length ? <div className="catalog-applied" aria-label="Applied filters">{applied.map((item) => <button type="button" key={item.key} onClick={item.remove}>{item.label}<span aria-hidden="true">×</span><span className="visually-hidden"> Remove filter</span></button>)}</div> : null}
          {filtered.length === 0 ? <div className="status-panel catalog-empty"><h2>No matching recipes.</h2><p>Remove one or more filters to broaden the catalog.</p><button type="button" className="button" onClick={clearAll}>Clear filters</button></div> : null}
          {view === "table" ? <RecipeTable recipes={pageItems} activeSort={filters.sort} direction={filters.direction} onSort={updateSort}/> : <div className="recipe-grid">{pageItems.map((recipe) => <RecipeCard key={`${recipe.publisher}/${recipe.slug}`} recipe={recipe} />)}</div>}
          {filtered.length > PAGE_SIZE ? <nav className="catalog-pagination" aria-label="Recipe pages"><button className="button" type="button" disabled={offset === 0} onClick={() => update("cursor", String(Math.max(0, offset - PAGE_SIZE)))}>Previous page</button><span>Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, filtered.length)} of {filtered.length}</span><button className="button" type="button" disabled={offset + PAGE_SIZE >= filtered.length} onClick={() => update("cursor", String(offset + PAGE_SIZE))}>Next page</button></nav> : null}
        </section>
      </div> : null}
    </main>
  );
}
