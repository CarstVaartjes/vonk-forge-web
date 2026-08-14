const connections = [
  { className: "tailnet", label: "Tailscale HTTPS", detail: "Human browser access" },
  { className: "management", label: "Management-LAN mTLS", detail: "Agent enrollment and claims" },
  { className: "artifact", label: "Verified downloads", detail: "Recipes, packages, images, and models" },
  { className: "fabric", label: "NVIDIA fabric", detail: "Recipe-selected multi-node ranks" },
];


export function ArchitecturePage() {
  return (
    <main className="guide-page architecture-page">
      <section className="guide-hero" aria-labelledby="architecture-title">
        <p className="eyebrow">System architecture · 1…N nodes</p>
        <h1 id="architecture-title"><span>One control plane.</span><span>One to many Sparks.</span></h1>
        <p>
          The public catalog describes reproducible work. Your NAS owns policy,
          state, and runtime authority. Each Spark contributes native NVIDIA
          compute without receiving control-plane or registry secrets.
        </p>
      </section>

      <section className="architecture-section" aria-labelledby="placement-title">
        <div className="section-kicker">
          <span>01</span>
          <div><p className="eyebrow">Placement</p><h2 id="placement-title">What runs where</h2></div>
        </div>

        <figure className="architecture-canvas" aria-labelledby="placement-title">
          <article className="architecture-zone zone-public">
            <div className="zone-heading"><span>Public</span><h3>Public catalog</h3></div>
            <p>Vonkforge.ai, typed recipes, source bundles, bounded evidence, and immutable revisions.</p>
            <ul><li>Cloudflare Pages</li><li>GitHub + GHCR</li><li>Signed APT repository</li></ul>
          </article>

          <div className="architecture-flow flow-download" aria-hidden="true"><span>verified metadata + artifacts</span></div>

          <article className="architecture-zone zone-operator">
            <div className="zone-heading"><span>Your device</span><h3>Operator workstation</h3></div>
            <p>Stages secrets locally, publishes the NAS project, and opens the private control UI.</p>
            <ul><li>Browser + Tailscale</li><li>1Password</li><li>SMB project copy</li></ul>
          </article>

          <div className="architecture-flow flow-tailnet" aria-hidden="true"><span>private HTTPS</span></div>

          <article className="architecture-zone zone-control">
            <div className="zone-heading"><span>Operator owned</span><h3>NAS control</h3></div>
            <p>Docker Compose runs the API, worker, PostgreSQL, Caddy, LiteLLM, and a userspace Tailscale gateway.</p>
            <ul><li>Runtime secret files</li><li>Policy + durable state</li><li>Placement + route authority</li></ul>
          </article>

          <div className="architecture-flow flow-management" aria-hidden="true"><span>outbound agent mTLS</span></div>

          <article className="architecture-zone zone-fleet">
            <div className="zone-heading"><span>1…N nodes</span><h3>Spark fleet</h3></div>
            <p>Every node runs one signed Rust agent and accepted workloads through the native NVIDIA container stack.</p>
            <div className="spark-row" aria-label="Example scalable Spark fleet">
              <span>Spark 01</span><i aria-hidden="true" /><span>Spark 02</span><i aria-hidden="true" /><span>Spark N</span>
            </div>
            <ul><li>Local NVMe model cache</li><li>Rootless source build</li><li>Recipe-selected ranks</li></ul>
          </article>
        </figure>

        <ul className="connection-legend" aria-label="Connection legend">
          {connections.map((connection) => (
            <li key={connection.label} className={connection.className}>
              <i aria-hidden="true" /><span><strong>{connection.label}</strong>{connection.detail}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="architecture-section" aria-labelledby="scale-title">
        <div className="section-kicker">
          <span>02</span>
          <div><p className="eyebrow">Fleet shape</p><h2 id="scale-title">Scale changes placement, not trust.</h2></div>
        </div>
        <div className="scale-grid">
          <article><span className="scale-count">1</span><h3>Single Spark</h3><p>One agent, one local cache, and no direct-fabric CIDR. Single-node recipes run without a peer network.</p></article>
          <article><span className="scale-count">2</span><h3>Two Sparks</h3><p>A recipe can select two ranks and the declared NVIDIA fabric. This is the current reference acceptance shape—not a platform limit.</p></article>
          <article><span className="scale-count">N</span><h3>Fleet</h3><p>Add signed agents independently. The scheduler chooses only compatible, present nodes for each recipe&apos;s declared profile.</p></article>
        </div>
      </section>

      <section className="architecture-section trust-boundaries" aria-labelledby="trust-title">
        <div className="section-kicker">
          <span>03</span>
          <div><p className="eyebrow">Trust boundaries</p><h2 id="trust-title">Authority stays narrow.</h2></div>
        </div>
        <div className="trust-boundary-grid">
          <article><h3>Catalog ≠ controller</h3><p>The public website cannot deploy, stop, or inspect your private workloads.</p></article>
          <article><h3>Agent ≠ Docker socket</h3><p>The signed host agent uses bounded root helpers; no container starts arbitrary sibling containers.</p></article>
          <article><h3>Images ≠ secrets</h3><p>Public development images contain code only. Runtime authority arrives from NAS files into per-service projections.</p></article>
          <article><h3>Serve ≠ Funnel</h3><p>Tailscale Services provide private HTTPS. Funnel remains disabled, so the operator UI is not public internet ingress.</p></article>
        </div>
      </section>

      <section className="guide-cta">
        <div><p className="eyebrow">Build your topology</p><h2>Start with one. Add Sparks when a recipe needs them.</h2></div>
        <a className="button primary" href="/install">Open the install guide <span aria-hidden="true">→</span></a>
      </section>
    </main>
  );
}
