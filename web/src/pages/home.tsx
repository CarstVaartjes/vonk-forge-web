import { useEffect, useState } from "react";

import { getCatalogSummary } from "../api/client";
import { updatedThisWeek, type CatalogSummary } from "../catalog-stats";
import { isVerified } from "../qualification-status";
import { MODEL_TYPES } from "../model-types";
import { RollingNumber } from "../rolling-number";


// The four jobs Vonk Forge does for a Spark owner. Each ends with the exact
// vonkctl command that does the same thing, so the agent-friendly path is
// visible from the first screen.
const promises = [
  {
    title: "Know what fits your setup.",
    body: "Every recipe declares the memory, disk, and number of Sparks it needs. Your Controller checks that against the live capacity of the Sparks you actually have, shows what fits now, and says exactly why the rest does not.",
    command: "vonkctl recipe library --fits-fleet",
  },
  {
    title: "Stay current without the chase.",
    body: "New models, engines, and quantizations arrive faster than anyone can track by hand. The recipe library follows upstream releases and refreshes recipes in place. Your Controller syncs the signed library on its own and marks a running install stale when a newer revision exists. You decide when to update.",
    command: "vonkctl recipe update --all",
  },
  {
    title: "Run the mix you need.",
    body: "A coding model on two Sparks, a vision model on the third, an image model when you want it. Save that as a profile, review the exact plan, apply it. Switch profiles when the job changes.",
    command: "vonkctl --profile 2 profile load",
  },
  {
    title: "Click it, or script it.",
    body: "The Web Controller guides first use in a few clicks. vonkctl drives the same API with JSON output, a read-only review, and explicit consent, so scripts and AI agents operate your fleet safely.",
    command: "vonkctl run \"Qwen Code\" --yes --json",
  },
];

const setupFlow = [
  {
    title: "Install the controller",
    body: "Put one Controller on a laptop, NAS, or local server.",
  },
  {
    title: "Connect your Sparks",
    body: "Connect one or more Sparks and see which nodes are ready.",
  },
  {
    title: "Choose a model or recipe",
    body: "Choose a model for what it can do, then a recipe for the engine, settings, and number of Sparks. Filter to what fits your fleet.",
  },
  {
    title: "Prepare, run, switch",
    body: "Your Controller caches verified model files and runtime images on the NAS, then shows progress, recovery, and the next action.",
  },
];

// Three real vonkctl calls an agent or script runs in order: see what fits,
// review the exact plan, apply it without a prompt. Documented in the
// vonk-forge vonkctl runbook.
const agentSession = [
  { comment: "What fits the Sparks I have right now?", command: "vonkctl recipe library --fits-fleet --json" },
  { comment: "Show the exact plan before anything changes.", command: "vonkctl --profile 2 profile load --review --json" },
  { comment: "Apply it without a prompt; progress stays parseable.", command: "vonkctl --profile 2 profile load --yes --json" },
];

const hosts = [
  {
    name: "Your laptop",
    fit: "Fastest way to evaluate",
    needs: "Docker Compose and durable local storage",
    note: "The controller is available while the laptop is running.",
  },
  {
    name: "A NAS",
    fit: "Quiet, always-on lab",
    needs: "A Docker Compose-capable NAS",
    note: "Useful when you want the controller to stay up without a workstation.",
  },
  {
    name: "A local server",
    fit: "Shared or larger fleet",
    needs: "Docker Compose and durable storage",
    note: "A natural home for an always-on team or rack installation.",
  },
];


function StateDot({ tone = "ready" }: { tone?: "ready" | "source" }) {
  return <span className={`state-dot ${tone}`} aria-hidden="true" />;
}


function ProductShot({
  src,
  alt,
  title,
  body,
  eager = false,
}: {
  src: string;
  alt: string;
  title: string;
  body: string;
  eager?: boolean;
}) {
  return (
    <figure className="product-shot">
      <div className="product-shot-frame">
        <img
          src={src}
          alt={alt}
          width="1280"
          height="800"
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : "auto"}
        />
      </div>
      <figcaption>
        <strong>{title}</strong>
        <span>{body}</span>
      </figcaption>
    </figure>
  );
}


