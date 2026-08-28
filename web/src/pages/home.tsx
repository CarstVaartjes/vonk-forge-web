const installCommand = "curl -fsSL https://install.vonkforge.ai/nas | sh";


const ownershipPath = [
  {
    title: "Public recipes",
    owner: "Shared metadata",
    body: "Inspect immutable build source, hardware fit, deployment profiles, and bounded evidence before anything reaches your network.",
  },
  {
    title: "Your NAS",
    owner: "Local authority",
    body: "The controller, database, policy, identity, and runtime secrets live on the Docker-capable NAS you operate.",
  },
  {
    title: "Your Sparks",
    owner: "Private execution",
    body: "One or more Sparks build and run accepted workloads with NVIDIA's native container stack and node-local model caches.",
  },
];


const operatingLoop = [
  ["Find", "Search the public catalog or your local library and compare recipes against the fleet you actually have."],
  ["Preview", "See placement, compatibility, downloads, memory requirements, and the exact change before it runs."],
  ["Apply", "Confirm a digest-bound plan in the browser or with an explicit apply flag in vonkctl."],
  ["Observe", "Follow progress and history in Activity, then operate the installed workload without routine Spark SSH."],
];


function StateDot({ tone = "ready" }: { tone?: "ready" | "warm" }) {
  return <span className={`state-dot ${tone}`} aria-hidden="true" />;
}


function ControllerPreview() {
  return (
    <figure className="controller-preview">
      <figcaption>
        <span>Illustrative controller view</span>
        <span><StateDot /> Local authority</span>
      </figcaption>
      <div className="controller-window">
        <div className="controller-sidebar" aria-hidden="true">
          <strong>VF</strong>
          <span className="active">Fleet</span>
          <span>Library</span>
          <span>Activity</span>
        </div>
        <div className="controller-content">
          <header>
            <div><span>Fleet</span><strong>Ready to operate</strong></div>
            <span className="controller-user">admin</span>
          </header>
          <div className="profile-strip">
            <div><span>Active profile</span><strong>Dual-Spark workbench</strong></div>
            <span className="profile-state"><StateDot /> Applied</span>
          </div>
          <div className="node-table" role="presentation">
            <div className="node-table-head"><span>Node</span><span>Connection</span><span>Workload</span></div>
            <div><strong>spark-01</strong><span><StateDot /> Connected</span><span>Ready</span></div>
            <div><strong>spark-02</strong><span><StateDot /> Connected</span><span>Ready</span></div>
          </div>
          <div className="controller-action">
            <div><span>Next safe action</span><strong>Preview a recipe placement</strong></div>
            <span>Preview</span>
          </div>
        </div>
      </div>
    </figure>
  );
}


export function HomePage() {
  return (
    <main className="home-page">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-copy">
          <h1 id="home-title">Your Sparks.<br />{" "}One local control plane.</h1>
          <p className="home-definition">
            <strong>Vonk Forge is an open-source control plane for NVIDIA DGX Spark.</strong>{" "}
            Discover reproducible model recipes, install them safely, and operate
            one Spark or a fleet from infrastructure you own.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="/install">Install Vonk Forge</a>
            <a className="button secondary" href="#how-it-works">See how it works</a>
          </div>
          <ul className="home-facts" aria-label="Product facts">
            <li><StateDot /> Operator-owned NAS</li>
            <li>1–N Sparks</li>
            <li>Browser + CLI</li>
            <li>Open source · MIT</li>
          </ul>
        </div>
        <ControllerPreview />
      </section>

      <section className="quickstart" aria-labelledby="quickstart-title">
        <div className="quickstart-heading">
          <h2 id="quickstart-title">Start with your NAS. Add Sparks when ready.</h2>
          <a href="/install">Open the complete install guide</a>
        </div>
        <div className="quickstart-command">
          <span>Workstation terminal</span>
          <code>{installCommand}</code>
        </div>
        <ol className="quickstart-steps">
          <li><span>1</span><div><strong>Prepare</strong><p>The signed installer creates a self-contained NAS project directory on your workstation.</p></div></li>
          <li><span>2</span><div><strong>Start</strong><p>Move that directory to your Docker-capable NAS and start the Compose project.</p></div></li>
          <li><span>3</span><div><strong>Enroll</strong><p>Create a one-use grant, run the Spark installer, and verify the node in Fleet.</p></div></li>
        </ol>
      </section>

      <section id="how-it-works" className="ownership-section" aria-labelledby="ownership-title">
        <div className="home-section-heading">
          <h2 id="ownership-title">The catalog is public.<br />{" "}The control plane is yours.</h2>
          <p>
            Vonk Forge shares only what should travel: recipe metadata and verified
            build source. Fleet authority, secrets, state, weights, and execution stay local.
          </p>
        </div>
        <ol className="ownership-path">
          {ownershipPath.map((stage, index) => (
            <li key={stage.title} className={index === 0 ? "public-stage" : "private-stage"}>
              <div className="ownership-index">{String(index + 1).padStart(2, "0")}</div>
              <div><h3>{stage.title}</h3><span>{stage.owner}</span></div>
              <p>{stage.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="operation-section" aria-labelledby="operation-title">
        <div className="home-section-heading">
          <h2 id="operation-title">Most jobs follow one safe loop.</h2>
          <p>
            The Web Controller is the guided path for first use. The local
            <code> vonkctl</code> CLI exposes the same state and preview/apply boundary
            when you want repeatable operations or JSON output.
          </p>
        </div>
        <ol className="operation-loop">
          {operatingLoop.map(([title, body], index) => (
            <li key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </li>
          ))}
        </ol>
        <div className="control-choice">
          <article>
            <h3>Operate visually in your browser.</h3>
            <p>Recommended for first use: search, compare, preview, confirm, and follow progress through the private HTTPS controller on your NAS.</p>
            <a href="/control#web-controller">Tour the Web Controller</a>
          </article>
          <article>
            <h3>Use the same control plane with <code>vonkctl</code>.</h3>
            <p>The complete terminal path lists and filters the same Fleet, Library, and Activity state, with explicit mutations and machine-readable output.</p>
            <a href="/control#local-cli">See CLI install and usage</a>
          </article>
        </div>
      </section>

      <section className="home-boundary-panel" aria-labelledby="boundary-title">
        <div>
          <h2 id="boundary-title">A public site that never becomes your admin surface.</h2>
          <p>
            <code>vonkforge.ai</code> provides documentation, signed installers, and
            the recipe catalog. Your controller lives at the private HTTPS address
            of your own NAS deployment.
          </p>
        </div>
        <ul>
          <li><StateDot /><span><strong>Secrets stay local</strong> on NAS-owned files.</span></li>
          <li><StateDot /><span><strong>Weights stay separate</strong> at immutable origins and node caches.</span></li>
          <li><StateDot /><span><strong>Agents connect outbound</strong> with independently enrolled identity.</span></li>
        </ul>
      </section>

      <section className="home-closing" aria-labelledby="home-closing-title">
        <div>
          <h2 id="home-closing-title">Build your Forge.</h2>
          <p>Prepare the NAS, open the controller, then add one Spark or many.</p>
        </div>
        <div className="hero-actions">
          <a className="button primary" href="/install">Start the installation</a>
          <a className="button secondary" href="/recipes">Browse compatible recipes</a>
        </div>
      </section>
    </main>
  );
}
