import { CommandBlock } from "../command-block";
import { usePageMeta } from "../page-meta";

export const controllerInstallCommand = "curl -fsSL https://install.vonkforge.ai/nas | sh";

const repository = "https://github.com/CarstVaartjes/vonk-forge/blob/main";
const tailscaleRunbook = `${repository}/docs/runbooks/tailscale.md`;
const uninstallRunbook = `${repository}/docs/operations/uninstall.md`;

// The Lab commands are carried verbatim from vonk-forge docs/QUICKSTART.md, and the start
// commands from vonk-forge README.md:127-129; those runbooks are the one source.
const composeStartCommand = `cd vonk-forge
sudo docker compose pull
sudo docker compose up -d --wait --remove-orphans`;


export function InstallPage() {
  usePageMeta("Install", "Install the Vonk Forge Controller on a laptop, NAS or local server with one signed command, then enroll your DGX Sparks.");
  return (
    <main className="guide-page install-page">
      <section className="guide-hero" aria-labelledby="install-title">
        <h1 id="install-title">Install Vonk Forge</h1>
        <p>
          Start with Lab mode: one signed command, one Compose project on your
          own LAN, a signed-in Controller, then enroll one or more Sparks.
          Secure remote over Tailscale follows as the second path. Routine
          operation needs neither SSH nor a Git checkout.
        </p>
        <div className="guide-jump" aria-label="Installation steps">
          <a href="#lab">1 · Lab mode <span>LAN, no Tailscale</span></a>
          <a href="#secure-remote">2 · Secure remote <span>Tailscale</span></a>
          <a href="#control">3 · Control <span>Browser or CLI</span></a>
          <a href="#fleet">4 · Sparks <span>Enroll 1…N nodes</span></a>
        </div>
      </section>

      <section className="install-prerequisites" aria-labelledby="prerequisites-title">
        <h2 id="prerequisites-title">Three systems. Clean boundaries.</h2>
        <div className="three-up">
          <article><span>01</span><h3>Installer workstation</h3><p>A macOS or Linux shell with <code>curl</code>. It can also be the controller host; Docker is only required there when it will run the Compose project.</p></article>
          <article><span>02</span><h3>Controller host</h3><p>Any local computer with Docker Compose and durable storage: this laptop for a lab, or a NAS or server for an always-on controller.</p></article>
          <article><span>03</span><h3>DGX Sparks</h3><p>Ubuntu 24.04 aarch64 nodes with NVIDIA&apos;s native driver, Docker, and fabric stack intact, plus management-network reachability to the controller host.</p></article>
        </div>
      </section>

      <section id="lab" className="install-lane development-lane" aria-labelledby="lab-title">
        <header><div><h2 id="lab-title">Lab mode: from this page to a signed-in Controller</h2><span className="guide-meta">Path 1 · LAN only, no Tailscale</span></div><span>Signed installer</span></header>
        <p className="lane-intro">
          Lab mode runs the Controller on your LAN without Tailscale. It is an
          explicit choice: you answer <code>lab</code> at the install mode prompt.
          HTTPS uses a local CA created by the installer, and all internal
          passwords and signing keys are generated locally. The LiteLLM upstream
          key and the Hugging Face token are optional; without an upstream key,
          local model routes still work.
        </p>
        <ol className="install-steps">
          <li><span>01</span><div><h3>Run the signed installer</h3><p>On Intel or ARM macOS or Linux, provide <code>curl</code>, <code>openssl</code> and an installed <code>uv</code>, then run the installer. It verifies one portable Python setup wheel and its payload; <code>uv</code> manages the isolated Python 3.14 runtime.</p></div></li>
        </ol>
        <CommandBlock label="Workstation terminal">{controllerInstallCommand}</CommandBlock>
        <ol className="install-steps">
          <li><span>02</span><div><h3>Answer the prompts</h3><p>Answer <code>lab</code> at the install mode prompt (the default, Secure remote, needs Tailscale), enter the controller host&apos;s reserved LAN IPv4 address, and optionally enter a LiteLLM upstream key and a Hugging Face token for gated models. The project is created in <code>vonk-forge/</code>.</p></div></li>
          <li><span>03</span><div><h3>Find the administrator password</h3><p>The administrator username is <code>admin</code>. Its generated password is saved in <code>vonk-forge/secrets/admin-password</code>.</p></div></li>
          <li><span>04</span><div><h3>Add LAN DNS records</h3><p>Add LAN DNS records for <code>vonk-forge.local</code>, <code>enroll.vonk-forge.local</code>, <code>agents.vonk-forge.local</code>, and <code>registry.vonk-forge.local</code>, all pointing to the controller host&apos;s address. On a small lab network, equivalent host-file entries can be used. The Spark management network defaults to the controller host&apos;s own /24; to narrow it, edit <code>VONK_MANAGEMENT_CIDRS</code> in <code>.env</code>.</p></div></li>
          <li><span>05</span><div><h3>Start the Compose project</h3><p>Run these commands on the controller host, in the directory that contains <code>vonk-forge/</code>.</p></div></li>
        </ol>
        <CommandBlock label="Controller host terminal">{composeStartCommand}</CommandBlock>
        <ol className="install-steps">
          <li><span>06</span><div><h3>Trust HTTPS and sign in</h3><p>Import <code>secrets/step-ca/root-certificate</code> into the trust store used by your browser and Spark clients. Then open <code>https://vonk-forge.local:8443</code> and sign in as <code>admin</code> with the password in <code>secrets/admin-password</code>.</p></div></li>
        </ol>
        <div className="control-note install-update-note">
          <strong>Keep the LAN listener on the LAN</strong>
          <p>The LAN listener is bound to the address you entered. Keep the host firewall limited to your trusted LAN and do not forward port 8443 from the internet. Upgrades use the same installer command; the public URL retains <code>/nas</code>, but the generated Compose project is not NAS-specific.</p>
        </div>
        <a className="text-link" href={`${repository}/docs/QUICKSTART.md`}>Lab quickstart on GitHub</a>
      </section>

      <section id="secure-remote" className="install-modes" aria-labelledby="secure-remote-title">
        <div className="section-heading compact"><h2 id="secure-remote-title">Secure remote with Tailscale</h2><span className="guide-meta">Path 2 · Private HTTPS from any authorized device</span></div>
        <p className="lane-intro">
          Private HTTPS over your Tailscale tailnet, reachable from any
          authorized device. It is the installer&apos;s default mode. Complete the
          four preflight checks below before running the installer. To enable it
          after a Lab install, create a Secure remote project through the
          installer rather than starting Tailscale services by hand.
        </p>
      </section>

      <section id="tailscale-preflight" className="tailscale-preflight" aria-labelledby="tailscale-preflight-title">
        <header>
          <div>
            <h2 id="tailscale-preflight-title">Complete private HTTPS setup first.</h2>
            <p>
              For Secure remote, do not run the controller installer until these
              four Tailscale checks are complete. The installer repeats the
              checklist before it asks for OAuth credentials, but it cannot inspect
              your admin console. Lab mode skips this section.
            </p>
          </div>
          <a className="button secondary" href={`${tailscaleRunbook}#fresh-install-preflight`}>
            Open the exact preflight on GitHub
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
              <h3>Define the Service</h3>
              <p>Define one Service, <code>svc:vonk-forge</code>, on <code>tcp:443</code>.</p>
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
        <div className="preflight-boundary">
          <strong>Production and development use these same unsuffixed names.</strong>
          <p>Never add development, acceptance, or test suffixes to an operator tailnet. Full-tailnet acceptance belongs only in an isolated, disposable test tailnet with separate credentials and policy, removed after the run.</p>
        </div>
      </section>

      <section id="controller" className="install-lane development-lane" aria-labelledby="controller-title">
        <header><div><h2 id="controller-title">Run the Secure remote installer</h2><span className="guide-meta">Path 2 · Workstation</span></div><span>Signed installer</span></header>
        <p className="lane-intro">
          Run the same interactive installer and keep the default Secure remote
          mode. It downloads and verifies the current immutable release before
          producing a small, self-contained controller project directory.
        </p>
        <p className="installer-gate"><strong>Preflight complete?</strong> Confirm the four checks above before copying this command.</p>
        <CommandBlock label="Workstation terminal">{controllerInstallCommand}</CommandBlock>
        <ol className="install-steps">
          <li><span>01</span><div><h3>Answer the guided prompts</h3><p>The installer prepares local identity, configuration, and secrets without changing the eventual controller host or requiring Docker on the workstation.</p></div></li>
          <li><span>02</span><div><h3>Check the generated directory</h3><p>The output is exactly <code>vonk-forge/docker-compose.yaml</code>, <code>vonk-forge/.env</code>, and <code>vonk-forge/secrets/</code>. Keep the directory private and back it up securely.</p></div></li>
          <li><span>03</span><div><h3>Place it on the controller host</h3><p>Keep the complete <code>vonk-forge/</code> directory on this laptop, or move it to another local computer. Do not copy individual secret values into an image or command line.</p></div></li>
          <li><span>04</span><div><h3>Start the Compose project</h3><p>Run these commands on that host. Named volumes retain PostgreSQL and service state.</p></div></li>
        </ol>
        <CommandBlock label="Controller host terminal">{composeStartCommand}</CommandBlock>
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
        <a className="text-link verification-runbook" href={tailscaleRunbook}>Open the complete Tailscale setup, recovery, and diagnostics runbook on GitHub</a>
      </section>

      <section id="control" className="install-lane control-install" aria-labelledby="install-control-title">
        <header><div><h2 id="install-control-title">Choose a control path</h2><span className="guide-meta">Step 3 · Operator access</span></div><span>Use either or both</span></header>
        <p className="lane-intro">
          There is one local controller and two complete ways to operate it.
          Both use the same authentication and persisted state.
        </p>
        <div className="control-path-grid compact-paths">
          <article>
            <span className="path-number">01</span>
            <h3>Web Controller</h3>
            <span className="guide-meta">Visual and guided</span>
            <p>Open the controller&apos;s private HTTPS URL, sign in as <code>admin</code> (the password is in <code>vonk-forge/secrets/admin-password</code>), and use the Web Controller.</p>
            <a className="button secondary" href="/control#web-controller">Web instructions</a>
          </article>
          <article>
            <span className="path-number">02</span>
            <h3><code>vonkctl</code> CLI</h3>
            <span className="guide-meta">Local and scriptable</span>
            <p>One signed installer, a token file downloaded from the Web Controller, then the same lists, fit checks, reviews, and operations as JSON for scripts and AI agents.</p>
            <a className="button secondary" href="/control#local-cli">CLI install + usage</a>
          </article>
        </div>
        <p className="fleet-note">The public <code>vonkforge.ai</code> site is documentation and catalog. Your Web Controller lives at the private HTTPS address of your own local controller.</p>
      </section>

      <section id="fleet" className="fleet-install" aria-labelledby="fleet-title">
        <div className="section-heading compact"><h2 id="fleet-title">Enroll one Spark or many.</h2><span className="guide-meta">Step 4 · Spark fleet</span></div>
        <p className="lane-intro">
          Create a one-use enrollment grant with <strong>Enroll Spark</strong> on the
          Controller&apos;s Overview, or create one from the CLI. Then copy the install command that the grant screen shows and run it on the
          node you are enrolling. It carries your Controller's address, enrollment URL and CA fingerprint, so this site cannot show a complete command.
        </p>
        <CommandBlock label="CLI alternative for creating the grant">{`vonkctl fleet enroll Atlas --output atlas-grant.json
vonkctl fleet enrollment status GRANT_UUID`}</CommandBlock>
        <ol className="install-steps fleet-steps">
          <li><span>01</span><div><h3>Use the controller&apos;s stable LAN address</h3><p>Reserve a fixed address for your laptop, NAS, or other controller host. The controller hostnames remain in place for TLS while the installer creates the local mapping. In Lab mode the Spark must resolve the <code>enroll</code>, <code>agents</code>, and <code>registry</code> hostnames to that same address, and any client that connects to Spark-facing HTTPS endpoints needs the local CA certificate imported.</p></div></li>
          <li><span>02</span><div><h3>Complete the pairing prompts</h3><p>Enter the one-use grant values and the requested Spark management and fabric addresses. The installer writes the agent and firewall configuration.</p></div></li>
          <li><span>03</span><div><h3>Verify the node</h3><p>The signed Rust agent connects outbound. Confirm that the node is connected and healthy in either control path before installing workloads.</p></div></li>
          <li><span>04</span><div><h3>Repeat for each additional Spark</h3><p>Create a separate one-use grant per node. Adding a Spark adds one identity and local model cache—not another controller, database, or secret set.</p></div></li>
        </ol>
        <div className="fleet-choice">
          <article><div><span>1</span><h3>One Spark</h3></div><p>Use a single-node recipe profile and enter only the fabric values that actually exist.</p></article>
          <article><div><span>N</span><h3>Many Sparks</h3></div><p>Repeat the signed installer per node; multi-node recipes select compatible ranks and declared fabric.</p></article>
        </div>
        <p className="fleet-note">Running the Spark installer again on an installed node performs an in-place agent upgrade. A certificate replacement uses re-enrollment in the Web Controller or <code>vonkctl fleet re-enroll Atlas --output atlas-replacement.json --yes</code>.</p>
      </section>

      <section id="uninstall" className="fleet-install" aria-labelledby="uninstall-title">
        <div className="section-heading compact"><h2 id="uninstall-title">What it installs, and how to remove it.</h2><span className="guide-meta">Uninstall</span></div>
        <p className="lane-intro">
          The controller is one Docker Compose project in a <code>vonk-forge/</code> directory
          (<code>.env</code>, <code>secrets/</code>, backups) with named volumes for its database,
          model cache and registry. A Spark gets the <code>vonk-forge-agent</code> package: a
          service account, systemd units, firewall rules, configuration and a local model cache.
        </p>
        <p className="fleet-note">The <a href={uninstallRunbook}>removal runbook on GitHub</a> lists the removal steps, what is kept by default, and how to remove the data, model caches and Tailscale entries too.</p>
      </section>

      <section className="secret-boundary" aria-labelledby="secrets-title">
        <div><h2 id="secrets-title">Private controller. Outbound agents.</h2><span className="guide-meta">Authority boundary</span></div>
        <ul>
          <li><strong>Public website</strong><span>Documentation, installers, and catalog only; it is not an administrative surface.</span></li>
          <li><strong>Local controller</strong><span>Runs on your chosen Docker Compose host and owns PostgreSQL state, service identity, policy, and private runtime secrets.</span></li>
          <li><strong>Control paths</strong><span>Browser login or a protected CLI bearer-token file reaches the same HTTPS API.</span></li>
          <li><strong>Spark agents</strong><span>Connect outbound with independently enrolled identity; routine operation does not need SSH.</span></li>
        </ul>
      </section>

      <div className="runbook-links install-runbooks">
        <a href={`${repository}/README.md`}>Canonical installation README on GitHub</a>
        <a href={tailscaleRunbook}>Canonical Tailscale runbook on GitHub</a>
        <a href={`${repository}/docs/runbooks/vonkctl.md`}>Complete CLI reference on GitHub</a>
        <a href={uninstallRunbook}>Removal runbook on GitHub</a>
      </div>
    </main>
  );
}
