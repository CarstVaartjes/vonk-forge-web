import { useEffect, useMemo, useState, type ReactNode } from "react";

import { CatalogProblem, loadRecipeCatalog, type RecipeSummary } from "../api/client";
import {
  CAPABILITY_OPTIONS,
  READINESS_OPTIONS,
  filtersFromParameters,
  humanize,
  metadata,
  modelFamilyTitle,
  modelVersionKey,
  recipeIsAbliterated,
  recipeMatches,
  sortRecipes,
  sourceLabel,
  updatedMatches,
  type FilterFacet,
  type RecipeSort,
  type SortDirection,
  type SparkFilter,
  type UpdatedFilter,
} from "../catalog-filters";

const PAGE_SIZE = 24;

function bytes(value: number | undefined): string {
  if (value === undefined) return "Not declared";
  const gib = value / 1024 ** 3;
  return `${gib >= 10 ? gib.toFixed(0) : gib.toFixed(1)} GiB`;
}

function sizeKey(value: number | undefined): string {
  return value === undefined ? "unknown" : String(value);
}

function capabilityLabel(value: string): string {
  return CAPABILITY_OPTIONS.find((option) => option.value === value)?.label ?? humanize(value);
}

function updatedLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function distinctSizes(values: Array<number | undefined>): Array<number | undefined> {
  return [...new Map(values.map((value) => [sizeKey(value), value])).values()].sort((left, right) => {
    if (left === undefined) return 1;
    if (right === undefined) return -1;
    return left - right;
  });
}

function ColumnHeader({ label, sort, activeSort, direction, filtered, onSort, children }: {
  label: string;
  sort: RecipeSort;
  activeSort: RecipeSort;
  direction: SortDirection;
  filtered: boolean;
  onSort: (sort: RecipeSort, direction: SortDirection) => void;
  children: ReactNode;
}) {
  const active = activeSort === sort || (sort === "catalog" && activeSort === "updated");
  return (
    <th scope="col" className={filtered ? "is-filtered" : ""} aria-sort={active ? direction === "asc" ? "ascending" : "descending" : "none"}>
      <div className="catalog-column-heading">
        <span>{label}{filtered ? <i className="catalog-filter-dot" aria-label="Filtered" /> : null}</span>
        <span className="catalog-column-order" aria-label={`Order ${label}`}>
          <button type="button" className={active && direction === "asc" ? "is-active" : ""} onClick={() => onSort(sort, "asc")} aria-label={`Sort ${label} ascending`}><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 2 2.5 6h2.3v4h2.4V6h2.3L6 2Z" /></svg></button>
          <button type="button" className={active && direction === "desc" ? "is-active" : ""} onClick={() => onSort(sort, "desc")} aria-label={`Sort ${label} descending`}><svg viewBox="0 0 12 12" aria-hidden="true"><path d="m6 10 3.5-4H7.2V2H4.8v4H2.5L6 10Z" /></svg></button>
        </span>
      </div>
      <div className="catalog-column-filter">{children}</div>
    </th>
  );
}

type ActiveFilter = { key: string; label: string; remove: () => void };

