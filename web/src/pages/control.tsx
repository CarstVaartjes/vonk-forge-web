const repository = "https://github.com/CarstVaartjes/vonk-forge";


function CommandBlock({ children, label }: { children: string; label: string }) {
  return (
    <div className="command-block">
      <span>{label}</span>
      <pre><code>{children}</code></pre>
    </div>
  );
}


export function ControlPage() {
  return (
    <main className="guide-page control-page">
      <section className="guide-hero" aria-labelledby="control-title">
        <p className="eyebrow">One control plane · two control paths</p>
        <h1 id="control-title">Choose browser or terminal.</h1>
        <p>
          The Web Controller and local <code>vonkctl</code> CLI operate the same
          Fleet, Library, and Activity data through the same authenticated API.
          Use either path—or both—without creating a second controller.
        </p>
        <div className="guide-jump two-up" aria-label="Control paths">
          <a href="#web-controller">Web Controller <span>Visual · guided</span></a>
          <a href="#local-cli">Local CLI <span>Scriptable · explicit</span></a>
        </div>
      </section>

      <section className="control-overview" aria-labelledby="choose-control-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Same authority, different interface</p>
            <h2 id="choose-control-title">Use the path that fits the job.</h2>
          </div>
          <p>
            Both paths manage the same NAS-hosted control plane. Browser and CLI
            actions appear in the same Activity history, and neither requires SSH
            access to a Spark for routine operation.
          </p>
        </div>
        <div className="control-path-grid">
          <article>
            <span className="path-number">01</span>
            <p className="eyebrow">Recommended for first use</p>
            <h3>Web Controller</h3>
            <p>A guided interface with visual status, previews, confirmations, progress, search, and filters.</p>
            <ul>
              <li>Sign in with the controller&apos;s admin login</li>
              <li>Best for setup, exploration, and visual monitoring</li>
              <li>Runs only on your private controller URL</li>
            </ul>
            <a className="text-link" href="#web-controller">Use the Web Controller <span aria-hidden="true">↓</span></a>
          </article>
          <article>
            <span className="path-number">02</span>
            <p className="eyebrow">For operators and automation</p>
            <h3>Local CLI</h3>
            <p>The same lists and choices in a terminal, with JSON output and explicit preview/apply safety.</p>
            <ul>
              <li>Install locally on Python 3.12+</li>
              <li>Best for repeatable work, scripts, and remote shells</li>
              <li>Requires a provisioned admin bearer token</li>
            </ul>
            <a className="text-link" href="#local-cli">Install the CLI <span aria-hidden="true">↓</span></a>
          </article>
        </div>
      </section>

      <section id="web-controller" className="control-guide" aria-labelledby="web-controller-title">
        <header>
          <div><p className="eyebrow">Control path 01</p><h2 id="web-controller-title">Web Controller</h2></div>
          <span>Browser</span>
        </header>
        <p className="lane-intro">
          Open the private HTTPS address configured for your NAS controller and
          sign in with its administrator account. The public <code>vonkforge.ai</code>
          website is documentation and catalog—not your controller.
        </p>
        <div className="usage-grid">
          <article><span>Fleet</span><h3>Enroll and watch Sparks</h3><p>Create one-use enrollment grants, inspect health and warnings, search nodes, choose telemetry ranges, edit profiles, re-enroll, and revoke.</p></article>
          <article><span>Library</span><h3>Import and operate recipes</h3><p>Search local or public recipes, compare, preview, import, create, map, install, load, stop, retry, and uninstall with confirmation before changes.</p></article>
          <article><span>Activity</span><h3>Follow every operation</h3><p>Filter audit and job history by search, area, operator, status, or attention; inspect progress and resume recoverable work.</p></article>
        </div>
        <div className="control-note">
          <strong>Private by design</strong>
          <p>Keep the controller behind private HTTPS such as Tailscale. Do not expose it through Funnel or treat this public website as an admin login.</p>
        </div>
      </section>

      <section id="local-cli" className="control-guide cli-guide" aria-labelledby="local-cli-title">
        <header>
          <div><p className="eyebrow">Control path 02</p><h2 id="local-cli-title">Local CLI</h2></div>
          <code>vonkctl</code>
        </header>
        <p className="lane-intro">
          Install <code>vonkctl</code> on the workstation or operator host from
          which you can reach the controller. It requires Python 3.12 or newer,
          <a href="https://docs.astral.sh/uv/getting-started/installation/"> <code>uv</code></a>,
          and Git access to the public repository.
        </p>

        <div className="cli-section" aria-labelledby="cli-install-title">
          <h3 id="cli-install-title"><span>01</span> Install</h3>
          <CommandBlock label="Terminal">{`uv tool install 'git+https://github.com/CarstVaartjes/vonk-forge.git@main'
vonkctl --help`}</CommandBlock>
          <p>If <code>vonkctl</code> is not on <code>PATH</code>, run <code>uv tool update-shell</code>, then open a new terminal.</p>
        </div>

        <div className="cli-section" aria-labelledby="cli-connect-title">
          <h3 id="cli-connect-title"><span>02</span> Connect safely</h3>
          <CommandBlock label="Terminal">{`mkdir -p ~/.config/vonk-forge
install -m 600 /path/to/admin-token ~/.config/vonk-forge/admin-token
export VONK_CONTROL_URL='https://your-private-controller.example'
export VONK_CONTROL_TOKEN_FILE="$HOME/.config/vonk-forge/admin-token"
vonkctl fleet list`}</CommandBlock>
          <div className="credential-warning">
            <strong>The browser password is not a CLI credential.</strong>
            <p>
              The CLI reads an already-provisioned signed administrator bearer token
              from a private, regular, non-symlink file. It never accepts tokens in a
              command argument and will reject an unsafe file. If your controller has
              not provisioned a bearer token, use the Web Controller; do not copy the
              NAS token-signing key to a workstation.
            </p>
          </div>
        </div>

        <div className="cli-section" aria-labelledby="cli-read-title">
          <h3 id="cli-read-title"><span>03</span> Browse the same lists and options</h3>
          <CommandBlock label="Fleet">{`vonkctl fleet list --search spark-2 --health stale --warnings-only
vonkctl fleet show SPARK_ID --json
vonkctl fleet telemetry SPARK_ID --range 24h --json
vonkctl fleet enroll
vonkctl fleet enroll --apply`}</CommandBlock>
          <CommandBlock label="Library">{`vonkctl library list --search qwen --all --json
vonkctl library compare RECIPE_ID RECIPE_ID --json
vonkctl library public facets --source-owner Qwen --json
vonkctl library public list --model-type language --capability chat \
  --qualification cataloged --readiness executable --sort download --json
vonkctl library public preview 'vonk://catalog/PUBLISHER/SLUG@sha256:DIGEST'`}</CommandBlock>
          <CommandBlock label="Activity">{`vonkctl activity list --search qwen --area Library \
  --status unsuccessful --sort attention --all --json
vonkctl activity jobs --status running --all --json
vonkctl activity job JOB_ID --json`}</CommandBlock>
          <p>
            Put <code>--json</code> before or after a selected leaf command for
            machine-readable output. Use <code>--help</code> at any level to see every
            accepted search, filter, sort, range, pagination, preset, and mutation option.
          </p>
        </div>

        <div className="cli-section" aria-labelledby="cli-change-title">
          <h3 id="cli-change-title"><span>04</span> Preview, then apply changes</h3>
          <CommandBlock label="Safe mutation pattern">{`vonkctl library install preview --mapping-id MAPPING_ID \
  --recipe-build-id BUILD_ID --json

vonkctl library install apply --mapping-id MAPPING_ID \
  --recipe-build-id BUILD_ID --plan-digest DIGEST --apply`}</CommandBlock>
          <p>
            Read commands are safe by default. Mutations require the appropriate
            <code> apply</code> subcommand and <code>--apply</code>; omitting it prints a
            dry-run plan. Request keys are generated automatically and can be supplied
            explicitly for retry-safe automation.
          </p>
        </div>

        <div className="cli-section" aria-labelledby="cli-maintain-title">
          <h3 id="cli-maintain-title"><span>05</span> Update or remove</h3>
          <CommandBlock label="Terminal">{`uv tool upgrade vonk-cluster-profiles
# Remove the CLI and its isolated environment:
uv tool uninstall vonk-cluster-profiles`}</CommandBlock>
          <p>Exit status <code>0</code> means success or a printed dry run; <code>2</code> means invalid input, authentication, transport, or API failure.</p>
        </div>

        <div className="runbook-links">
          <a href={`${repository}/blob/main/docs/runbooks/vonkctl.md`}>Complete CLI command reference <span aria-hidden="true">↗</span></a>
          <a href={`${repository}/tree/main`}>Source and release history <span aria-hidden="true">↗</span></a>
        </div>
      </section>

      <section className="guide-cta" aria-labelledby="control-next-title">
        <div><p className="eyebrow">Start at the beginning</p><h2 id="control-next-title">Install the Forge, then choose either path.</h2></div>
        <a className="button primary" href="/install">Open the install guide <span aria-hidden="true">→</span></a>
      </section>
    </main>
  );
}
