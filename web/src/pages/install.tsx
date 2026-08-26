const repository = "https://github.com/CarstVaartjes/vonk-forge/blob/main";


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
          Prepare the NAS control plane on a workstation, operate it through
          either the Web Controller or local CLI, then enroll one or more Sparks.
          Routine operation needs neither SSH nor a Git checkout.
        </p>
        <div className="guide-jump" aria-label="Installation steps">
          <a href="#nas">1 · NAS <span>Prepare control plane</span></a>
          <a href="#control">2 · Control <span>Browser or CLI</span></a>
          <a href="#fleet">3 · Sparks <span>Enroll 1…N nodes</span></a>
        </div>
      </section>

      <section className="install-prerequisites" aria-labelledby="prerequisites-title">
        <p className="eyebrow">Before you begin</p>
        <h2 id="prerequisites-title">Three systems. Clean boundaries.</h2>
        <div className="three-up">
          <article><span>01</span><h3>Workstation</h3><p>A macOS or Linux shell with <code>curl</code> and enough access to move one generated directory onto the NAS. Docker, root, Git, SSH, and a mounted NAS are not required.</p></article>
          <article><span>02</span><h3>NAS</h3><p>A Docker-capable NAS with durable storage and a Compose-compatible project runner. The NAS holds control state, identity, and runtime secrets.</p></article>
          <article><span>03</span><h3>DGX Sparks</h3><p>Ubuntu 24.04 aarch64 nodes with NVIDIA&apos;s native driver, Docker, and fabric stack intact, plus management-LAN reachability to the NAS.</p></article>
        </div>
      </section>

      <section id="nas" className="install-lane development-lane" aria-labelledby="nas-title">
        <header><div><p className="eyebrow">Step 1 · Workstation</p><h2 id="nas-title">Prepare the NAS</h2></div><span>Signed installer</span></header>
        <p className="lane-intro">
          Run the interactive installer on your workstation. It downloads and
          verifies the current immutable release before producing a small,
          self-contained NAS project directory.
        </p>
        <CommandBlock label="Workstation terminal">curl -fsSL https://install.vonkforge.ai/nas | sh</CommandBlock>
        <ol className="install-steps">
          <li><span>01</span><div><h3>Answer the guided prompts</h3><p>The installer prepares local identity, configuration, and secrets without changing the NAS or requiring Docker on the workstation.</p></div></li>
          <li><span>02</span><div><h3>Check the generated directory</h3><p>The output is exactly <code>vonk-forge/docker-compose.yaml</code>, <code>vonk-forge/.env</code>, and <code>vonk-forge/secrets/</code>. Keep the directory private and back it up securely.</p></div></li>
          <li><span>03</span><div><h3>Move it to the NAS</h3><p>Drag or copy the complete <code>vonk-forge/</code> directory onto the NAS. Do not copy individual secret values into a Docker image or command line.</p></div></li>
          <li><span>04</span><div><h3>Start the Compose project</h3><p>Open <code>docker-compose.yaml</code> with the NAS Docker runner and start the project. Named volumes retain PostgreSQL and service state.</p></div></li>
        </ol>
        <div className="control-note install-update-note">
          <strong>Upgrades use the same command</strong>
          <p>Run the NAS installer again on the workstation. It prepares the new immutable release while preserving locally owned identity and secrets.</p>
        </div>
      </section>

      <section id="control" className="install-lane control-install" aria-labelledby="install-control-title">
        <header><div><p className="eyebrow">Step 2 · Operator access</p><h2 id="install-control-title">Choose a control path</h2></div><span>Use either or both</span></header>
        <p className="lane-intro">
          There is one NAS-hosted controller and two complete ways to operate it.
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
        <p className="fleet-note">The public <code>vonkforge.ai</code> site is documentation and catalog. Your Web Controller lives at the private HTTPS address of your own NAS deployment.</p>
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
          <li><span>01</span><div><h3>Use the NAS reserved LAN address</h3><p>Replace <code>192.168.1.231</code> with the address reserved for your NAS. The controller hostnames remain in place for TLS while the installer creates the local NAS mapping.</p></div></li>
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
          <li><strong>NAS controller</strong><span>Owns PostgreSQL state, service identity, policy, and private runtime secrets.</span></li>
          <li><strong>Control paths</strong><span>Browser login or a protected CLI bearer-token file reaches the same HTTPS API.</span></li>
          <li><strong>Spark agents</strong><span>Connect outbound with independently enrolled identity; routine operation does not need SSH.</span></li>
        </ul>
      </section>

      <div className="runbook-links install-runbooks">
        <a href={`${repository}/README.md`}>Canonical installation README <span aria-hidden="true">↗</span></a>
        <a href={`${repository}/docs/runbooks/vonkctl.md`}>Complete CLI reference <span aria-hidden="true">↗</span></a>
      </div>
    </main>
  );
}
