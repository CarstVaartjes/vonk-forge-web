const repository = "https://github.com/CarstVaartjes/vonk-forge/blob/main";
const tailscaleRunbook = `${repository}/docs/runbooks/tailscale.md`;


function CommandBlock({ children, label }: { children: string; label: string }) {
  return (
    <div className="command-block">
      <span>{label}</span>
      <pre><code>{children}</code></pre>
    </div>
  );
}


export function InstallPage() {
  return (
    <main className="guide-page install-page">
      <section className="guide-hero" aria-labelledby="install-title">
        <p className="eyebrow">Fresh installation</p>
        <h1 id="install-title">Install Vonk Forge</h1>
        <p>
          Prepare the controller project on a macOS or Linux workstation, run it
          on any local computer with Docker Compose—even that same laptop—then
          enroll one or more Sparks. Routine operation needs neither SSH nor a Git checkout.
        </p>
        <div className="guide-jump" aria-label="Installation steps">
          <a href="#controller">1 · Controller <span>Prepare control plane</span></a>
          <a href="#control">2 · Control <span>Browser or CLI</span></a>
          <a href="#fleet">3 · Sparks <span>Enroll 1…N nodes</span></a>
        </div>
      </section>

      <section className="install-prerequisites" aria-labelledby="prerequisites-title">
        <p className="eyebrow">Before you begin</p>
        <h2 id="prerequisites-title">Three systems. Clean boundaries.</h2>
        <div className="three-up">
          <article><span>01</span><h3>Installer workstation</h3><p>A macOS or Linux shell with <code>curl</code>. It can also be the controller host; Docker is only required there when it will run the Compose project.</p></article>
          <article><span>02</span><h3>Controller host</h3><p>Any local computer with Docker Compose and durable storage: this laptop for a lab, or a NAS or server for an always-on controller.</p></article>
          <article><span>03</span><h3>DGX Sparks</h3><p>Ubuntu 24.04 aarch64 nodes with NVIDIA&apos;s native driver, Docker, and fabric stack intact, plus management-network reachability to the controller host.</p></article>
        </div>
      </section>

      <section id="tailscale-preflight" className="tailscale-preflight" aria-labelledby="tailscale-preflight-title">
        <header>
          <div>
            <h2 id="tailscale-preflight-title">Complete private HTTPS setup first.</h2>
            <p>
              Do not run the controller installer until these four Tailscale
              checks are complete. The installer repeats the checklist before it
              asks for OAuth credentials, but it cannot inspect your admin console.
            </p>
          </div>
          <a className="button secondary" href={`${tailscaleRunbook}#fresh-install-preflight`}>
            Open the exact preflight <span aria-hidden="true">↗</span>
          </a>
        </header>
        <ol className="preflight-checks">
          <li>
            <span>01</span>
            <div><h3>Enable private DNS + certificates</h3><p>Turn on MagicDNS and HTTPS certificates, then copy the tailnet DNS suffix exactly as displayed. Use <code>vonk-forge.&lt;TAILNET_DNS_SUFFIX&gt;.ts.net</code> as the control hostname.</p></div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>Define only the Services you use</h3>
              <p>Every install needs <code>svc:vonk-forge</code> on <code>tcp:443</code>. Add <code>svc:hermes-api</code> and <code>svc:hermes-dashboard</code>, also on <code>tcp:443</code>, only when Hermes is enabled.</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div><h3>Install the reviewed policy</h3><p>Merge the repository grant example with your exact <code>USERNAME@github</code> identity. Give <code>tag:vonk-gateway</code> only the named Service auto-approvals and TCP 443 self-access it needs.</p></div>
          </li>
          <li>
            <span>04</span>
            <div><h3>Create one machine credential</h3><p>Create a Tailscale OAuth client with only <code>auth_keys</code> write scope and only <code>tag:vonk-gateway</code>. Keep its raw ID and secret ready for the hidden prompts.</p></div>
          </li>
        </ol>
        <div className="service-mode-grid" aria-label="Tailscale Services by feature set">
          <article><strong>Hermes disabled · 1 Service</strong><code>svc:vonk-forge</code></article>
          <article><strong>Hermes enabled · 3 Services</strong><code>svc:vonk-forge</code><code>svc:hermes-api</code><code>svc:hermes-dashboard</code></article>
        </div>
        <div className="preflight-boundary">
          <strong>Production and development use these same unsuffixed names.</strong>
          <p>Never add development, acceptance, or test suffixes to an operator tailnet. Full-tailnet acceptance belongs only in an isolated, disposable test tailnet with separate credentials and policy, removed after the run.</p>
        </div>
      </section>

      <section id="controller" className="install-lane development-lane" aria-labelledby="controller-title">
        <header><div><p className="eyebrow">Step 1 · Workstation</p><h2 id="controller-title">Prepare the controller</h2></div><span>Signed installer</span></header>
        <p className="lane-intro">
          Run the interactive installer on your workstation. It downloads and
          verifies the current immutable release before producing a small,
          self-contained controller project directory.
        </p>
        <p className="installer-gate"><strong>Preflight complete?</strong> Confirm the four checks above before copying this command.</p>
        <CommandBlock label="Workstation terminal">curl -fsSL https://install.vonkforge.ai/nas | sh</CommandBlock>
        <ol className="install-steps">
          <li><span>01</span><div><h3>Answer the guided prompts</h3><p>The installer prepares local identity, configuration, and secrets without changing the eventual controller host or requiring Docker on the workstation.</p></div></li>
          <li><span>02</span><div><h3>Check the generated directory</h3><p>The output is exactly <code>vonk-forge/docker-compose.yaml</code>, <code>vonk-forge/.env</code>, and <code>vonk-forge/secrets/</code>. Keep the directory private and back it up securely.</p></div></li>
          <li><span>03</span><div><h3>Place it on the controller host</h3><p>Keep the complete <code>vonk-forge/</code> directory on this laptop, or move it to another local computer. Do not copy individual secret values into an image or command line.</p></div></li>
          <li><span>04</span><div><h3>Start the Compose project</h3><p>Run <code>docker-compose.yaml</code> with Docker Compose on that host. Named volumes retain PostgreSQL and service state.</p></div></li>
        </ol>
        <div className="control-note install-update-note">
          <strong>Upgrades use the same command</strong>
          <p>Run the controller installer again on the workstation. It prepares the new immutable release while preserving locally owned identity and secrets. The public URL retains <code>/nas</code>, but the generated Compose project is not NAS-specific.</p>
        </div>
      </section>

      <section className="tailscale-verification" aria-labelledby="tailscale-verification-title">
        <div className="verification-heading">
          <h2 id="tailscale-verification-title">Prove the private route before enrolling Sparks.</h2>
          <p>Check the gateway from the controller host, then make one independent request from an authorized Tailscale-connected computer. A same-host probe alone is not proof.</p>
        </div>
        <div className="verification-grid">
          <article>
            <h3>Controller host</h3>
            <p>Both gateway containers must be healthy. The exact Serve map must use HTTPS 443, and <code>Self.PrimaryRoutes</code> must contain each Service TailVIP route.</p>
            <ul className="serve-map" aria-label="Exact Tailscale Serve map">
              <li><code>svc:vonk-forge</code><span>HTTPS 443 → <code>http://caddy:8080</code></span></li>
              <li><code>svc:hermes-api</code><span>HTTPS 443 → <code>http://hermes-agent:8642</code></span></li>
              <li><code>svc:hermes-dashboard</code><span>HTTPS 443 → <code>http://hermes-agent:9119</code></span></li>
            </ul>
            <CommandBlock label="Controller host terminal">{`docker compose ps --all
docker compose logs --no-color --tail 100 tailscale-gateway tailscale-configurator
docker compose exec tailscale-gateway tailscale status --json
docker compose exec tailscale-gateway tailscale serve status --json`}</CommandBlock>
          </article>
          <article>
            <h3>Independent Tailscale client</h3>
            <p>Replace the placeholder with the DNS suffix copied during preflight. MagicDNS, the Service route, TLS, and <code>/healthz</code> must all work from this client.</p>
            <CommandBlock label="Authorized client terminal">{`tailscale dns status
tailscale ping vonk-forge.<TAILNET_DNS_SUFFIX>.ts.net
curl --fail --show-error --silent \\
  https://vonk-forge.<TAILNET_DNS_SUFFIX>.ts.net/healthz \\
  --output /dev/null`}</CommandBlock>
          </article>
        </div>
        <div className="diagnostic-strip" aria-label="Tailscale failure diagnostics">
          <div><strong>Service shows 0 hosts</strong><span>Check the exact unsuffixed name, gateway state, and configurator health.</span></div>
          <div><strong>No matching peer</strong><span>Inspect <code>Self.PrimaryRoutes</code> and the gateway&apos;s exact TCP 443 self-access grant.</span></div>
          <div><strong>HTTPS returns 421</strong><span>Use <code>vonk-forge.&lt;TAILNET_DNS_SUFFIX&gt;.ts.net</code> as the control hostname.</span></div>
          <div><strong>Name does not resolve</strong><span>Check MagicDNS, the copied suffix, Service definition, and client connection—never add a hosts-file workaround.</span></div>
        </div>
        <a className="text-link verification-runbook" href={tailscaleRunbook}>Open the complete Tailscale setup, recovery, and diagnostics runbook <span aria-hidden="true">↗</span></a>
      </section>

      <section id="control" className="install-lane control-install" aria-labelledby="install-control-title">
        <header><div><p className="eyebrow">Step 2 · Operator access</p><h2 id="install-control-title">Choose a control path</h2></div><span>Use either or both</span></header>
        <p className="lane-intro">
          There is one local controller and two complete ways to operate it.
          Both use the same Fleet, Library, Activity, authentication, and persisted state.
        </p>
        <div className="control-path-grid compact-paths">
          <article>
            <span className="path-number">01</span>
            <p className="eyebrow">Visual and guided</p>
            <h3>Web Controller</h3>
            <p>Open the controller&apos;s private HTTPS URL, sign in with the administrator account, and use the Fleet, Library, and Activity pages.</p>
            <a className="button secondary" href="/control#web-controller">Web instructions <span aria-hidden="true">→</span></a>
          </article>
          <article>
            <span className="path-number">02</span>
            <p className="eyebrow">Local and scriptable</p>
            <h3><code>vonkctl</code> CLI</h3>
            <p>Install on Python 3.12+, connect with an HTTPS origin and private administrator token file, then use the same lists, filters, previews, and operations.</p>
            <a className="button secondary" href="/control#local-cli">CLI install + usage <span aria-hidden="true">→</span></a>
          </article>
        </div>
        <p className="fleet-note">The public <code>vonkforge.ai</code> site is documentation and catalog. Your Web Controller lives at the private HTTPS address of your own local controller.</p>
      </section>

      <section id="fleet" className="fleet-install" aria-labelledby="fleet-title">
        <div className="section-heading compact"><p className="eyebrow">Step 3 · Spark fleet</p><h2 id="fleet-title">Enroll one Spark or many.</h2></div>
        <p className="lane-intro">
          Create a one-use enrollment grant in the Web Controller&apos;s Fleet page,
          or create one from the CLI. Then run the generated Spark command on the
          node you are enrolling.
        </p>
        <CommandBlock label="CLI alternative for creating the grant">{`vonkctl fleet enroll
vonkctl fleet enroll --apply`}</CommandBlock>
        <CommandBlock label="Spark terminal">curl -fsSL https://install.vonkforge.ai/spark | VONK_CONTROLLER_ADDRESS=192.168.1.231 sh</CommandBlock>
        <ol className="install-steps fleet-steps">
          <li><span>01</span><div><h3>Use the controller&apos;s stable LAN address</h3><p>Replace <code>192.168.1.231</code> with the address reserved for your laptop, NAS, or other controller host. The controller hostnames remain in place for TLS while the installer creates the local mapping.</p></div></li>
          <li><span>02</span><div><h3>Complete the pairing prompts</h3><p>Enter the one-use grant values and the requested Spark management and fabric addresses. The installer writes the agent and firewall configuration.</p></div></li>
          <li><span>03</span><div><h3>Verify the node in Fleet</h3><p>The signed Rust agent connects outbound. Confirm that the node is connected and healthy in either control path before installing workloads.</p></div></li>
          <li><span>04</span><div><h3>Repeat for each additional Spark</h3><p>Create a separate one-use grant per node. Adding a Spark adds one identity and local model cache—not another controller, database, or secret set.</p></div></li>
        </ol>
        <div className="fleet-choice">
          <article><div><span>1</span><h3>One Spark</h3></div><p>Use a single-node recipe profile and enter only the fabric values that actually exist.</p></article>
          <article><div><span>N</span><h3>Many Sparks</h3></div><p>Repeat the signed installer per node; multi-node recipes select compatible ranks and declared fabric.</p></article>
        </div>
        <p className="fleet-note">Running the Spark installer again on an installed node performs an in-place agent upgrade. A certificate replacement uses Fleet re-enrollment in the browser or <code>vonkctl fleet re-enroll [SPARK_ID] --apply</code>.</p>
      </section>

      <section className="secret-boundary" aria-labelledby="secrets-title">
        <div><p className="eyebrow">Authority boundary</p><h2 id="secrets-title">Private controller. Outbound agents.</h2></div>
        <ul>
          <li><strong>Public website</strong><span>Documentation, installers, and catalog only; it is not an administrative surface.</span></li>
          <li><strong>Local controller</strong><span>Runs on your chosen Docker Compose host and owns PostgreSQL state, service identity, policy, and private runtime secrets.</span></li>
          <li><strong>Control paths</strong><span>Browser login or a protected CLI bearer-token file reaches the same HTTPS API.</span></li>
          <li><strong>Spark agents</strong><span>Connect outbound with independently enrolled identity; routine operation does not need SSH.</span></li>
        </ul>
      </section>

      <div className="runbook-links install-runbooks">
        <a href={`${repository}/README.md`}>Canonical installation README <span aria-hidden="true">↗</span></a>
        <a href={tailscaleRunbook}>Canonical Tailscale runbook <span aria-hidden="true">↗</span></a>
        <a href={`${repository}/docs/runbooks/vonkctl.md`}>Complete CLI reference <span aria-hidden="true">↗</span></a>
      </div>
    </main>
  );
}