const number = new Intl.NumberFormat("en");

// "empty" is a valid release with nothing verified yet: there are no numbers to show.
type CatalogState = { status: "loading" } | { status: "error" } | { status: "empty" } | { status: "ready"; summary: CatalogSummary };

// Everything live on this page comes from catalog-summary.json, the small file
// the Pages build derived from the verified release (never the full index). A
// missing or malformed file is an error state, never zeros.
function useCatalogSummary(): [CatalogState, () => void] {
  const [state, setState] = useState<CatalogState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    getCatalogSummary(controller.signal)
      .then((summary) => setState(summary.verified === 0 ? { status: "empty" } : { status: "ready", summary }))
      .catch(() => { if (!controller.signal.aborted) setState({ status: "error" }); });
    return () => controller.abort();
  }, [attempt]);
  return [state, () => { setState({ status: "loading" }); setAttempt((value) => value + 1); }];
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

// The counts headline (the owner asked for it); the definition sentence stays
// directly under it. All three counts are over recipes verified on a DGX Spark.
function Hero({ state }: { state: CatalogState }) {
  const summary = state.status === "ready" ? state.summary : null;
  const top = summary ? summary.topCreators.slice(0, 3).map((creator) => creator.name) : [];
  return (
    <section className="home-hero" aria-labelledby="home-title">
      <div className="home-hero-copy">
        {state.status === "error" || state.status === "empty" ? (
          <h1 id="home-title">Verified recipes for NVIDIA DGX Spark.</h1>
        ) : (
          <h1 id="home-title" aria-busy={summary ? undefined : true}>
            <span className="hero-stat"><RollingNumber value={summary?.verified ?? null} /> recipes verified on DGX Spark.</span>
            <span className="hero-stat"><RollingNumber value={summary?.families ?? null} placeholderDigits={2} /> model families.</span>
            <span className="hero-stat"><RollingNumber value={summary?.creators ?? null} placeholderDigits={2} /> creators.</span>
          </h1>
        )}
        <p className="home-definition">
          Vonk Forge is the open-source Controller for NVIDIA DGX Spark. It
          checks every model and recipe against the Sparks you actually have,
          keeps up with new models and recipe revisions for you, and runs the
          mix you need in a few clicks or one <code>vonkctl</code> command your
          agents can drive.
        </p>
        {top.length ? (
          <p className="home-creators">
            Recipes from {joinNames(top)} and more, each shown with whether it passed hardware checks on a DGX Spark.
          </p>
        ) : null}
        <div className="hero-actions">
          <a className="button primary" href="/install">Install</a>
          <a className="button secondary" href="/recipes">Browse what runs</a>
        </div>
        <p className="hero-cli"><a className="text-link" href="/control#local-cli">See the agent-friendly CLI</a></p>
        <ul className="home-facts" aria-label="Product facts">
          <li><StateDot /> Runs on infrastructure you own</li>
          <li>Web + CLI</li>
          <li>Open source · MIT</li>
        </ul>
      </div>
      <ProductShot
        src="/product/controller-library.webp"
        alt="Vonk Forge Library showing model and recipe lists from illustrative fixture data"
        title="The real Web Controller"
        body="Fixture-backed product screen · no live fleet data"
        eager
      />
    </section>
  );
}