export function RecipesPage({ fixedPublisher }: { fixedPublisher?: string } = {}) {
  const [parameters, setParameters] = useState(() => new URLSearchParams(window.location.search));
  const [catalog, setCatalog] = useState<RecipeSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const filters = filtersFromParameters(parameters);
  const offset = Math.max(0, Number.parseInt(parameters.get("cursor") ?? "0", 10) || 0);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    loadRecipeCatalog(controller.signal).then(setCatalog).catch((reason: unknown) => {
      if (!controller.signal.aborted) {
        setError(reason instanceof CatalogProblem ? reason.problem.detail : reason instanceof Error ? reason.message : "The public recipe index could not be loaded.");
      }
    });
    return () => controller.abort();
  }, [retry]);

  const available = useMemo(() => (catalog ?? []).filter((recipe) => !fixedPublisher || recipe.publisher === fixedPublisher), [catalog, fixedPublisher]);
  const filtered = useMemo(() => sortRecipes(available.filter((recipe) => recipeMatches(recipe, filters)), filters.sort, filters.direction), [available, filters]);
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

  function updateSort(sort: RecipeSort, direction: SortDirection) {
    const next = new URLSearchParams(parameters);
    next.set("sort", sort);
    next.set("direction", direction);
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

  function updateModelFamily(modelFamily: string) {
    const next = new URLSearchParams(parameters);
    if (modelFamily) next.set("model_family", modelFamily); else next.delete("model_family");
    if (filters.model && !available.some((recipe) => (!modelFamily || modelFamilyTitle(recipe) === modelFamily) && modelVersionKey(recipe) === filters.model)) next.delete("model");
    next.delete("cursor");
    replace(next);
  }

  const modelFamilies = useMemo(() => Array.from(new Set(available.map(modelFamilyTitle))).sort(), [available]);
  const models = useMemo(() => {
    const identities = new Map<string, string>();
    for (const recipe of available.filter((item) => !filters.modelFamily || modelFamilyTitle(item) === filters.modelFamily)) identities.set(modelVersionKey(recipe), metadata(recipe).model_version_title);
    const titleCounts = [...identities.values()].reduce((counts, title) => counts.set(title, (counts.get(title) ?? 0) + 1), new Map<string, number>());
    return [...identities].map(([value, title]) => [value, titleCounts.get(title) === 1 ? title : `${title} · ${value}`] as const).sort((left, right) => left[1].localeCompare(right[1]));
  }, [available, filters.modelFamily]);
  const sourceOwners = useMemo(() => Array.from(new Set(available.flatMap((recipe) => metadata(recipe).source_owner ? [metadata(recipe).source_owner as string] : []))).sort(), [available]);
  const repositories = useMemo(() => Array.from(new Set(available.flatMap((recipe) => metadata(recipe).source_repository ? [metadata(recipe).source_repository as string] : []))).sort(), [available]);
  const runtimes = useMemo(() => Array.from(new Set(available.map((recipe) => metadata(recipe).runtime_distribution))).sort(), [available]);
  const quantizations = useMemo(() => Array.from(new Set(available.flatMap((recipe) => metadata(recipe).quantizations))).sort(), [available]);
  const downloads = useMemo(() => distinctSizes(available.map((recipe) => metadata(recipe).expected_download_bytes)), [available]);
  const disks = useMemo(() => distinctSizes(available.map((recipe) => recipe.capacity?.maximum_installed_bytes_per_node)), [available]);
  const memories = useMemo(() => distinctSizes(available.map((recipe) => recipe.capacity?.maximum_runtime_memory_bytes_per_node)), [available]);

  const applied: ActiveFilter[] = [];
  const addApplied = (key: string, label: string, parameter: string) => applied.push({ key, label, remove: () => update(parameter, "") });
  if (filters.query) addApplied("query", `Search: ${filters.query}`, "q");
  if (filters.modelFamily) addApplied("modelFamily", `Model family: ${filters.modelFamily}`, "model_family");
  if (filters.model) addApplied("model", `Model: ${models.find(([value]) => value === filters.model)?.[1] ?? filters.model}`, "model");
  if (filters.quantization) addApplied("quantization", `Format: ${filters.quantization}`, "quantization");
  if (filters.abliterated) addApplied("abliterated", `Abliterated: ${filters.abliterated === "true" ? "True" : "False"}`, "abliterated");
  if (filters.sparks) addApplied("sparks", `Sparks: ${filters.sparks}`, "sparks");
  if (filters.sourceOwner) addApplied("sourceOwner", `Creator: ${filters.sourceOwner}`, "creator");
  if (filters.updated) addApplied("updated", `Updated: last ${filters.updated} days`, "updated");
  if (filters.readiness) addApplied("readiness", `Readiness: ${READINESS_OPTIONS.find((option) => option.value === filters.readiness)?.label ?? filters.readiness}`, "readiness");
  for (const capability of filters.capabilities) applied.push({ key: `capability:${capability}`, label: `Capability: ${capabilityLabel(capability)}`, remove: () => toggleCapability(capability) });
  if (filters.qualification) addApplied("qualification", `Qualification: ${filters.qualification === "cataloged" ? "Accepted" : "Candidate"}`, "qualification");
  if (filters.repository) addApplied("repository", `Repository: ${sourceLabel(filters.repository)}`, "repository");
  if (filters.runtime) addApplied("runtime", `Runtime: ${humanize(filters.runtime)}`, "runtime");
  if (filters.download) addApplied("download", `Download: ${filters.download === "unknown" ? "Not declared" : bytes(Number(filters.download))}`, "download");
  if (filters.disk) addApplied("disk", `Disk: ${filters.disk === "unknown" ? "Not declared" : bytes(Number(filters.disk))}`, "disk");
  if (filters.memory) addApplied("memory", `Memory: ${filters.memory === "unknown" ? "Not declared" : bytes(Number(filters.memory))}`, "memory");

  const columnProps = { activeSort: filters.sort, direction: filters.direction, onSort: updateSort };
  const clearAll = () => replace(new URLSearchParams());

  return (
    <main className="catalog-page">
      <header className="page-intro catalog-intro">
        <h1>{fixedPublisher ? `${fixedPublisher} recipes` : "Find the right recipe."}</h1>
        <p>Compare immutable catalog facts, then open a recipe for its install contract. Local installation state stays inside your Controller.</p>
      </header>

      {error ? <div className="status-panel error catalog-error" role="alert"><h2>Recipes are temporarily out of reach.</h2><p>{error} Retry the public index, or inspect the version-controlled library directly.</p><div className="hero-actions"><button className="button primary" type="button" onClick={() => setRetry((value) => value + 1)}>Try again</button><a className="button" href="https://github.com/CarstVaartjes/vonk-forge-recipes">Open recipe library</a></div></div> : null}
      {!catalog && !error ? <div className="status-panel" role="status">Loading the public recipe index…</div> : null}

      {catalog ? <section className="catalog-browser" aria-label="Recipe results">
        <div className="catalog-results-heading">
          <div><p aria-live="polite"><strong>{filtered.length}</strong> of {available.length} recipes</p><small>Filter and order the list from its column headings.</small></div>
          <p className="catalog-local-note">Imported, current, and update status appear only in <a href="/control">your local Controller</a>.</p>
          {applied.length ? <button type="button" className="catalog-clear" onClick={clearAll}>Clear {applied.length} filter{applied.length === 1 ? "" : "s"}</button> : null}
        </div>
        {applied.length ? <div className="catalog-applied" aria-label="Applied filters">{applied.map((item) => <button type="button" key={item.key} onClick={item.remove}>{item.label}<span aria-hidden="true">×</span><span className="visually-hidden"> Remove filter</span></button>)}</div> : null}

        <div className="catalog-table-scroll" role="region" aria-label="Recipe list" tabIndex={0}>
          <table className="catalog-table">
            <caption className="visually-hidden">Publisher-submitted evidence is not a Vonk endorsement.</caption>
            <thead><tr>
              <ColumnHeader label="Recipe" sort="recipe" filtered={Boolean(filters.query)} {...columnProps}><input type="search" aria-label="Search recipes" value={filters.query} onChange={(event) => update("q", event.target.value)} placeholder="Search…" /></ColumnHeader>
              <ColumnHeader label="Model family" sort="modelFamily" filtered={Boolean(filters.modelFamily)} {...columnProps}><select aria-label="Filter by model family" value={filters.modelFamily} onChange={(event) => updateModelFamily(event.target.value)}><option value="">All families</option>{modelFamilies.map((value) => <option key={value} value={value} disabled={count("modelFamily", (recipe) => modelFamilyTitle(recipe) === value) === 0}>{value}</option>)}</select></ColumnHeader>
              <ColumnHeader label="Model" sort="model" filtered={Boolean(filters.model)} {...columnProps}><select aria-label="Filter by model" value={filters.model} onChange={(event) => update("model", event.target.value)}><option value="">All models</option>{models.map(([value, label]) => <option key={value} value={value} disabled={count("model", (recipe) => modelVersionKey(recipe) === value) === 0}>{label}</option>)}</select></ColumnHeader>
              <ColumnHeader label="Format" sort="quantization" filtered={Boolean(filters.quantization)} {...columnProps}><select aria-label="Filter by quantization" value={filters.quantization} onChange={(event) => update("quantization", event.target.value)}><option value="">Any format</option>{quantizations.map((value) => <option key={value} value={value} disabled={count("quantization", (recipe) => metadata(recipe).quantizations.includes(value)) === 0}>{value}</option>)}</select></ColumnHeader>
              <ColumnHeader label="Runtime" sort="runtime" filtered={Boolean(filters.runtime)} {...columnProps}><select aria-label="Filter by runtime" value={filters.runtime} onChange={(event) => update("runtime", event.target.value)}><option value="">All runtimes</option>{runtimes.map((value) => <option key={value} value={value} disabled={count("runtime", (recipe) => metadata(recipe).runtime_distribution === value) === 0}>{humanize(value)}</option>)}</select></ColumnHeader>
              <ColumnHeader label="Abliterated" sort="abliterated" filtered={Boolean(filters.abliterated)} {...columnProps}><select aria-label="Filter by abliterated" value={filters.abliterated} onChange={(event) => update("abliterated", event.target.value)}><option value="">True or False</option><option value="true" disabled={count("abliterated", recipeIsAbliterated) === 0}>True</option><option value="false" disabled={count("abliterated", (recipe) => !recipeIsAbliterated(recipe)) === 0}>False</option></select></ColumnHeader>
              <ColumnHeader label="Sparks" sort="sparks" filtered={Boolean(filters.sparks)} {...columnProps}><select aria-label="Filter by required Sparks" value={filters.sparks} onChange={(event) => update("sparks", event.target.value)}><option value="">Any count</option>{(["1", "2", "3", "4+"] as SparkFilter[]).map((value) => <option key={value} value={value} disabled={count("sparks", (recipe) => value === "4+" ? metadata(recipe).node_count >= 4 : metadata(recipe).node_count === Number(value)) === 0}>{value}{value === "1" ? " Spark" : " Sparks"}</option>)}</select></ColumnHeader>
              <ColumnHeader label="Creator" sort="creator" filtered={Boolean(filters.sourceOwner)} {...columnProps}><select aria-label="Filter by recipe creator" value={filters.sourceOwner} onChange={(event) => update("creator", event.target.value)}><option value="">All creators</option>{sourceOwners.map((value) => <option key={value} value={value} disabled={count("sourceOwner", (recipe) => metadata(recipe).source_owner === value) === 0}>{value}</option>)}</select></ColumnHeader>
              <ColumnHeader label="Updated" sort="catalog" filtered={Boolean(filters.updated)} {...columnProps}><select aria-label="Filter by updated date" value={filters.updated} onChange={(event) => update("updated", event.target.value)}><option value="">Any time</option>{(["7", "30", "90", "365"] as UpdatedFilter[]).map((value) => <option key={value} value={value} disabled={count("updated", (recipe) => updatedMatches(recipe, value)) === 0}>Last {value} days</option>)}</select></ColumnHeader>
              <ColumnHeader label="Readiness" sort="readiness" filtered={Boolean(filters.readiness)} {...columnProps}><select aria-label="Filter by execution readiness" value={filters.readiness} onChange={(event) => update("readiness", event.target.value)}><option value="">Any readiness</option>{READINESS_OPTIONS.map((option) => <option key={option.value} value={option.value} disabled={count("readiness", (recipe) => metadata(recipe).execution_readiness === option.value) === 0}>{option.label}</option>)}</select></ColumnHeader>
              <ColumnHeader label="Capabilities" sort="capability" filtered={filters.capabilities.length > 0} {...columnProps}><select aria-label="Filter by capability" value="" onChange={(event) => toggleCapability(event.target.value)}><option value="">{filters.capabilities.length ? `${filters.capabilities.length} selected · add…` : "Any capability"}</option>{CAPABILITY_OPTIONS.map((option) => <option key={option.value} value={option.value} disabled={capabilityCount(option.value) === 0 && !filters.capabilities.includes(option.value)}>{filters.capabilities.includes(option.value) ? `Remove ${option.label}` : option.label}</option>)}</select></ColumnHeader>
              <ColumnHeader label="Qualification" sort="qualification" filtered={Boolean(filters.qualification)} {...columnProps}><select aria-label="Filter by qualification" value={filters.qualification} onChange={(event) => update("qualification", event.target.value)}><option value="">Any status</option><option value="cataloged" disabled={count("qualification", (recipe) => metadata(recipe).qualification === "cataloged") === 0}>Accepted</option><option value="candidate" disabled={count("qualification", (recipe) => metadata(recipe).qualification === "candidate") === 0}>Candidate</option></select></ColumnHeader>
              <ColumnHeader label="Repository" sort="repository" filtered={Boolean(filters.repository)} {...columnProps}><select aria-label="Filter by original repository" value={filters.repository} onChange={(event) => update("repository", event.target.value)}><option value="">All repositories</option>{repositories.map((value) => <option key={value} value={value} disabled={count("repository", (recipe) => metadata(recipe).source_repository === value) === 0}>{sourceLabel(value)}</option>)}</select></ColumnHeader>
              <ColumnHeader label="Download" sort="download" filtered={Boolean(filters.download)} {...columnProps}><select aria-label="Filter by download size" value={filters.download} onChange={(event) => update("download", event.target.value)}><option value="">Any size</option>{downloads.map((value) => <option key={sizeKey(value)} value={sizeKey(value)}>{bytes(value)}</option>)}</select></ColumnHeader>
              <ColumnHeader label="Disk / Spark" sort="disk" filtered={Boolean(filters.disk)} {...columnProps}><select aria-label="Filter by disk per Spark" value={filters.disk} onChange={(event) => update("disk", event.target.value)}><option value="">Any size</option>{disks.map((value) => <option key={sizeKey(value)} value={sizeKey(value)}>{bytes(value)}</option>)}</select></ColumnHeader>
              <ColumnHeader label="Memory / Spark" sort="memory" filtered={Boolean(filters.memory)} {...columnProps}><select aria-label="Filter by memory per Spark" value={filters.memory} onChange={(event) => update("memory", event.target.value)}><option value="">Any size</option>{memories.map((value) => <option key={sizeKey(value)} value={sizeKey(value)}>{bytes(value)}</option>)}</select></ColumnHeader>
            </tr></thead>
            <tbody>{pageItems.map((recipe) => {
              const facts = metadata(recipe);
              const counts = recipe.capacity?.profile_node_counts ?? [];
              return <tr key={`${recipe.publisher}/${recipe.slug}`}>
                <td className="catalog-table-recipe"><h2><a href={`/recipes/${recipe.publisher}/${recipe.slug}`}>{recipe.title}</a></h2><span>{recipe.publisher}/{recipe.slug}</span><span>{recipe.version ? `v${recipe.version}` : `rev ${recipe.revision_number}`} · {recipe.content_sha256.slice(0, 10)}…</span></td>
                <td><strong>{modelFamilyTitle(recipe)}</strong></td>
                <td className="catalog-table-model"><strong>{facts.model_version_title}</strong><span>{facts.model_version_publisher}/{facts.model_version_slug}</span></td>
                <td>{facts.quantizations.length ? facts.quantizations.join(" · ") : "—"}</td>
                <td>{humanize(recipe.runtime.adapter ?? facts.runtime_distribution)}</td>
                <td>{recipeIsAbliterated(recipe) ? "True" : "False"}</td>
                <td className="catalog-table-number">{counts.length ? counts.join(" / ") : facts.node_count}</td>
                <td>{facts.source_owner ?? "—"}</td>
                <td className="catalog-table-date">{updatedLabel(recipe.published_at)}</td>
                <td><span className={`catalog-readiness readiness-${facts.execution_readiness}`}>{READINESS_OPTIONS.find((option) => option.value === facts.execution_readiness)?.label ?? humanize(facts.execution_readiness)}</span></td>
                <td>{facts.capabilities.length ? facts.capabilities.map(capabilityLabel).join(" · ") : "—"}</td>
                <td><span className={`badge ${facts.qualification === "cataloged" ? "accepted" : "candidate"}`}>{facts.qualification === "cataloged" ? "Accepted" : "Candidate"}</span><span className="catalog-table-substatus">{recipe.facts?.source_bundle_observed ? "Source verified" : "Source pending"} · {recipe.facts?.publisher_tested ? "Publisher-tested" : "No accepted test report"}</span></td>
                <td>{facts.source_repository ? <a className="catalog-source-link" href={facts.source_repository}>{sourceLabel(facts.source_repository)}</a> : "—"}</td>
                <td className="catalog-table-number">{bytes(facts.expected_download_bytes)}</td>
                <td className="catalog-table-number">{bytes(recipe.capacity?.maximum_installed_bytes_per_node)}</td>
                <td className="catalog-table-number">{bytes(recipe.capacity?.maximum_runtime_memory_bytes_per_node)}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        {filtered.length === 0 ? <div className="status-panel catalog-empty"><h2>No matching recipes.</h2><p>Clear one or more column filters to broaden the catalog.</p><button type="button" className="button" onClick={clearAll}>Clear filters</button></div> : null}
        {filtered.length > PAGE_SIZE ? <nav className="catalog-pagination" aria-label="Recipe pages"><button className="button" type="button" disabled={offset === 0} onClick={() => update("cursor", String(Math.max(0, offset - PAGE_SIZE)))}>Previous page</button><span>Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, filtered.length)} of {filtered.length}</span><button className="button" type="button" disabled={offset + PAGE_SIZE >= filtered.length} onClick={() => update("cursor", String(offset + PAGE_SIZE))}>Next page</button></nav> : null}
      </section> : null}
    </main>
  );
}
