import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePageMeta } from "../page-meta";

import { getVocabulary, loadRecipeCatalog, type RecipeSummary } from "../api/client";
import { capabilityLabel, statusMeaning, typeLabel, type Vocabulary } from "../vocabulary";
import { CatalogTabs } from "../catalog-tabs";
import { readMySparks, saveMySparks } from "../my-sparks";
import { STATUS_LEGEND_ID, StatusLegend } from "../status-legend";
import { FacetStrip, SparkPicker, TypeTabs, VerifiedToggle } from "../catalog-setup";
import {
  READINESS_OPTIONS,
  SORT_CHOICES,
  SPARK_OPTIONS,
  capacityBucketMatches,
  capacityBuckets,
  capacityLabel,
  engineLabel,
  filtersFromParameters,
  gibLabel,
  foldCreators,
  humanize,
  nodeCountMatches,
  modelFamilyTitle,
  modelKey,
  recipeIsAbliterated,
  recipeMatches,
  sameCreator,
  sortRecipes,
  sourceLabel,
  sparksFewerLabel,
  updatedMatches,
  type FilterFacet,
  type RecipeSort,
  type SortDirection,
  type UpdatedFilter,
} from "../catalog-filters";

const PAGE_SIZE = 24;

// One sort control per header: first press ascending, second descending, third back to newest.
function SortHeader({ label, sort, activeSort, direction, onSort }: {
  label: string;
  sort: RecipeSort;
  activeSort: RecipeSort;
  direction: SortDirection;
  onSort: (sort: RecipeSort, direction: SortDirection) => void;
}) {
  const active = activeSort === sort;
  const next = !active ? "ascending" : direction === "asc" ? "descending" : "newest first";
  return (
    <th scope="col" aria-sort={active ? direction === "asc" ? "ascending" : "descending" : "none"}>
      <button type="button" className="catalog-sort" title={`Sort ${label}, ${next}`} onClick={() => onSort(...(!active ? [sort, "asc"] : direction === "asc" ? [sort, "desc"] : ["catalog", "desc"]) as [RecipeSort, SortDirection])}>
        {label}<span aria-hidden="true">{active ? direction === "asc" ? "↑" : "↓" : ""}</span>
      </button>
    </th>
  );
}

type ActiveFilter = { key: string; label: string; remove: () => void };

