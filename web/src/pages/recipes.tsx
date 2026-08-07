import { useEffect, useState } from "react";

import { CatalogProblem, listRecipes, type RecipePage, type RecipeSummary } from "../api/client";


function bytes(value: number | undefined): string {
  if (value === undefined) return "Not declared";
  const gib = value / 1024 ** 3;
  return `${gib >= 10 ? gib.toFixed(0) : gib.toFixed(1)} GiB`;
}

export function RecipeCard({ recipe }: { recipe: RecipeSummary }) {
  const perNode = recipe.resources?.per_node;
  return (
    <article className="recipe-card">
      <div className="card-heading">
        <div>
          <p className="recipe-path">{recipe.publisher}/{recipe.slug}</p>
          <h2><a href={`/recipes/${recipe.publisher}/${recipe.slug}`}>{recipe.title}</a></h2>
        </div>
        <span className={`badge ${recipe.official ? "official" : "community"}`}>
          {recipe.official ? "Official" : "Community"}
        </span>
      </div>
      {recipe.moderation_warning ? <p className="warning" role="status">{recipe.moderation_warning}</p> : null}
      <dl className="recipe-facts">
        <div><dt>Runtime</dt><dd>{recipe.runtime?.family ?? "Unknown"}</dd></div>
        <div><dt>Topology</dt><dd>{recipe.topology?.kind === "gang" ? `${recipe.topology.min_nodes}–${recipe.topology.max_nodes} nodes` : "Single Spark"}</dd></div>
        <div><dt>Disk / node</dt><dd>{bytes(perNode?.installed_bytes)}</dd></div>
        <div><dt>RAM / node</dt><dd>{bytes(perNode?.resident_memory_bytes)}</dd></div>
      </dl>
      <div className="trust-row" aria-label="Evidence provenance">
        <span>Declared</span>
        <span>{recipe.facts?.registry_observed ? "Registry observed" : "Registry pending"}</span>
        <span>{recipe.facts?.publisher_tested ? "Publisher-tested" : "No accepted test report"}</span>
      </div>
      {recipe.provenance?.source_kind === "fork" ? (
        <p className="evidence-note">Fork · {recipe.provenance.source_reference}</p>
      ) : null}
      <p className="hash">Image · {recipe.runtime?.image ?? "Not declared"}</p>
      {recipe.artifacts?.[0] ? (
        <p className="hash">
          Weights · {recipe.artifacts[0].repository}@{recipe.artifacts[0].revision}
        </p>
      ) : null}
      <p className="evidence-note">Publisher-submitted evidence is not a Vonk endorsement.</p>
      <p className="hash">rev {recipe.revision_number} · sha256:{recipe.content_sha256}</p>
    </article>
  );
}

export function RecipesPage({ fixedPublisher }: { fixedPublisher?: string } = {}) {
  const [parameters, setParameters] = useState(
    () => new URLSearchParams(window.location.search),
  );
  const [page, setPage] = useState<RecipePage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const effective = new URLSearchParams(parameters);
  if (fixedPublisher) effective.set("publisher", fixedPublisher);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    listRecipes(effective, controller.signal)
      .then(setPage)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof CatalogProblem ? reason.problem.detail : "The catalog could not be loaded.");
        }
      });
    return () => controller.abort();
  }, [effective.toString()]);

  function update(name: string, value: string) {
    const next = new URLSearchParams(parameters);
    if (value) next.set(name, value); else next.delete(name);
    next.delete("cursor");
    window.history.replaceState(null, "", `${window.location.pathname}${next.toString() ? `?${next}` : ""}`);
    setParameters(next);
  }

  return (
    <main className="catalog-page">
      <header className="page-intro">
        <p className="eyebrow">Public recipe catalog</p>
        <h1>{fixedPublisher ? `${fixedPublisher} recipes` : "Find the right fire."}</h1>
        <p>Filter immutable recipes by what your Spark cluster can actually install and run.</p>
      </header>
      <form className="filters" aria-label="Recipe filters" onSubmit={(event) => event.preventDefault()}>
        <label>Search<input aria-label="Search recipes" value={parameters.get("q") ?? ""} onChange={(event) => update("q", event.target.value)} /></label>
        <label>Runtime<select aria-label="Runtime" value={parameters.get("runtime") ?? ""} onChange={(event) => update("runtime", event.target.value)}><option value="">Any runtime</option><option value="vllm">vLLM</option><option value="sglang">SGLang</option><option value="llama.cpp">llama.cpp</option><option value="ds4">DS4</option></select></label>
        <label>Topology<select aria-label="Topology" value={parameters.get("topology") ?? ""} onChange={(event) => update("topology", event.target.value)}><option value="">Any topology</option><option value="single">Single Spark</option><option value="gang">Multi-node</option></select></label>
        <label>Publisher<select aria-label="Publisher kind" value={parameters.get("official") ?? ""} onChange={(event) => update("official", event.target.value)}><option value="">Official + community</option><option value="true">Official</option><option value="false">Community</option></select></label>
        <label>Sort<select aria-label="Sort" value={parameters.get("sort") ?? "newest"} onChange={(event) => update("sort", event.target.value)}><option value="newest">Newest</option><option value="title">Title</option><option value="disk">Lowest disk</option><option value="memory">Lowest RAM</option></select></label>
      </form>
      {error ? <div className="status-panel error" role="alert">{error}</div> : null}
      {!page && !error ? <div className="status-panel" role="status">Heating the forge…</div> : null}
      {page?.items.length === 0 ? <div className="status-panel">No recipes match these filters.</div> : null}
      <div className="recipe-grid">{page?.items.map((recipe) => <RecipeCard key={`${recipe.publisher}/${recipe.slug}`} recipe={recipe} />)}</div>
      {page?.next_cursor ? <button className="button" type="button" onClick={() => update("cursor", page.next_cursor ?? "")}>Next page</button> : null}
    </main>
  );
}
