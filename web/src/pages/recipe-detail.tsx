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
    <main className="detail-page">
      <p className="eyebrow">{recipe.official ? "Official recipe" : "Community recipe"}</p>
      <h1>{recipe.title}</h1>
      <p className="recipe-path">{recipe.publisher}/{recipe.slug} · revision {recipe.revision_number}</p>
      {recipe.moderation_warning ? <div className="warning" role="alert">{recipe.moderation_warning}</div> : null}
      <section className="boundary"><h2>Trust, precisely stated</h2><ul className="trust-list"><li>Recipe fields: publisher declared</li><li>Image: {recipe.facts?.registry_observed ? "digest and ARM64 metadata observed by Vonk" : "registry validation unavailable"}</li><li>Runtime test: {recipe.facts?.publisher_tested ? "publisher-submitted test accepted" : "no accepted publisher test"}</li><li>Vonk-certified execution: no</li></ul></section>
      <section className="boundary"><h2>Import locally</h2><p>{recipe.import?.instruction}</p><code>{recipe.import?.uri}</code></section>
      <section className="boundary"><h2>Build on this recipe</h2><p>Fork this exact immutable revision into your own private publisher draft. Attribution remains attached and the fork must pass its own validation.</p><a className="button" href={`/publish?fork_revision=${encodeURIComponent(recipe.revision_id)}`}>Fork into my publisher</a></section>
      <section className="boundary"><h2>Immutable payload references</h2><p>Container</p><code>{recipe.runtime?.image}</code><p>Weights</p>{recipe.artifacts?.map((artifact) => <code key={`${artifact.repository}/${artifact.revision}`}>{artifact.repository}@{artifact.revision} · {artifact.expected_bytes} bytes</code>)}</section>
      <details><summary>Immutable recipe JSON</summary><pre>{JSON.stringify(recipe.latest_revision.document, null, 2)}</pre></details>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "SoftwareApplication", name: recipe.title, version: `sha256:${recipe.content_sha256}`, applicationCategory: "AIApplication" }) }} />
    </main>
  );
}
