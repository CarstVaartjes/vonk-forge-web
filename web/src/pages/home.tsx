const setupFlow = [
  {
    title: "Install the controller",
    body: "Prepare one self-contained Docker Compose project on a computer you own.",
  },
  {
    title: "Connect your Sparks",
    body: "Create a one-use grant, run the signed agent installer, and see each node arrive in Fleet.",
  },
  {
    title: "Choose a model or recipe",
    body: "Compare exact versions, immutable weights, runtime, download, memory, topology, and evidence.",
  },
  {
    title: "Download, run, switch",
    body: "Let the local Controller prepare the selected scope, reuse verified assets, and show durable progress.",
  },
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
          height={src.includes("library") ? "900" : "1239"}
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


export function HomePage() {
  return (
    <main className="home-page">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-copy">
          <h1 id="home-title">Local AI.<br />One private control plane.</h1>
          <p className="home-definition">
            Vonk Forge turns a laptop, NAS, or local server into the command
            center for your NVIDIA DGX Sparks. Find reproducible model recipes,
            download exact assets, and operate the result from one clear interface.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="/install">Install your controller</a>
            <a className="button secondary" href="#product-tour">See the real interface</a>
          </div>
          <ul className="home-facts" aria-label="Product facts">
            <li><StateDot /> Runs on infrastructure you own</li>
            <li>One or many DGX Sparks</li>
            <li>Web + CLI</li>
            <li>Open source · MIT</li>
          </ul>
        </div>
        <ProductShot
          src="/product/controller-library.webp"
          alt="Vonk Forge Library showing model recipes, lifecycle state, and the recommended next action"
          title="The real Web Controller"
          body="Fixture-backed product screen · no live fleet data"
          eager
        />
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
          <span>Mandatory preflight</span>
          <strong>Set up private Tailscale HTTPS before the installer asks for OAuth credentials.</strong>
          <a href="/install#tailscale-preflight">Review the four checks, then copy the command</a>
        </div>
      </section>

      <section className="setup-section" aria-labelledby="setup-title">
        <div className="home-section-heading">
          <h2 id="setup-title">From blank host to running model. One visible flow.</h2>
          <p>
            No mystery automation and no routine SSH scavenger hunt. Each stage
            has a clear input, a visible result, and a deliberate confirmation.
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
        <a className="text-link setup-explainer-link" href="/models#model-recipe-explainer">See how models, recipes, and your Controller fit together ↗</a>
      </section>

      <section id="product-tour" className="product-tour" aria-labelledby="tour-title">
        <div className="home-section-heading">
          <h2 id="tour-title">Everything important, visible.</h2>
          <p>
            The controller is built around decisions, not dashboard decoration.
            See what fits, what will change, what is running, and what needs attention.
          </p>
        </div>
        <div className="tour-grid">
          <ProductShot
            src="/product/controller-library.webp"
            alt="Vonk Forge Library with browse, compare, model recipe, and lifecycle controls"
            title="Library makes the next action obvious"
            body="Browse models, compare recipes, download exact assets, and run from one model-centered workspace."
          />
          <ProductShot
            src="/product/controller-fleet.webp"
            alt="Vonk Forge Fleet showing two Sparks, live capacity, workloads, and operational warnings"
            title="Fleet shows reality, including blockers"
            body="Capacity, placement, telemetry, workloads, and recovery guidance stay together."
          />
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
            <h3>Catalog + signed releases</h3>
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
          <p>Install the local controller, add one Spark, and let the interface guide the first workload.</p>
        </div>
        <div className="hero-actions">
          <a className="button primary" href="/install">Install Vonk Forge</a>
          <a className="button secondary" href="/models">Browse models and recipes</a>
        </div>
      </section>
    </main>
  );
}
