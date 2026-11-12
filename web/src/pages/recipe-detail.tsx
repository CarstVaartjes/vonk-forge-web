import { useEffect, useState } from "react";

import { getRecipe, getVocabulary, type RecipeDetail } from "../api/client";
import { CommandBlock } from "../command-block";
import { engineLabel, gibLabel, sourceLabel } from "../catalog-filters";
import { usePageMeta } from "../page-meta";
import { STATUS_LEGEND_ID } from "../status-legend";
import { capabilityLabel, statusMeaning, type Vocabulary } from "../vocabulary";


const recipeAuthoringGuide = "https://github.com/CarstVaartjes/vonk-forge-recipes#recipe-contract";


export function RecipeDetailPage({ publisher, slug }: { publisher: string; slug: string }) {
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [error, setError] = useState(false);
  // The release words for capabilities and statuses. Without them the page still shows the raw names.
  const [vocabulary, setVocabulary] = useState<Vocabulary | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    getVocabulary(controller.signal).then(setVocabulary).catch(() => undefined);
    return () => controller.abort();
  }, []);
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
  usePageMeta(recipe?.title ?? "Recipe", recipe ? `${recipe.title}: a recipe for NVIDIA DGX Spark, with its published verification status and install contract.` : "A Vonk Forge recipe for NVIDIA DGX Spark.");
  useEffect(() => {
    if (!recipe) return;
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
  const { catalog, capacity, evidence, chat_api: chat, settings, license } = recipe;
  const sparks = catalog.node_count;
  const sparksLabel = sparks === 1 ? "single Spark" : `${sparks} Sparks`;
  const meaning = vocabulary ? statusMeaning(vocabulary, catalog.qualification) : undefined;
  const capabilities = catalog.capabilities.map((name) => (vocabulary ? capabilityLabel(vocabulary, name) : name));
  const model = [catalog.model_title, catalog.quantizations[0] ? `${catalog.quantizations[0]} quantization` : catalog.precision].filter(Boolean).join(" · ");
  return (
    <main className="detail-page" itemScope itemType="https://schema.org/SoftwareApplication">
      <meta itemProp="name" content={recipe.title} />
      <meta itemProp="version" content={`sha256:${recipe.content_sha256}`} />
      <meta itemProp="applicationCategory" content="AIApplication" />
      <p className="crumb">
        <a href="/recipes">Catalog</a> / <a href={`/models/${catalog.model_publisher}/${catalog.model_slug}`}>{catalog.model_family || catalog.model_title}</a> / {engineLabel(catalog.runtime_distribution)}, {sparksLabel}
      </p>
      <header className="detail-head">
        <div>
          <h1>{recipe.title}</h1>
          <p className="byline">
            {catalog.source_owner ? <span>Recipe by <a href={`https://github.com/${catalog.source_owner}`}>{catalog.source_owner}</a></span> : null}
            <span className="tag official">{recipe.official ? "Official recipe" : "Community recipe"}</span>
            {recipe.version ? <span className="tag">v{recipe.version}</span> : null}
            {recipe.published_at ? <span>released {recipe.published_at}</span> : null}
          </p>
        </div>
        <div className={`verdict ${catalog.verified ? "ok" : ""}`}>
          <span className={`status ${catalog.verified ? "ok" : "off"}`}>{catalog.qualification}</span>
          <small>
            {catalog.verified && evidence ? `Passed hardware checks on ${evidence.spark_count} DGX Spark${evidence.spark_count === 1 ? "" : "s"}, ${dateLabel(evidence.tested_at)}.` : (meaning ?? catalog.qualification_reason ?? "")}{" "}
            <a href={`/recipes#${STATUS_LEGEND_ID}`}>What this means</a>
          </small>
        </div>
      </header>
      {recipe.moderation_warning ? <div className="warning" role="alert">{recipe.moderation_warning}</div> : null}

      <dl className="facts">
        <div><dt>Sparks</dt><dd>{sparks}<small>{sparksLabel}</small></dd></div>
        <div><dt>Engine</dt><dd>{engineLabel(catalog.runtime_distribution)}</dd></div>
        <div><dt>Memory per Spark</dt><dd>{gibLabel(capacity?.maximum_runtime_memory_bytes_per_node, 1)}<small>declared by the recipe</small></dd></div>
        <div><dt>Disk per Spark</dt><dd>{gibLabel(capacity?.maximum_installed_bytes_per_node, 1)}<small>{gibLabel(catalog.expected_download_bytes || undefined, 1)} model files</small></dd></div>
      </dl>

      <section className="run" aria-labelledby="run-title">
        <div>
          <h2 id="run-title">Run it</h2>
          <CommandBlock label="Workstation terminal">{`vonkctl run ${shellQuote(recipe.title)}`}</CommandBlock>
        </div>
        <div className="run-note">
          <p>Or open Library in your Controller and choose this recipe. Your Controller checks the memory and disk it needs against your Sparks before it runs anything.</p>
          <p>No Controller yet? <a className="text-link" href="/install">Install in two commands</a></p>
        </div>
      </section>

      <div className="detail-columns">
        <div>
          <section className="detail-block">
            <h2>What it can do</h2>
            <ul className="caps">
              {capabilities.map((label) => <li key={label}>{check}{label}</li>)}
              {chat?.streaming ? <li>{check}Streaming</li> : null}
              {chat?.structured_output ? <li>{check}Structured output</li> : null}
              {chat && !chat.image_input ? <li className="no">No image input</li> : null}
              {chat && !chat.audio_input ? <li className="no">No audio input</li> : null}
            </ul>
          </section>
          <section className="detail-block">
            <h2>About this recipe</h2>
            <p className="desc">{catalog.description}</p>
          </section>
        </div>
        <section className="detail-block">
          <h2>Details</h2>
          <dl className="kv">
            <div><dt>Model</dt><dd>{model || "Not declared"}</dd></div>
            {chat ? <div><dt>API</dt><dd>{chat.endpoints.join(" · ")}</dd></div> : null}
            <div><dt>Context</dt><dd>{settings.context_tokens === undefined ? "Not declared" : `${settings.context_tokens.toLocaleString("en")} tokens${settings.concurrency === undefined ? "" : ` · ${settings.concurrency} concurrent requests`} (recipe defaults)`}</dd></div>
            <div>
              <dt>Licence</dt>
              <dd>
                {license.spdx ?? "Not declared"}{license.url ? <> · <a href={license.url}>read the model card</a></> : null}
                <span className="kv-note">Shown for information. Use is your call.</span>
              </dd>
            </div>
            <div><dt>Source</dt><dd>{catalog.source_repository ? <a href={catalog.source_repository}>{sourceLabel(catalog.source_repository)}</a> : "Not declared"}</dd></div>
          </dl>
          <details className="provenance">
            <summary>Provenance</summary>
            <div className="provenance-body">
              <section><h3>Trust, precisely stated</h3><ul className="trust-list"><li>Recipe fields: publisher declared</li><li>Source: {recipe.facts?.source_bundle_observed ? "canonical bundle verified by Vonk" : "source validation unavailable"}</li><li>Hardware qualification: {catalog.qualification}{catalog.qualification_reason ? ` (${catalog.qualification_reason})` : ""}</li><li>Vonk-certified execution: no</li></ul></section>
              <section><h3>Download to your Controller</h3><p>Choose Download, Run, or Switch in your local Controller for this exact recipe package. The public site cannot see your NAS cache or running state.</p><div className="hero-actions"><a className="button" href="/control#library-import">Open Controller instructions</a>{recipe.source?.recipe_url ? <a className="button" href={recipe.source.recipe_url}>View source</a> : null}{recipe.source?.bundle_url ? <a className="button" href={recipe.source.bundle_url}>View adapter source</a> : null}</div><code>{recipe.import?.uri}</code>{recipe.package ? <small className="package-fact">Package {recipe.package.member} · {recipe.package.media_type} · {recipe.package.bytes.toLocaleString()} bytes · sha256:{recipe.package.sha256}</small> : null}</section>
              <section><h3>Author the next version</h3><p>Use the recipe repository to propose a reviewed update or a new recipe. Attribution and exact source details stay with the repository.</p><a className="button" href={recipe.source?.recipe_url ?? recipeAuthoringGuide}>{recipe.source?.recipe_url ? "Inspect recipe source" : "Read the authoring guide"}</a></section>
              <section><h3>Immutable payload references</h3>{recipe.source?.recipe_url ? <><p>Recipe source</p><a href={recipe.source.recipe_url}><code>sha256:{recipe.content_sha256}</code></a></> : null}<p>Build source</p>{recipe.source?.bundle_url ? <a href={recipe.source.bundle_url}><code>Build source</code></a> : <span>Not declared</span>}<p>Dockerfile</p><code>{recipe.build?.dockerfile || "Not declared"}</code><p>Weights</p>{recipe.artifacts?.map((artifact, index) => <code key={`${artifact.repository}/${artifact.revision}/${artifact.download_bytes}/${index}`}>{artifact.repository}@{artifact.revision} · {artifact.download_bytes} bytes</code>)}</section>
              <details><summary>Immutable recipe JSON</summary><pre>{JSON.stringify(recipe.latest_revision.document, null, 2)}</pre></details>
            </div>
          </details>
        </section>
      </div>
    </main>
  );
}

const check = <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false"><path d="M3 8.5l3.2 3L13 4.5" /></svg>;

function dateLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

// The title is the selector `vonkctl run` takes; quote it so any title pastes as one argument.
function shellQuote(title: string): string {
  return /["$`\\!]/.test(title) ? `'${title.replaceAll("'", "'\\''")}'` : `"${title}"`;
}
