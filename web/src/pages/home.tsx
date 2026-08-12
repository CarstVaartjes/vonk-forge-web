const stages = [
  {
    number: "01",
    label: "Public surface",
    title: "Catalog",
    body: "Typed recipes pair content-addressed build source with capacity facts, deployment profiles, and bounded test evidence.",
    tags: ["Immutable revisions", "No model uploads"],
  },
  {
    number: "02",
    label: "Operator boundary",
    title: "NAS control",
    body: "Compose, PostgreSQL, policy, and runtime secret files stay on infrastructure you operate. The catalog is never your control plane.",
    tags: ["File-based secrets", "Local authority"],
  },
  {
    number: "03",
    label: "Execution boundary",
    title: "Spark runtime",
    body: "Sparks build untrusted source rootlessly, then run accepted workloads through the native NVIDIA container stack and local NVMe cache.",
    tags: ["NVIDIA + Docker", "Outbound Rust agent"],
  },
];


export function HomePage() {
  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow"><span className="status-dot" /> Open recipe infrastructure</p>
          <h1 id="hero-title">Build where the models live.</h1>
          <h2 className="hero-signature">Many sparks. One forge.</h2>
          <p className="lede">
            Discover reproducible AI recipes, inspect their exact trust and
            capacity facts, then import them into a Vonk Forge you control.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="/recipes">
              Explore recipes <span aria-hidden="true">↗</span>
            </a>
            <a className="button secondary" href="/publish">
              Publish yours
            </a>
          </div>
        </div>

        <div className="hero-signal" aria-label="Platform trust summary">
          <p className="signal-label">Accepted path</p>
          <ol>
            <li><span>Source</span><strong>Digest bound</strong></li>
            <li><span>Control</span><strong>Operator owned</strong></li>
            <li><span>Runtime</span><strong>Spark native</strong></li>
          </ol>
          <p className="signal-foot">Catalog metadata moves. Authority does not.</p>
        </div>
      </section>

      <section className="system-section" aria-labelledby="system-title">
        <div className="section-heading">
          <p className="eyebrow">One verified path</p>
          <h2 id="system-title">From public recipe to private compute.</h2>
          <p>
            Each boundary does one job. Nothing global needs root on your NAS,
            and nothing on a Spark needs your registry or control-plane secrets.
          </p>
        </div>

        <ol className="system-map">
          {stages.map((stage) => (
            <li key={stage.number}>
              <article className="system-card">
                <div className="stage-meta">
                  <span>{stage.number}</span>
                  <span>{stage.label}</span>
                </div>
                <h3>{stage.title}</h3>
                <p>{stage.body}</p>
                <div className="stage-tags">
                  {stage.tags.map((tag) => <span key={tag}>{tag}</span>)}
                </div>
              </article>
            </li>
          ))}
        </ol>
      </section>

      <section className="boundary home-boundary" aria-labelledby="boundary-title">
        <div className="boundary-copy">
          <p className="eyebrow">The useful separation</p>
          <h2 id="boundary-title">Verified build source here. Weights at their origin.</h2>
          <p>
            Vonk Forge stores the small source bundle, typed recipe, sizing,
            profiles, and evidence. Model files remain at immutable upstream
            revisions and in node-local caches—not in wrapper images or this catalog.
          </p>
        </div>
        <div className="boundary-facts">
          <div><span>01</span><strong>Secrets stay local</strong><p>Runtime authority is projected from NAS files, never baked into an image.</p></div>
          <div><span>02</span><strong>Models stay separate</strong><p>Rebuild a small wrapper without repackaging or redownloading verified weights.</p></div>
          <div><span>03</span><strong>Execution stays native</strong><p>Accepted workloads use Spark&apos;s NVIDIA and Docker stack.</p></div>
        </div>
      </section>

      <section className="release-section" aria-labelledby="release-title">
        <div className="section-heading compact">
          <p className="eyebrow">Two lanes, two promises</p>
          <h2 id="release-title">Fast development. Deliberate production.</h2>
        </div>
        <div className="release-grid">
          <article className="release-card development">
            <div className="release-card-heading"><h3>Development</h3><code>:dev</code></div>
            <p>Accepted <code>main</code> builds advance public development images and the signed APT <code>dev</code> channel.</p>
            <span className="release-rule">Pull, redeploy, iterate</span>
          </article>
          <article className="release-card production">
            <div className="release-card-heading"><h3>Production</h3><span>Signed release</span></div>
            <p>Immutable release identity, compatibility gates, migration planning, and rollback stay behind the trusted updater.</p>
            <span className="release-rule">Select, verify, activate</span>
          </article>
        </div>
      </section>

      <section className="closing-cta" aria-labelledby="closing-title">
        <p className="eyebrow">Ready when you are</p>
        <h2 id="closing-title">Find the recipe. Keep the keys.</h2>
        <div className="hero-actions">
          <a className="button primary" href="/recipes">Browse the catalog <span aria-hidden="true">↗</span></a>
          <a className="text-link" href="/publish">Share a verified recipe <span aria-hidden="true">→</span></a>
        </div>
      </section>
    </>
  );
}