export function RecipesPage() {
  usePageMeta("Recipes", "Browse recipes for NVIDIA DGX Spark, each shown with whether it passed hardware checks, its memory and Spark count.");
  // The URL wins; without a Spark count or type in it, the pick remembered from the home page fills them in.
  const [parameters, setParameters] = useState(() => {
    const start = new URLSearchParams(window.location.search);
    const mine = readMySparks(window.location.search);
    if (!start.has("sparks") && !start.has("type")) {
      if (mine.sparks) start.set("sparks", mine.sparks);
      if (mine.type) start.set("type", mine.type);
      // The URL carries what the list shows, so a share or bookmark reproduces it.
      if (start.has("sparks") || start.has("type")) window.history.replaceState(null, "", `${window.location.pathname}?${start}`);
    }
    return start;
  });
  // The recipes and the words of the release they came from, loaded together.
  const [loaded, setLoaded] = useState<{ recipes: RecipeSummary[]; vocabulary: Vocabulary } | null>(null);
  const catalog = loaded?.recipes ?? null;
  const vocabulary = loaded?.vocabulary ?? null;
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const filters = filtersFromParameters(parameters);
  const offset = Math.max(0, Number.parseInt(parameters.get("cursor") ?? "0", 10) || 0);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    Promise.all([loadRecipeCatalog(controller.signal), getVocabulary(controller.signal)]).then(([recipes, words]) => setLoaded({ recipes, vocabulary: words })).catch((reason: unknown) => {
      if (!controller.signal.aborted) {
        setError(reason instanceof Error ? reason.message : "The public recipe index could not be loaded.");
      }
    });
    return () => controller.abort();
  }, [retry]);

  const available = useMemo(() => catalog ?? [], [catalog]);
  const filtered = useMemo(() => sortRecipes(available.filter((recipe) => recipeMatches(recipe, filters)), filters.sort, filters.direction), [available, filters]);
  const pageItems = filtered.slice(offset, offset + PAGE_SIZE);

  function replace(next: URLSearchParams) {
    const suffix = next.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${suffix ? `?${suffix}` : ""}`);
    // A change to the Spark count or type is the visitor's pick: remember it for the home page.
    const after = filtersFromParameters(next);
    if (after.sparks !== filters.sparks || after.type !== filters.type) saveMySparks(after);
    setParameters(next);
  }

  function update(name: string, value: string) {
    const next = new URLSearchParams(parameters);
    if (value) next.set(name, value); else next.delete(name);
    if (name !== "cursor") next.delete("cursor");
    replace(next);
  }

  function updateSort(sort: RecipeSort, direction: SortDirection) {
    const next = new URLSearchParams(parameters);
    if (sort === "catalog") { next.delete("sort"); next.delete("direction"); } else { next.set("sort", sort); next.set("direction", direction); }
    next.delete("cursor");
    replace(next);
  }

  function toggleCapability(capability: string) {
    if (!capability) return;
    const next = new URLSearchParams(parameters);
    const values = next.getAll("capability");
    next.delete("capability");
    for (const value of values.includes(capability) ? values.filter((value) => value !== capability) : [...values, capability]) next.append("capability", value);
    next.delete("cursor");
    replace(next);
  }

  function setVerified(on: boolean) {
    const next = new URLSearchParams(parameters);
    next.delete("qualification");
    if (on) next.delete("verified"); else next.set("verified", "0");
    next.delete("cursor");
    replace(next);
  }

  function count(facet: FilterFacet, predicate: (recipe: RecipeSummary) => boolean): number {
    return available.filter((recipe) => recipeMatches(recipe, filters, facet) && predicate(recipe)).length;
  }

  function capabilityCount(capability: string): number {
    const otherCapabilities = filters.capabilities.filter((value) => value !== capability);
    return available.filter((recipe) => {
      const facts = recipe.catalog;
      return recipeMatches(recipe, filters, "capability") && otherCapabilities.every((value) => facts.capabilities.includes(value)) && facts.capabilities.includes(capability);
    }).length;
  }

  function updateModelFamily(modelFamily: string) {
    const next = new URLSearchParams(parameters);
    if (modelFamily) next.set("model_family", modelFamily); else next.delete("model_family");
    if (filters.model && !available.some((recipe) => (!modelFamily || modelFamilyTitle(recipe) === modelFamily) && modelKey(recipe) === filters.model)) next.delete("model");
    next.delete("cursor");
    replace(next);
  }

  const modelFamilies = useMemo(() => Array.from(new Set(available.map(modelFamilyTitle))).sort(), [available]);
  const models = useMemo(() => {
    const identities = new Map<string, string>();
    for (const recipe of available.filter((item) => !filters.modelFamily || modelFamilyTitle(item) === filters.modelFamily)) identities.set(modelKey(recipe), recipe.catalog.model_title);
    const titleCounts = [...identities.values()].reduce((counts, title) => counts.set(title, (counts.get(title) ?? 0) + 1), new Map<string, number>());
    return [...identities].map(([value, title]) => [value, titleCounts.get(title) === 1 ? title : `${title} · ${value}`] as const).sort((left, right) => left[1].localeCompare(right[1]));
  }, [available, filters.modelFamily]);
  const sourceOwners = useMemo(() => foldCreators(available.map((recipe) => recipe.catalog.source_owner)).map((creator) => creator.name).sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" })), [available]);
  const repositories = useMemo(() => Array.from(new Set(available.flatMap((recipe) => recipe.catalog.source_repository ? [recipe.catalog.source_repository as string] : []))).sort(), [available]);
  const qualifications = useMemo(() => Array.from(new Set(available.map((recipe) => recipe.catalog.qualification))).sort(), [available]);
  const runtimes = useMemo(() => Array.from(new Set(available.map((recipe) => recipe.catalog.runtime_distribution))).sort(), [available]);
  const quantizations = useMemo(() => Array.from(new Set(available.flatMap((recipe) => recipe.catalog.quantizations))).sort(), [available]);
  const downloadOf = (recipe: RecipeSummary) => recipe.catalog.expected_download_bytes;
  const diskOf = (recipe: RecipeSummary) => recipe.capacity?.maximum_installed_bytes_per_node;
  const memoryOf = (recipe: RecipeSummary) => recipe.capacity?.maximum_runtime_memory_bytes_per_node;
  const downloads = useMemo(() => capacityBuckets(available.map(downloadOf)), [available]);
  const disks = useMemo(() => capacityBuckets(available.map(diskOf)), [available]);
  const memories = useMemo(() => capacityBuckets(available.map(memoryOf)), [available]);

  const typeCounts = Object.fromEntries((vocabulary?.categories ?? []).map((type) => [type.id, count("type", (recipe) => recipe.catalog.types.includes(type.id))]));
  const capabilityName = (name: string) => vocabulary ? capabilityLabel(vocabulary, name) : humanize(name);
  const sparkCounts = Object.fromEntries([...SPARK_OPTIONS.map((option) => option.value), ""].map((value) => [value, count("sparks", (recipe) => nodeCountMatches(recipe.catalog.node_count, value as typeof filters.sparks))])) as Record<typeof filters.sparks, number>;

  const applied: ActiveFilter[] = [];
  const addApplied = (key: string, label: string, parameter: string) => applied.push({ key, label, remove: () => update(parameter, "") });
  if (filters.verified) applied.push({ key: "verified", label: "Verified on Spark", remove: () => setVerified(false) });
  if (filters.query) addApplied("query", `Search: ${filters.query}`, "q");
  if (filters.type) addApplied("type", `Type: ${vocabulary ? typeLabel(vocabulary, filters.type) : filters.type}`, "type");
  if (filters.modelFamily) addApplied("modelFamily", `Model family: ${filters.modelFamily}`, "model_family");
  if (filters.model) addApplied("model", `Model: ${models.find(([value]) => value === filters.model)?.[1] ?? filters.model}`, "model");
  if (filters.quantization) addApplied("quantization", `Format: ${filters.quantization}`, "quantization");
  if (filters.abliterated) addApplied("abliterated", `Abliterated: ${filters.abliterated === "true" ? "True" : "False"}`, "abliterated");
  if (filters.sparks) addApplied("sparks", sparksFewerLabel(filters.sparks), "sparks");
  if (filters.uses) addApplied("uses", `Uses exactly ${filters.uses} ${filters.uses === 1 ? "Spark" : "Sparks"}`, "uses");
  if (filters.sourceOwner) addApplied("sourceOwner", `Creator: ${filters.sourceOwner}`, "creator");
  if (filters.updated) addApplied("updated", `Updated: last ${filters.updated} days`, "updated");
  if (filters.readiness) addApplied("readiness", `Readiness: ${READINESS_OPTIONS.find((option) => option.value === filters.readiness)?.label ?? filters.readiness}`, "readiness");
  for (const capability of filters.capabilities) applied.push({ key: `capability:${capability}`, label: `Capability: ${capabilityName(capability)}`, remove: () => toggleCapability(capability) });
  if (filters.qualification) addApplied("qualification", `Qualification: ${filters.qualification}`, "qualification");
  if (filters.repository) addApplied("repository", `Repository: ${sourceLabel(filters.repository)}`, "repository");
  if (filters.runtime) addApplied("runtime", `Runtime: ${humanize(filters.runtime)}`, "runtime");
  if (filters.download) addApplied("download", `Download: ${capacityLabel(filters.download)}`, "download");
  if (filters.disk) addApplied("disk", `Disk: ${capacityLabel(filters.disk)}`, "disk");
  if (filters.memory) addApplied("memory", `Memory: ${capacityLabel(filters.memory)}`, "memory");

  const columnProps = { activeSort: filters.sort, direction: filters.direction, onSort: updateSort };
  const bucketOptions = (facet: FilterFacet, buckets: string[], valueOf: (recipe: RecipeSummary) => number | undefined) => buckets.map((bucket) => ({ bucket, count: count(facet, (recipe) => capacityBucketMatches(valueOf(recipe), bucket)) })).filter((option) => option.count > 0 || option.bucket === filters[facet as "memory" | "disk" | "download"]).map((option) => <option key={option.bucket} value={option.bucket}>{capacityLabel(option.bucket)} ({option.count})</option>);
  // Reset restores the defaults, Verified on Spark included; it is offered when anything differs from them.
  const clearable = applied.filter((item) => item.key !== "verified");
  const resettable = clearable.length > 0 || !filters.verified;
  // The badge counts what is set inside the disclosure; search, type and Sparks sit outside it.
  const inMore = clearable.filter((item) => !["query", "type", "sparks", "uses"].includes(item.key)).length + (filters.verified ? 0 : 1);
  const resetFilters = () => replace(new URLSearchParams());

  const select = (label: string, value: string, onChange: (value: string) => void, options: ReactNode, anyLabel = "Any") => (
    <label className="catalog-more-field"><span>{label}</span><select aria-label={`Filter by ${label.toLowerCase()}`} value={value} onChange={(event) => onChange(event.target.value)}><option value="">{anyLabel}</option>{options}</select></label>
  );

  return (
    <main className="catalog-page recipes-page">
      <CatalogTabs current="recipes" />
      <header className="page-intro catalog-intro">
        <h1>Find the right recipe.</h1>
        <p>Compare immutable recipe facts, then open a recipe for its install contract. Your Controller shows this same library filtered to what fits your Sparks; local installation state stays there.</p>
      </header>

      {catalog && vocabulary ? (
        <section className="catalog-type" aria-labelledby="recipe-type-title">
          <h2 id="recipe-type-title" className="visually-hidden">What kind of model?</h2>
          <TypeTabs types={vocabulary.categories} value={filters.type} counts={typeCounts} total={count("type", () => true)} onChange={(value) => update("type", value)} />
        </section>
      ) : null}

      {catalog && vocabulary ? (
        <section className="catalog-setup catalog-setup-compact" aria-labelledby="recipe-setup-title">
          <h2 id="recipe-setup-title" className="visually-hidden">Then narrow it to your setup.</h2>
          <SparkPicker
            value={filters.sparks}
            noun="recipes"
            counts={sparkCounts}
            onChange={(value) => update("sparks", value)}
          />
        </section>
      ) : null}

      {error ? <div className="status-panel error catalog-error" role="alert"><h2>Recipes are temporarily out of reach.</h2><p>{error} Retry the public index, or inspect the version-controlled library directly.</p><div className="hero-actions"><button className="button primary" type="button" onClick={() => setRetry((value) => value + 1)}>Try again</button><a className="button" href="https://github.com/CarstVaartjes/vonk-forge-recipes">Open recipe library</a></div></div> : null}
      {!catalog && !error ? <div className="status-panel" role="status">Loading the public recipe index…</div> : null}

      {catalog && vocabulary ? <section className="catalog-browser" aria-label="Recipe results">
        <div className="catalog-toolbar">
          <input type="search" className="catalog-search" aria-label="Search recipes" value={filters.query} onChange={(event) => update("q", event.target.value)} placeholder="Search recipes…" />
          <details className="catalog-more">
            <summary>More filters{inMore ? <span className="catalog-more-count" aria-hidden="true">{inMore}</span> : null}{inMore ? <span className="visually-hidden"> ({inMore} active)</span> : null}</summary>
            <p className="catalog-more-note">My Sparks: pick how many you have and the list narrows to recipes that need that many or fewer. The pick is remembered on this device and shared with the home page. Your Controller makes the same check against the live capacity of your Sparks.</p>
            <VerifiedToggle checked={filters.verified} onChange={setVerified} />
            <div className="catalog-setup-facets">
              <FacetStrip label="Model family" value={filters.modelFamily} onChange={updateModelFamily} options={modelFamilies.map((value) => ({ value, label: value, count: count("modelFamily", (recipe) => modelFamilyTitle(recipe) === value) }))} />
              <FacetStrip label="Engine" value={filters.runtime} onChange={(value) => update("runtime", value)} options={runtimes.map((value) => ({ value, label: engineLabel(value), count: count("runtime", (recipe) => recipe.catalog.runtime_distribution === value) }))} />
              <FacetStrip label="Creator" value={filters.sourceOwner} onChange={(value) => update("creator", value)} options={sourceOwners.map((value) => ({ value, label: value, count: count("sourceOwner", (recipe) => sameCreator(recipe.catalog.source_owner, value)) }))} />
              <FacetStrip label="Quantization" value={filters.quantization} onChange={(value) => update("quantization", value)} options={quantizations.map((value) => ({ value, label: value, count: count("quantization", (recipe) => recipe.catalog.quantizations.includes(value)) }))} />
              <div className="setup-facet" role="group" aria-label="Capabilities">
                <span className="setup-facet-label">Capabilities</span>
                <div className="setup-chips">{vocabulary.capabilities.map((option) => {
                  const on = filters.capabilities.includes(option.name);
                  return <button key={option.name} type="button" aria-pressed={on} title={option.description} disabled={capabilityCount(option.name) === 0 && !on} onClick={() => toggleCapability(option.name)}>{option.label}</button>;
                })}</div>
              </div>
            </div>
            <div className="catalog-more-fields">
              {select("Memory per Spark", filters.memory, (value) => update("memory", value), bucketOptions("memory", memories, memoryOf))}
              {select("Disk per Spark", filters.disk, (value) => update("disk", value), bucketOptions("disk", disks, diskOf))}
              {select("Download size", filters.download, (value) => update("download", value), bucketOptions("download", downloads, downloadOf))}
              {select("Updated date", filters.updated, (value) => update("updated", value), (["7", "30", "90", "365"] as UpdatedFilter[]).map((value) => <option key={value} value={value} disabled={count("updated", (recipe) => updatedMatches(recipe, value)) === 0}>Last {value} days</option>))}
              {select("Execution readiness", filters.readiness, (value) => update("readiness", value), READINESS_OPTIONS.map((option) => <option key={option.value} value={option.value} disabled={count("readiness", (recipe) => recipe.catalog.execution_readiness === option.value) === 0}>{option.label}</option>))}
              {select("Qualification", filters.qualification, (value) => update("qualification", value), qualifications.map((status) => <option key={status} value={status} disabled={count("qualification", (recipe) => recipe.catalog.qualification === status) === 0}>{status}</option>))}
              {select("Abliterated", filters.abliterated, (value) => update("abliterated", value), [<option key="true" value="true" disabled={count("abliterated", recipeIsAbliterated) === 0}>True</option>, <option key="false" value="false" disabled={count("abliterated", (recipe) => !recipeIsAbliterated(recipe)) === 0}>False</option>])}
              {select("Model", filters.model, (value) => update("model", value), models.map(([value, label]) => <option key={value} value={value} disabled={count("model", (recipe) => modelKey(recipe) === value) === 0}>{label}</option>), "All")}
              {select("Original repository", filters.repository, (value) => update("repository", value), repositories.map((value) => <option key={value} value={value} disabled={count("repository", (recipe) => recipe.catalog.source_repository === value) === 0}>{sourceLabel(value)}</option>), "All")}
              <label className="catalog-more-field catalog-sort-field"><span>Sort by</span>
                <select aria-label="Sort by" value={filters.sort === "catalog" ? "catalog:desc" : `${filters.sort}:${filters.direction}`} onChange={(event) => { const [sort, direction] = event.target.value.split(":") as [RecipeSort, SortDirection]; updateSort(sort, direction); }}>
                  {SORT_CHOICES.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
                </select>
              </label>
            </div>
            <StatusLegend statuses={qualifications} vocabulary={vocabulary} />
          </details>
        </div>
        <div className="catalog-results-heading">
          <p aria-live="polite"><strong>{filtered.length}</strong> of {available.length} recipes</p>
          {resettable ? <button type="button" className="catalog-clear" onClick={resetFilters}>Reset filters <small>to Verified on Spark</small></button> : null}
          <p className="catalog-local-note">Imported, current, and update status appear only in <a href="/control">your local Controller</a>.</p>
        </div>
        {applied.length ? <div className="catalog-applied" aria-label="Applied filters">{applied.map((item) => <button type="button" key={item.key} onClick={item.remove}>{item.label}<span aria-hidden="true">×</span><span className="visually-hidden"> Remove filter</span></button>)}</div> : null}

        <div className="catalog-table-scroll">
          <table id="catalog-table" className="catalog-table">
            <caption className="visually-hidden">Publisher-submitted evidence is not a Vonk endorsement.</caption>
            <thead><tr>
              <SortHeader label="Recipe" sort="recipe" {...columnProps} />
              <SortHeader label="Sparks" sort="sparks" {...columnProps} />
              <SortHeader label="Memory / Spark" sort="memory" {...columnProps} />
              <SortHeader label="Engine" sort="runtime" {...columnProps} />
              <th scope="col"><span className="catalog-sort">Capabilities</span></th>
              <SortHeader label="Status" sort="qualification" {...columnProps} />
            </tr></thead>
            <tbody>{pageItems.map((recipe) => {
              const facts = recipe.catalog;
              const counts = recipe.capacity?.profile_node_counts ?? [];
              const meta = [facts.source_owner, facts.quantizations.join(" · "), recipe.version ? `v${recipe.version}` : null].filter(Boolean).join(" · ");
              return <tr key={`${recipe.publisher}/${recipe.slug}`}>
                <td className="catalog-table-recipe"><a href={`/recipes/${recipe.publisher}/${recipe.slug}`}>{recipe.title}</a>{meta ? <span>{meta}</span> : null}</td>
                <td className="catalog-table-number" data-label="Sparks">{counts.length ? counts.join(" / ") : facts.node_count}</td>
                <td className="catalog-table-number" data-label="Memory / Spark">{gibLabel(recipe.capacity?.maximum_runtime_memory_bytes_per_node)}</td>
                <td data-label="Engine">{engineLabel(facts.runtime_distribution)}</td>
                <td className="catalog-table-capabilities" data-label="Capabilities">{facts.capabilities.length ? facts.capabilities.map(capabilityName).join(" · ") : "—"}</td>
                <td className="catalog-table-status"><a className="badge-link" href={`#${STATUS_LEGEND_ID}`} title={vocabulary ? statusMeaning(vocabulary, facts.qualification) : undefined}><span className={`status ${facts.verified ? "ok" : "off"}`}>{facts.qualification}</span></a>{facts.execution_readiness !== "executable" ? <span className={`catalog-readiness readiness-${facts.execution_readiness}`}>{READINESS_OPTIONS.find((option) => option.value === facts.execution_readiness)?.label ?? humanize(facts.execution_readiness)}</span> : null}<span className="catalog-table-substatus">{recipe.facts?.source_bundle_observed ? "Source verified" : "Source pending"}{facts.qualification_reason ? ` · ${facts.qualification_reason}` : ""}</span></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        {filtered.length === 0 ? <div className="status-panel catalog-empty"><h2>No matching recipes.</h2><p>{filters.verified ? "Verified on Spark is on, so recipes that have not passed hardware checks on a DGX Spark are hidden. " : ""}Reset the filters to start again from Verified on Spark, or include recipes that are not yet verified.</p>{filters.verified ? <button type="button" className="button" onClick={() => setVerified(false)}>Include recipes not yet verified</button> : null}<button type="button" className="button" onClick={resetFilters}>Reset filters</button></div> : null}
        {filtered.length > PAGE_SIZE ? <nav className="catalog-pagination" aria-label="Recipe pages"><button className="button" type="button" disabled={offset === 0} onClick={() => update("cursor", String(Math.max(0, offset - PAGE_SIZE)))}>Previous page</button><span>Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, filtered.length)} of {filtered.length}</span><button className="button" type="button" disabled={offset + PAGE_SIZE >= filtered.length} onClick={() => update("cursor", String(offset + PAGE_SIZE))}>Next page</button></nav> : null}
      </section> : null}
    </main>
  );
}
