const repository = "https://github.com/CarstVaartjes/vonk-forge/blob/main";

const developmentSteps = [
  ["Get the accepted artifact", "Download docker-compose.dev.yml from the successful Development images run for accepted main. The NAS follows public :dev images."],
  ["Generate secrets locally", "Create the complete 22-file source generation on a private Linux filesystem. Back it up encrypted; publish only the validated 18-file projection."],
  ["Publish the NAS project", "Publish through batch-mode SSH onto the NAS's real Linux filesystem. SMB is only an operator view. The project contains exactly docker-compose.yaml and secrets/. Then choose Pull and Redeploy while preserving every named volume."],
  ["Prepare node networking", "Put the three management-LAN names in /etc/hosts on the NAS and every Spark. Declare none for one Spark or explicit NVIDIA fabric CIDRs for multi-node recipes."],
  ["Install each signed agent", "Add the Vonk APT dev channel on Ubuntu 24.04 aarch64, install the Rust agent package, enroll it, and approve the node."],
  ["Verify private access", "Define svc:vonk-forge, apply the exact grant and auto-approver, and confirm at least one connected host. Funnel stays disabled."],
];


export function InstallPage() {
  return (
    <main className="guide-page install-page">
      <section className="guide-hero" aria-labelledby="install-title">
        <p className="eyebrow">Fresh installation</p>
        <h1 id="install-title">Install Vonk Forge</h1>
        <p>
          Choose the development lane for accepted <code>:dev</code> builds and
          fast operator-controlled redeploys. Choose production only when a
          signed release and trusted host updater are available.
        </p>
        <div className="guide-jump" aria-label="Installation paths">
          <a href="#development">Development <span>Accepted main</span></a>
          <a href="#production">Production <span>Signed release</span></a>
          <a href="#fleet">Spark fleet <span>1…N nodes</span></a>
        </div>
      </section>

      <section className="install-prerequisites" aria-labelledby="prerequisites-title">
        <p className="eyebrow">Before you begin</p>
        <h2 id="prerequisites-title">Four clean boundaries</h2>
        <div>
          <article><span>01</span><h3>NAS</h3><p>Linux/amd64, Docker Engine, Compose plugin, durable storage, an SSH operator with Docker authority, and one private project directory.</p></article>
          <article><span>02</span><h3>Workstation</h3><p>Git, Python 3.12, OpenSSH with a trusted NAS host key, 1Password, and Tailscale for the private browser path.</p></article>
          <article><span>03</span><h3>Spark nodes</h3><p>Ubuntu 24.04 aarch64 with NVIDIA&apos;s native driver, Docker, and fabric stack intact.</p></article>
          <article><span>04</span><h3>Tailnet</h3><p>MagicDNS, HTTPS certificates, one tagged OAuth client, exact Service grants, and no Funnel.</p></article>
        </div>
      </section>

      <section id="development" className="install-lane development-lane" aria-labelledby="development-title">
        <header><div><p className="eyebrow">Recommended before launch</p><h2 id="development-title">Development</h2></div><code>:dev</code></header>
        <p className="lane-intro">The NAS project is deliberately small: <strong>docker-compose.yaml + secrets/</strong>. Images are built and tested by GitHub Actions; the NAS pulls them and keeps state in named volumes.</p>
        <ol className="install-steps">
          {developmentSteps.map(([title, body], index) => (
            <li key={title}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{title}</h3><p>{body}</p></div></li>
          ))}
        </ol>
        <div className="runbook-links">
          <a href={`${repository}/docs/runbooks/fresh-development-install.md`}>Fresh-install checklist <span aria-hidden="true">↗</span></a>
          <a href={`${repository}/docs/runbooks/development-nas-installation.md`}>Complete development runbook <span aria-hidden="true">↗</span></a>
          <a href={`${repository}/docs/runbooks/development-agent-workloads.md`}>Spark workload acceptance <span aria-hidden="true">↗</span></a>
          <a href={`${repository}/docs/runbooks/tailscale.md`}>Private Tailscale ingress <span aria-hidden="true">↗</span></a>
        </div>
      </section>

      <section id="production" className="install-lane production-lane" aria-labelledby="production-title">
        <header><div><p className="eyebrow">Deliberate activation</p><h2 id="production-title">Production</h2></div><span>Signed release</span></header>
        <p className="lane-intro">Production does not pull a mutable <code>:latest</code> tag from a Docker UI. The root-owned host updater selects an immutable signed bundle, validates compatibility and migration, journals activation, and retains exact rollback.</p>
        <div className="production-path">
          <article><span>01</span><h3>Prepare authority</h3><p>Complete PKI, root-owned runtime files, backups, DNS, firewall, and tailnet policy.</p></article>
          <i aria-hidden="true">→</i>
          <article><span>02</span><h3>Select release</h3><p>Preview the exact TUF target and compatibility evidence through the installed updater.</p></article>
          <i aria-hidden="true">→</i>
          <article><span>03</span><h3>Activate + verify</h3><p>Run the updater&apos;s bounded migration, health, journal, and rollback workflow.</p></article>
        </div>
        <div className="runbook-links">
          <a href={`${repository}/docs/runbooks/control-plane-bootstrap.md`}>Production bootstrap runbook <span aria-hidden="true">↗</span></a>
          <a href={`${repository}/deploy/compose/README.md`}>Production deployment contract <span aria-hidden="true">↗</span></a>
        </div>
      </section>

      <section id="fleet" className="fleet-install" aria-labelledby="fleet-title">
        <div className="section-heading compact"><p className="eyebrow">Choose the fleet shape</p><h2 id="fleet-title">One Spark or many Sparks.</h2></div>
        <div className="fleet-choice">
          <article><div><span>1</span><h3>One Spark</h3></div><p>Set direct fabric to <code>none</code>. Install and enroll one signed agent. Select single-node recipe profiles.</p></article>
          <article><div><span>N</span><h3>Many Sparks</h3></div><p>Repeat the same signed agent installation per node. Declare only real direct-fabric CIDRs; recipes select compatible ranks.</p></article>
        </div>
        <p className="fleet-note">Adding a Spark does not add another controller, database, or secret set. It adds one independently identified agent and local model cache to the same fleet.</p>
      </section>

      <section className="secret-boundary" aria-labelledby="secrets-title">
        <div><p className="eyebrow">Secret boundary</p><h2 id="secrets-title">Files at runtime. Never image layers.</h2></div>
        <ul>
          <li><strong>Local source generation</strong><span>Created privately and backed up encrypted.</span></li>
          <li><strong>NAS projection</strong><span>Only validated files needed by the Compose graph.</span></li>
          <li><strong>Service projections</strong><span>API, worker, migration, Caddy, LiteLLM, and Tailscale receive disjoint subsets.</span></li>
          <li><strong>Public images</strong><span>Code and dependencies only—no credentials, private keys, or site configuration.</span></li>
        </ul>
      </section>
    </main>
  );
}
