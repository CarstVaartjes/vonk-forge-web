import { useEffect, useState } from "react";

import { getRecipe, type RecipeDetail } from "../api/client";


export function RecipeDetailPage({ publisher, slug }: { publisher: string; slug: string }) {
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    getRecipe(publisher, slug, controller.signal)
      .then(setRecipe)
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [publisher, slug]);
  useEffect(() => {
    if (!recipe) return;
    document.title = `${recipe.title} · Vonk Forge`;
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.append(canonical);
    }
    canonical.href = `${window.location.origin}/recipes/${recipe.publisher}/${recipe.slug}`;
  }, [recipe]);
  if (error) return <main className="status-panel error"><h1>Recipe unavailable</h1><p>It may be hidden, removed from listings, or the catalog may be offline.</p></main>;
  if (!recipe) return <main className="status-panel" role="status">Loading immutable recipe…</main>;
  return (
    <main className="detail-page" itemScope itemType="https://schema.org/SoftwareApplication">
      <meta itemProp="name" content={recipe.title} />
      <meta itemProp="version" content={`sha256:${recipe.content_sha256}`} />
      <meta itemProp="applicationCategory" content="AIApplication" />
      <p className="eyebrow">{recipe.official ? "Official recipe" : "Community recipe"}</p>
      <h1>{recipe.title}</h1>
      <p className="recipe-path">{recipe.publisher}/{recipe.slug} · {recipe.version ? `version ${recipe.version}` : `revision ${recipe.revision_number}`}</p>
      {recipe.moderation_warning ? <div className="warning" role="alert">{recipe.moderation_warning}</div> : null}
      <section className="boundary"><h2>Trust, precisely stated</h2><ul className="trust-list"><li>Recipe fields: publisher declared</li><li>Source: {recipe.facts?.source_bundle_observed ? "canonical bundle verified by Vonk" : "source validation unavailable"}</li><li>Runtime test: {recipe.facts?.publisher_tested ? "publisher-submitted test accepted" : "no accepted publisher test"}</li><li>Vonk-certified execution: no</li></ul></section>
      <section className="boundary"><h2>Import locally</h2><p>{recipe.import?.instruction}</p><code>{recipe.import?.uri}</code></section>
      <section className="boundary"><h2>Build on this recipe</h2><p>Use this exact immutable revision as a source for a reviewed update or a new recipe. Attribution remains attached and the result must pass its own validation.</p><a className="button" href={recipe.source?.recipe_url ?? `/publish?fork_revision=${encodeURIComponent(recipe.revision_id)}`}>{recipe.source?.recipe_url ? "Inspect recipe source" : "Fork into my publisher"}</a></section>
      <section className="boundary"><h2>Immutable payload references</h2>{recipe.source?.recipe_url ? <><p>Recipe source</p><a href={recipe.source.recipe_url}><code>sha256:{recipe.content_sha256}</code></a></> : null}<p>Build source</p><a href={recipe.source?.bundle_url ?? `/v1/source-bundles/${recipe.build?.context?.sha256}`}><code>sha256:{recipe.build?.context?.sha256}</code></a><p>Dockerfile</p><code>{recipe.build?.dockerfile}</code><p>Weights</p>{recipe.artifacts?.map((artifact) => <code key={`${artifact.repository}/${artifact.revision}`}>{artifact.repository}@{artifact.revision} · {artifact.download_bytes} bytes</code>)}</section>
      <details><summary>Immutable recipe JSON</summary><pre>{JSON.stringify(recipe.latest_revision.document, null, 2)}</pre></details>
    </main>
  );
}
