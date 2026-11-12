import { useEffect, useState } from "react";

import { getCatalogSummary } from "../api/client";
import type { CatalogSummary } from "../catalog-stats";
import { CommandBlock } from "../command-block";
import { MODEL_TYPES } from "../model-types";
import { RollingNumber } from "../rolling-number";


// What the Controller does for a Spark owner, in one sentence each. The
// vonkctl calls that do the same things are the agent session below.
const points = [
  {
    title: "Know what fits.",
    body: "Every recipe declares the memory, disk and number of Sparks it needs. Your Controller checks that against your live fleet and says exactly why the rest does not fit.",
  },
  {
    title: "Stay current.",
    body: "The recipe library follows upstream releases and refreshes recipes in place. Your Controller syncs it on its own and marks a running install stale; you decide when to update.",
  },
  {
    title: "Run the mix you need.",
    body: "A coding model on two Sparks, a vision model on the third. Save it as a profile, review the exact plan, apply it, and switch profiles when the job changes.",
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

// The sentence leads (owner 2026-11-12); the counts follow as proof. All three
// counts are over recipes verified on a DGX Spark.
function Hero({ state }: { state: CatalogState }) {
  const summary = state.status === "ready" ? state.summary : null;
  const top = summary ? summary.topCreators.slice(0, 3).map((creator) => creator.name) : [];
  const showCounts = state.status === "loading" || state.status === "ready";
  return (
    <section className="home-hero" aria-labelledby="home-title">
      <div className="home-hero-copy">
        <h1 id="home-title">Models that fit your Sparks, kept current.</h1>
        <p className="home-definition">
          Vonk Forge is the open-source Controller for NVIDIA DGX Spark. It
          checks every model and recipe against the Sparks you actually have,
          keeps up with new models and recipe revisions for you, and runs the
          mix you need in a few clicks or one <code>vonkctl</code> command your
          agents can drive.
        </p>
        {showCounts ? (
          <p className="hero-proof" aria-label="Catalog counts" aria-busy={summary ? undefined : true}>
            <span className="hero-stat"><RollingNumber value={summary?.verified ?? null} /> recipes verified on DGX Spark</span>
            <span className="hero-stat"><RollingNumber value={summary?.families ?? null} placeholderDigits={2} /> model families</span>
            <span className="hero-stat"><RollingNumber value={summary?.creators ?? null} placeholderDigits={2} /> creators</span>
          </p>
        ) : null}
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
  return <TypeTiles summary={state.summary} />;
}


export function HomePage() {
  const [state, retry] = useCatalogSummary();
  return (
    <main className="home-page">
      <Hero state={state} />
      <CatalogSections state={state} retry={retry} />

      <section className="quickstart" aria-labelledby="quickstart-title">
        <div className="quickstart-heading">
          <h2 id="quickstart-title">Start on the computer in front of you.</h2>
          <p>
            One Controller on a laptop, a NAS or a local server (Docker Compose
            is enough), then each Spark enrolls with one command. Your Controller
            caches verified model files and images, and shows progress, recovery
            and the next action.
          </p>
        </div>
        <div className="quickstart-commands">
          <CommandBlock label="1 · Controller, on your workstation">curl -fsSL https://install.vonkforge.ai/nas | sh</CommandBlock>
          <CommandBlock label="2 · Each Spark, on the Spark">curl -fsSL https://install.vonkforge.ai/spark | VONK_CONTROLLER_ADDRESS=192.168.1.231 sh</CommandBlock>
        </div>
        <p className="quickstart-note">Replace the address with your Controller&apos;s reserved LAN address. <a className="text-link" href="/install">Full install guide</a> · <a className="text-link" href="/models#model-recipe-explainer">See how models, recipes, and your Controller fit together</a></p>
      </section>

      <section id="product-tour" className="product-tour" aria-labelledby="tour-title">
        <div className="home-section-heading">
          <h2 id="tour-title">Click it, or script it. One Controller.</h2>
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
        <ul className="tour-points">
          {points.map((point) => (
            <li key={point.title}><h3>{point.title}</h3><p>{point.body}</p></li>
          ))}
        </ul>
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