// Each benefit states something the system does, and the page that documents it.
const benefits = [
  {
    title: "Secure",
    body: "Installers verify release signatures and digests in their bootstrap step, and Spark packages come from a signed APT repository. Runtime images are pinned by digest. Everything runs on hardware you own: your secrets, fleet state and workloads stay on your network, and this site never receives them.",
    href: "/architecture",
    link: "How the boundary works",
  },
  {
    title: "No hassle",
    body: "One Controller on a laptop, a NAS or a local server, and a guided install. For each recipe it shows whether it fits your Sparks and why, and it keeps verified model files and images in a Controller cache (laptop, NAS or server).",
    href: "/install",
    link: "See the install steps",
  },
  {
    title: "Always current",
    body: "Recipes follow their creators' newest releases, and one only shows as Working after it passed hardware checks on a DGX Spark. Your Controller syncs the signed recipe library on its own, and vonkctl recipe update --all refreshes your cached recipes.",
    href: "/control#local-cli",
    link: "Update from the CLI",
  },
];

function BenefitTrio() {
  return (
    <section className="benefit-section" aria-labelledby="benefit-title">
      <h2 id="benefit-title" className="visually-hidden">Why run Vonk Forge</h2>
      <ul className="benefit-grid">
        {benefits.map((benefit) => (
          <li key={benefit.title}>
            <h3>{benefit.title}</h3>
            <p>{benefit.body}</p>
            <a className="text-link" href={benefit.href}>{benefit.link}</a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TypeTiles({ summary }: { summary: CatalogSummary }) {
  return (
    <section className="type-section" aria-labelledby="type-title">
      <div className="home-section-heading">
        <h2 id="type-title">What can you run?</h2>
        <p>Pick a kind of model. Each count is recipes that passed hardware checks on a DGX Spark, and the catalog opens on that type with "Verified on Spark" on.</p>
      </div>
      <ul className="type-grid">
        {MODEL_TYPES.map((type) => {
          const verified = summary.types[type.id];
          const href = verified > 0 ? `/recipes?type=${type.id}` : `/recipes?type=${type.id}&verified=0`;
          return (
            <li key={type.id}>
              <a href={href}>
                <strong>{type.tile}</strong>
                <span className="type-count">{verified > 0 ? <><b>{number.format(verified)}</b> verified</> : "None verified yet"}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function CreatorStrip({ summary }: { summary: CatalogSummary }) {
  return (
    <section className="creator-section" aria-labelledby="creator-title">
      <div className="home-section-heading">
        <h2 id="creator-title">Built by the people who run these models.</h2>
        <p>Every recipe credits the creator it comes from. These have the most recipes verified on a DGX Spark.</p>
      </div>
      <ul className="creator-strip">
        {summary.topCreators.map((creator) => (
          <li key={creator.name.toLowerCase()}>
            <a href={`/recipes?creator=${encodeURIComponent(creator.name)}`}>
              <strong>{creator.name}</strong>
              <span>{number.format(creator.verified)} verified</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function releaseLabel(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? date : new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(parsed);
}

// The library moves a recipe's release date forward every time it refreshes the
// recipe, so this row is what was updated, not what is new.
function UpdatedRow({ summary }: { summary: CatalogSummary }) {
  const week = updatedThisWeek(summary);
  const recipes = (week.recipes.length ? week.recipes : summary.newest).slice(0, 6);
  if (recipes.length === 0) return null;
  const thisWeek = week.recipes.length > 0;
  return (
    <section className="new-section" aria-labelledby="updated-title">
      <div className="home-section-heading">
        <h2 id="updated-title">{thisWeek ? "Updated this week." : "Latest updates."}</h2>
        <p>
          {thisWeek
            ? `${number.format(week.count)} ${week.count === 1 ? "recipe was" : "recipes were"} refreshed in the last seven days, to follow their creators' newest releases.`
            : "Nothing was refreshed in the last seven days. These are the most recent updates."}
          {" "}Each shows its verification status as the library published it.
        </p>
      </div>
      <ul className="new-list">
        {recipes.map((recipe) => (
          <li key={`${recipe.publisher}/${recipe.slug}`}>
            <a href={`/recipes/${recipe.publisher}/${recipe.slug}`}>
              <strong>{recipe.title}</strong>
              <span>{recipe.creator ?? recipe.publisher} · updated {releaseLabel(recipe.date)}</span>
              <span className="new-status"><StateDot tone={isVerified({ catalog: { qualification: recipe.status } }) ? "ready" : "source"} /> {recipe.status}</span>
            </a>
          </li>
        ))}
      </ul>
      {thisWeek ? <a className="text-link" href="/recipes?updated=7&verified=0">See all {number.format(week.count)} updated recipes</a> : null}
    </section>
  );
}

function CatalogSections({ state, retry }: { state: CatalogState; retry: () => void }) {
  if (state.status === "empty") return <div className="status-panel" role="status">No recipe in this release has passed hardware checks on a DGX Spark yet, so there are no numbers to show. <a href="/recipes?verified=0">Browse every recipe</a></div>;
  if (state.status === "loading") return <div className="status-panel" role="status">Reading the verified recipe library…</div>;
  if (state.status === "error") {
    return (
      <div className="status-panel error" role="alert">
        <h2>The recipe library could not be read.</h2>
        <p>The live numbers are not shown rather than guessed. Try again, or open the catalog directly.</p>
        <button className="button" type="button" onClick={retry}>Retry</button>
      </div>
    );
  }
  return (
    <>
      <TypeTiles summary={state.summary} />
      <CreatorStrip summary={state.summary} />
      <UpdatedRow summary={state.summary} />
    </>
  );
}


export function HomePage() {
  const [state, retry] = useCatalogSummary();
  return (
    <main className="home-page">
      <Hero state={state} />
      <BenefitTrio />
      <CatalogSections state={state} retry={retry} />

      <section className="promise-section" aria-labelledby="promise-title">
        <div className="home-section-heading">
          <h2 id="promise-title">What Vonk Forge does for you.</h2>
          <p>
            One Controller answers the questions that otherwise eat your evenings:
            what fits, what changed, what to run together, and how to do it
            again without clicking through it twice.
          </p>
        </div>
        <ol className="promise-grid">
          {promises.map((promise, index) => (
            <li key={promise.title}>
              <span className="promise-index">{String(index + 1).padStart(2, "0")}</span>
              <h3>{promise.title}</h3>
              <p>{promise.body}</p>
              <code className="promise-command">{promise.command}</code>
            </li>
          ))}
        </ol>
      </section>

      <section className="quickstart" aria-labelledby="quickstart-title">
        <div className="quickstart-heading">
          <h2 id="quickstart-title">Start on the computer in front of you.</h2>
          <p>
            The installer prepares a portable controller project. Run it here for
            a lab, or move the same project to an always-on host.
          </p>
        </div>
        <div className="quickstart-command quickstart-preflight">
          <span>One clear next step</span>
          <strong>Set up your Controller, then choose a model and recipe for your first run.</strong>
          <a href="/install">Set up your Controller</a>
        </div>
      </section>

      <section className="setup-section" aria-labelledby="setup-title">
        <div className="home-section-heading">
          <h2 id="setup-title">From choice to running Sparks. One visible flow.</h2>
          <p>
            Your Controller prepares the selected assets, places them for the
            recipe, starts the run, and keeps updates and recovery close by.
          </p>
        </div>
        <ol className="setup-flow">
          {setupFlow.map((step, index) => (
            <li key={step.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div><h3>{step.title}</h3><p>{step.body}</p></div>
            </li>
          ))}
        </ol>
        <a className="text-link setup-explainer-link" href="/models#model-recipe-explainer">See how models, recipes, and your Controller fit together</a>
      </section>

      <section id="product-tour" className="product-tour" aria-labelledby="tour-title">
        <div className="home-section-heading">
          <h2 id="tour-title">Two ways to drive. One Controller.</h2>
          <p>
            The browser shows what fits, what will change, what is running, and
            what needs attention. The CLI exposes the same facts and the same
            actions to scripts and agents, with nothing hidden behind a prompt.
          </p>
        </div>
        <div className="tour-grid">
          <ProductShot
            src="/product/controller-fleet.webp"
            alt="Vonk Forge Fleet showing an illustrative Spark roster, workloads, and attention state"
            title="Fleet shows reality, including blockers"
            body="Fixture-backed fleet view · illustrative test data"
          />
          <figure className="agent-session">
            <div className="agent-session-frame" aria-label="Example vonkctl session">
              <span className="agent-session-label">vonkctl · the same Controller, from a terminal or an agent</span>
              <pre><code>{agentSession.map((line, index) => (
                <span key={line.command} className="agent-session-step">
                  {index > 0 ? "\n" : ""}
                  <span className="agent-session-comment"># {line.comment}</span>{"\n"}
                  <span className="agent-session-command">{line.command}</span>{"\n"}
                </span>
              ))}</code></pre>
            </div>
            <figcaption>
              <strong>Built for scripts and AI agents</strong>
              <span>Stable JSON, a read-only review of every change, explicit consent, meaningful exit codes</span>
            </figcaption>
          </figure>
        </div>
        <div className="control-paths">
          <div><strong>Guided in the browser</strong><span>Best for first use and visual review.</span><a href="/control#web-controller">Tour the Web Controller</a></div>
          <div><strong>Repeatable in <code>vonkctl</code></strong><span>The same controller API, with explicit apply and JSON output.</span><a href="/control#local-cli">See the CLI</a></div>
        </div>
      </section>

      <section className="security-section" aria-labelledby="security-title">
        <div className="home-section-heading">
          <h2 id="security-title">Private by architecture, not by promise.</h2>
          <p>
            The public site helps you discover and verify recipes. It never becomes
            your admin surface, and it never receives authority over your Sparks.
          </p>
        </div>
        <div className="security-map" aria-label="Security boundary flow">
          <article className="source-zone">
            <span>Public source</span>
            <h3>Catalog + verified releases</h3>
            <p>Recipe metadata, verified source, installer and package identity.</p>
          </article>
          <div className="security-link"><span>verified inputs</span></div>
          <article className="local-zone">
            <span>Your local authority</span>
            <h3>Vonk Forge controller</h3>
            <p>Policy, identity, state, secrets, previews, and operator confirmation.</p>
          </article>
          <div className="security-link"><span>policy + operations</span></div>
          <article className="local-zone">
            <span>Your private compute</span>
            <h3>DGX Spark fleet</h3>
            <p>Native agents, node-local caches, runtime execution, and telemetry.</p>
          </article>
        </div>
        <div className="private-ledger">
          <strong>Never sent to this public website</strong>
          <ul>
            <li><StateDot /> Runtime secrets</li>
            <li><StateDot /> Fleet state</li>
            <li><StateDot /> Controller authority</li>
            <li><StateDot /> Model uploads</li>
          </ul>
          <a href="/architecture">Inspect the complete architecture</a>
        </div>
      </section>

      <section className="host-section" aria-labelledby="host-title">
        <div className="home-section-heading">
          <h2 id="host-title">Your controller, your choice.</h2>
          <p>
            Vonk Forge needs a local computer that can run Docker Compose. A NAS
            is convenient, not compulsory.
          </p>
        </div>
        <div className="host-table" role="table" aria-label="Controller host comparison">
          <div className="host-row host-head" role="row">
            <span role="columnheader">Host</span><span role="columnheader">Best fit</span><span role="columnheader">What it needs</span><span role="columnheader">Know before choosing</span>
          </div>
          {hosts.map((host) => (
            <div className="host-row" role="row" key={host.name}>
              <strong role="cell">{host.name}</strong><span role="cell">{host.fit}</span><span role="cell">{host.needs}</span><span role="cell">{host.note}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="home-closing" aria-labelledby="home-closing-title">
        <div>
          <h2 id="home-closing-title">Make your Sparks useful.</h2>
          <p>Install the local controller, add one Spark, and let it show you what fits.</p>
        </div>
        <div className="hero-actions">
          <a className="button primary" href="/install">Install Vonk Forge</a>
          <a className="button secondary" href="/models">Browse models and recipes</a>
        </div>
      </section>
    </main>
  );
}
