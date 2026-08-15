const connections = [
  { className: "tailnet", label: "Tailscale HTTPS", detail: "Human browser access" },
  { className: "management", label: "Management-LAN TLS / mTLS", detail: "Enrollment, claims, and evidence" },
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
            <ul><li>Browser + Tailscale</li><li>1Password</li><li>SSH project publisher</li></ul>
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

      <section className="architecture-section runtime-contract" aria-labelledby="contract-title">
        <div className="section-kicker">
          <span>03</span>
          <div><p className="eyebrow">Control ↔ runtime</p><h2 id="contract-title">One contract. Any reviewed runtime.</h2></div>
        </div>
        <p className="contract-intro">
          The controller describes the exact outcome. The runtime decides how to
          produce it. Between them is a small, versioned interface—not a shell
          script, a Docker socket, or MIA-specific control code.
        </p>

        <ol className="contract-pipeline" aria-label="Control to runtime handoff">
          <li>
            <span>01 · declares</span>
            <h3>Recipe</h3>
            <p>Names immutable source, image and model identities, profiles, resources, endpoint, mounts, and security.</p>
            <code>desired outcome</code>
          </li>
          <li>
            <span>02 · compiles</span>
            <h3>Control plan</h3>
            <p>Chooses exact nodes and roles, then resolves one role-specific typed workload for every rank.</p>
            <code>signed intent</code>
          </li>
          <li>
            <span>03 · enforces</span>
            <h3>Spark enforcement</h3>
            <p>The Rust agent verifies content and placement. A bounded root helper emits only the approved Docker shape.</p>
            <code>native NVIDIA stack</code>
          </li>
          <li>
            <span>04 · adapts</span>
            <h3>Runtime adapter</h3>
            <p>MIA, vLLM, llama.cpp, or another reviewed wrapper translates standard inputs into its own launch details.</p>
            <code>working endpoint</code>
          </li>
        </ol>

        <div className="contract-handoff">
          <article className="contract-socket" aria-labelledby="socket-title">
            <header>
              <div><p className="eyebrow">The stable socket</p><h3 id="socket-title">vonk.runtime.v1</h3></div>
              <span>Linux · ARM64</span>
            </header>
            <div className="contract-fields">
              <section aria-labelledby="placement-fields">
                <h4 id="placement-fields">Placement</h4>
                <div><code>VONK_RANK</code><code>VONK_WORLD_SIZE</code><code>VONK_MASTER_ADDR</code><code>VONK_LOCAL_ADDR</code></div>
              </section>
              <section aria-labelledby="filesystem-fields">
                <h4 id="filesystem-fields">Filesystem</h4>
                <div><code>/models · read-only</code><code>/state · private</code><code>/run/vonk/runtime.json</code></div>
              </section>
              <section aria-labelledby="endpoint-fields">
                <h4 id="endpoint-fields">Endpoint</h4>
                <div><code>OpenAI protocol</code><code>declared port</code><code>health path</code><code>model alias</code></div>
              </section>
              <section aria-labelledby="security-fields">
                <h4 id="security-fields">Enforcement</h4>
                <div><code>digest pinned</code><code>numeric non-root</code><code>read-only root</code><code>no capabilities</code></div>
              </section>
            </div>
          </article>

          <aside className="contract-example" aria-labelledby="mia-change-title">
            <p className="eyebrow">A real change</p>
            <h3 id="mia-change-title">MIA adds a thinking budget</h3>
            <p>
              MIA changes how reasoning tokens are handled inside its reviewed
              wrapper. It still consumes the same rank, model, fabric, mounts,
              and endpoint contract.
            </p>
            <div className="change-result">
              <span>Recipe source + digest change</span>
              <i aria-hidden="true">→</i>
              <strong>No control-plane change</strong>
            </div>
            <p className="change-note">Rebuild and verify the immutable runtime; keep placement and authority untouched.</p>
          </aside>
        </div>

        <div className="contract-ownership" aria-label="Contract ownership">
          <article><span>Control owns</span><p>Identity · placement · policy · lifecycle · health evidence · route publication</p></article>
          <article><span>Runtime owns</span><p>Framework launch · model flags · fabric translation · implementation patches · inference</p></article>
        </div>
      </section>

      <section className="architecture-section trust-boundaries" aria-labelledby="trust-title">
        <div className="section-kicker">
          <span>04</span>
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
