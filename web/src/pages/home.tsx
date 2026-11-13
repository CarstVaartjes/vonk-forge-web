import { useEffect, useState } from "react";

import { getCatalogSummary } from "../api/client";
import type { CatalogSummary } from "../catalog-stats";
import { CatalogWall } from "../catalog-wall";
import { fitsPick, useMySparks, type MySparks } from "../my-sparks";
import { FitAnswerView, FitResults, SparkSegments, TypeChips } from "../spark-picker";
import { CommandBlock } from "../command-block";
import { controllerInstallCommand, sparkInstallCommand } from "./install";
import { KeptCurrent, VerifiedOnHardware } from "../home-evidence";


// What the Controller does for a Spark owner, in one sentence each. The
// vonkctl calls that do the same things are the agent session below.
const number = new Intl.NumberFormat("en");

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
}: {
  src: string;
  alt: string;
  title: string;
  body: string;
}) {
  return (
    <figure className="product-shot">
      <div className="product-shot-frame">
        <div className="product-shot-bar" aria-hidden="true"><i /><i /><i /><span>https://controller.fixture.invalid/fleet</span></div>
        <img
          src={src}
          alt={alt}
          width="1280"
          height="800"
          loading="lazy"
        />
      </div>
      <figcaption>
        <strong>{title}</strong>
        <span>{body}</span>
      </figcaption>
    </figure>
  );
}


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
function Hero({ state, pick, setPick }: { state: CatalogState; pick: MySparks; setPick: (next: Partial<MySparks>) => void }) {
  const summary = state.status === "ready" ? state.summary : null;
  const top = summary ? summary.topCreators.slice(0, 3).map((creator) => creator.name) : [];
  const showWall = state.status === "loading" || state.status === "ready";
  return (
    <section className={`home-hero${showWall ? " has-wall" : ""}`} aria-labelledby="home-title">
      <div className="home-hero-copy">
        <h1 id="home-title">Models that fit your Sparks, kept current.</h1>
        <p className="home-definition">
          Vonk Forge is the open-source Controller for NVIDIA DGX Spark. It
          checks every model and recipe against the Sparks you actually have,
          keeps up with new models and recipe revisions for you, and runs the
          mix you need in a few clicks or one <code>vonkctl</code> command your
          agents can drive.
        </p>
        {showWall ? (
          <section className="card picker" aria-label="Which recipes fit your Sparks">
            <SparkSegments value={pick.sparks} onChange={(sparks) => setPick({ sparks })} />
            {summary ? <FitAnswerView summary={summary} pick={pick} /> : <div className="answer-placeholder" aria-hidden="true" />}
            <CommandBlock compact label="Ask your own Sparks">{agentSession[0]!.command}</CommandBlock>
          </section>
        ) : null}
        <div className="hero-actions">
          <a className="button primary" href="/install">Install</a>
          <a className="button secondary" href="/recipes">Browse what runs</a>
        </div>
        {top.length ? (
          <p className="home-creators">
            Recipes from {joinNames(top)} and more, each shown with whether it passed hardware checks on a DGX Spark.
          </p>
        ) : null}
        <p className="hero-cli"><a className="text-link" href="/control#local-cli">See the agent-friendly CLI</a></p>
        <ul className="home-facts" aria-label="Product facts">
          <li><StateDot /> Runs on infrastructure you own</li>
          <li>Web + CLI</li>
          <li>Open source · MIT</li>
        </ul>
      </div>
      {showWall ? <div className="wall-slot">{summary ? (
        <CatalogWall
          summary={summary}
          match={(row) => fitsPick(row, pick)}
          before={<><p className="wall-lead">Every recipe in the catalog. Lit means it passed on a real Spark.</p><TypeChips summary={summary} pick={pick} onChange={(type) => setPick({ type })} /></>}
          after={<FitResults summary={summary} pick={pick} />}
        />
      ) : null}</div> : null}
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
  return null;
}


// Section 4: the same Controller from the browser and from a terminal (a scripted screenshot arrives with
// the dashboard; until then the current Fleet screenshot stands), then the three things it does for you.
function RunTheMix() {
  return (
    <section className="home-section" aria-labelledby="mix-title">
      <div className="home-section-heading">
        <h2 id="mix-title">Click it, or hand it to your agent.</h2>
        <p>
          The Controller shows what fits, what will change, what is running and
          what needs attention. <code>vonkctl</code> gives scripts and agents the
          same facts and the same actions, with nothing hidden behind a prompt.
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
            <pre tabIndex={0}><code>{agentSession.map((line) => (
              <span key={line.command} className="agent-session-step">
                <span className="agent-session-comment"># {line.comment}</span>{"\n"}
                <span className="agent-session-command">{line.command}</span>{"\n\n"}
              </span>
            ))}<span className="agent-session-command"><i className="caret" aria-hidden="true" /></span></code></pre>
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
    </section>
  );
}

// Section 5: credit is the product. The ten creators with the most verified recipes, each linking to the
// catalog filtered to them, then how many more there are.
function Creators({ summary }: { summary: CatalogSummary }) {
  const most = Math.max(...summary.topCreators.map((creator) => creator.verified));
  return (
    <section className="home-section" aria-labelledby="creators-title">
      <div className="home-section-heading">
        <h2 id="creators-title">{number.format(summary.creators)} creators. One catalog. {number.format(summary.verified)} recipes proven on real Sparks.</h2>
        <p>
          The people who tune models for DGX Spark publish their recipes, across {number.format(summary.families)} model families so far.
          Vonk Forge packages each one, tests it on real DGX Sparks, shows the result, and keeps their name and source on it.
        </p>
      </div>
      <ul className="creators">
        {summary.topCreators.map((creator) => (
          <li key={creator.name}>
            <a className="src" href={`/recipes?creator=${encodeURIComponent(creator.name)}`}>{creator.name}</a>
            <span className="meter" role="meter" aria-label={`${creator.name}: verified recipes`} aria-valuenow={creator.verified} aria-valuemin={0} aria-valuemax={most}>
              <i style={{ width: `${(creator.verified / most) * 100}%` }} />
            </span>
            <span className="creator-count">{number.format(creator.verified)}</span>
          </li>
        ))}
      </ul>
      {summary.creators > summary.topCreators.length ? <p className="chart-sub">and {number.format(summary.creators - summary.topCreators.length)} more creators, each credited on every recipe with a link to their source.</p> : null}
    </section>
  );
}


export function HomePage() {
  const [state, retry] = useCatalogSummary();
  const [pick, setPick] = useMySparks();
  return (
    <main className="home-page">
      <Hero state={state} pick={pick} setPick={setPick} />
      <CatalogSections state={state} retry={retry} />
      {state.status === "ready" ? <><KeptCurrent summary={state.summary} /><VerifiedOnHardware summary={state.summary} /></> : null}

      <RunTheMix />
      {state.status === "ready" ? <Creators summary={state.summary} /> : null}

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
          <CommandBlock label="1 · Controller, on your workstation">{controllerInstallCommand}</CommandBlock>
          <CommandBlock label="2 · Each Spark, on the Spark">{sparkInstallCommand}</CommandBlock>
        </div>
        <p className="quickstart-note">Replace the address with your Controller&apos;s reserved LAN address. <a className="text-link" href="/install">Full install guide</a> · <a className="text-link" href="/models#model-recipe-explainer">See how models, recipes, and your Controller fit together</a></p>
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
          <a className="button" href="/install">Install Vonk Forge</a>
          <a className="button secondary" href="/models">Browse models and recipes</a>
        </div>
      </section>
    </main>
  );
}
