const repository = "https://github.com/CarstVaartjes/vonk-forge";


function CommandBlock({ children, label }: { children: string; label: string }) {
  return (
    <div className="command-block">
      <span>{label}</span>
      <pre><code>{children}</code></pre>
    </div>
  );
}


// Every command on this page comes from the vonk-forge vonkctl runbook
// (docs/runbooks/vonkctl.md). Keep them in step with it.
export function ControlPage() {
  return (
    <main className="guide-page control-page">
      <section className="guide-hero" aria-labelledby="control-title">
        <p className="eyebrow">One Controller · two ways to drive</p>
        <h1 id="control-title">Click it, or script it.</h1>
        <p>
          The Web Controller and the local <code>vonkctl</code> CLI operate the same
          Fleet, Library, and Profiles through the same authenticated API. Use
          either path, or both, without creating a second controller. The CLI is
          written for scripts and AI agents: one JSON document per call, a
          read-only review of every change, and explicit consent.
        </p>
        <div className="guide-jump two-up" aria-label="Control paths">
          <a href="#web-controller">Web Controller <span>Visual · a few clicks</span></a>
          <a href="#local-cli">Local CLI <span>Scriptable · agent friendly</span></a>
        </div>
      </section>

      <section className="control-overview" aria-labelledby="choose-control-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Same authority, different interface</p>
            <h2 id="choose-control-title">Use the path that fits the job.</h2>
          </div>
          <p>
            Both paths manage the same operator-owned local control plane. Browser and CLI
            actions appear in the same Activity history, and neither requires SSH
            access to a Spark for routine operation.
          </p>
        </div>
        <div className="control-path-grid">
          <article>
            <span className="path-number">01</span>
            <p className="eyebrow">Recommended for first use</p>
            <h3>Web Controller</h3>
            <p>A guided interface with visual progress, search, filters, and clear next steps.</p>
            <ul>
              <li>Sign in with the controller&apos;s admin login</li>
              <li>Best for setup, exploration, and visual monitoring</li>
              <li>Runs only on your private controller URL</li>
            </ul>
            <a className="text-link" href="#web-controller">Use the Web Controller <span aria-hidden="true">↓</span></a>
          </article>
          <article>
            <span className="path-number">02</span>
            <p className="eyebrow">For operators, scripts, and AI agents</p>
            <h3>Local CLI</h3>
            <p>The same lists and choices in a terminal, with JSON output, read-only reviews, and meaningful exit codes.</p>
            <ul>
              <li>Installed by the signed installer; <code>uv</code> manages Python 3.14</li>
              <li>Best for repeatable work, automation, and agent tool use</li>
              <li>Authenticates with a downloaded token file, never a pasted token</li>
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
          Open the private HTTPS address configured for your local controller and
          sign in with its administrator account. The public <code>vonkforge.ai</code>
          website is documentation and catalog—not your controller.
        </p>
        <div className="usage-grid">
          <article><span>Fleet</span><h3>Enroll and watch Sparks</h3><p>Create one-use enrollment grants, inspect health, free memory, and warnings, search nodes, choose telemetry ranges, rename, re-enroll, and remove.</p></article>
          <article id="library-import"><span>Library</span><h3>See what fits, then run it</h3><p>Search published models and recipes; the recipe repository syncs automatically every 15 minutes, or choose <strong>Update from Vonk Forge remote</strong>. Each recipe shows whether it fits your Sparks right now and why. Download exact model assets and recipe images, then run or switch a saved profile with durable progress and per-Spark results.</p></article>
          <article><span>Profiles</span><h3>Keep the mix you need</h3><p>Assign recipes to Sparks, save the set as a profile, review the exact plan—what stops, starts, and installs—then apply. A running install is marked stale when a newer recipe revision lands; you decide when to update.</p></article>
        </div>
        <div className="control-note">
          <strong>Private by design</strong>
          <p>Keep the controller behind private HTTPS such as Tailscale, or on a lab LAN behind its local CA. Do not expose it through Funnel or treat this public website as an admin login.</p>
        </div>
      </section>

      <section id="local-cli" className="control-guide cli-guide" aria-labelledby="local-cli-title">
        <header>
          <div><p className="eyebrow">Control path 02</p><h2 id="local-cli-title">Local CLI</h2></div>
          <code>vonkctl</code>
        </header>
        <p className="lane-intro">
          Install <code>vonkctl</code> on the workstation or operator host from
          which you can reach the controller. It needs <code>curl</code>,
          <code> openssl</code>, Python 3, and
          <a href="https://docs.astral.sh/uv/getting-started/installation/"> <code>uv</code></a>,
          which manages the isolated Python 3.14 environment the CLI runs in.
        </p>

        <div className="cli-section" aria-labelledby="cli-install-title">
          <h3 id="cli-install-title"><span>01</span> Install</h3>
          <CommandBlock label="Terminal">{`curl -fsSL https://install.vonkforge.ai/vonkctl | sh
vonkctl --version`}</CommandBlock>
          <p>The signed installer verifies the release signature and the exact wheel digest before handing it to <code>uv tool install</code>. Use <code>https://install.vonkforge.ai/dev/vonkctl</code> for the accepted development channel. If <code>vonkctl</code> is not on <code>PATH</code>, run <code>uv tool update-shell</code>, then open a new terminal.</p>
        </div>

        <div className="cli-section" aria-labelledby="cli-connect-title">
          <h3 id="cli-connect-title"><span>02</span> Connect safely</h3>
          <p>In the Web Controller, open the operator menu under your user name and choose <strong>Download CLI token</strong>. Store the file privately and point the CLI at it:</p>
          <CommandBlock label="Terminal">{`export VONK_CONTROL_URL='https://your-private-controller.example'
install -d -m 700 "$HOME/.config/vonk-forge"
mv "$HOME/Downloads/vonkctl-token" "$HOME/.config/vonk-forge/controller-token"
chmod 600 "$HOME/.config/vonk-forge/controller-token"
export VONK_CONTROL_TOKEN_FILE="$HOME/.config/vonk-forge/controller-token"
vonkctl --check-connection --json`}</CommandBlock>
          <div className="credential-warning">
            <strong>The browser password is not a CLI credential.</strong>
            <p>
              The CLI reads a signed administrator bearer token from a private,
              regular, non-symlink file. It never accepts a token in a command
              argument, rejects an unsafe file, and keeps TLS validation on. The
              token expires after 30 days; download a new file from the operator
              menu when it does. Put the two <code>export</code> lines in your shell
              configuration; keep the credential in the file.
            </p>
          </div>
        </div>

        <div className="cli-section" aria-labelledby="cli-read-title">
          <h3 id="cli-read-title"><span>03</span> See what fits your Sparks</h3>
          <CommandBlock label="Fleet">{`vonkctl fleet
vonkctl fleet detail Atlas --json
vonkctl fleet activity --state needs-operator --json`}</CommandBlock>
          <CommandBlock label="Library">{`vonkctl model library --family Qwen --json
vonkctl recipe library --fits-fleet --json
vonkctl recipe library --ready --engine vllm --sparks 2
vonkctl recipe detail qwen-code --json
vonkctl recipe sync-status`}</CommandBlock>
          <p>
            <code>--fits-fleet</code> keeps only recipes with a complete placement that
            fits the fresh capacity of the Sparks you have; <code>--ready</code> also
            requires the exact model files and image on your NAS. <code>recipe detail</code>
            explains the verdict and lists the other recipes for the same model.
            Run <code>vonkctl GROUP --help</code> at any level; help works offline.
          </p>
        </div>

        <div className="cli-section" aria-labelledby="cli-change-title">
          <h3 id="cli-change-title"><span>04</span> Run the mix you need</h3>
          <CommandBlock label="One recipe, now">{`vonkctl --profile 2 run "Qwen Code" --spark Atlas --spark Boreal --yes --json`}</CommandBlock>
          <CommandBlock label="A saved profile">{`vonkctl --profile 2 profile add "Qwen Code" --spark Atlas --spark Boreal
vonkctl --profile 2 profile add "GLM" --spark Cirrus --as vision
vonkctl --profile 2 profile load --review --json
vonkctl --profile 2 profile load --yes --json
vonkctl --profile 2 profile progress --follow
vonkctl --profile 2 profile endpoint`}</CommandBlock>
          <p>
            <code>--review</code> is read-only and prints the Controller&apos;s exact plan:
            placements, what stops, starts, or installs, and any blockers. In a
            terminal, <code>profile load</code> shows that review and asks once. For
            scripts, JSON, or redirected input, pass <code>--yes</code>; nothing is
            asked and the Controller applies the plan that is current when it accepts
            the request. Changing a profile always needs an explicit <code>--profile N</code>.
          </p>
        </div>

        <div className="cli-section" aria-labelledby="cli-maintain-title">
          <h3 id="cli-maintain-title"><span>05</span> Stay current</h3>
          <CommandBlock label="Recipes and models">{`vonkctl recipe update --all
vonkctl model download qwen-3.8-nvfp4`}</CommandBlock>
          <CommandBlock label="The CLI itself">{`vonkctl update --apply
# Remove the CLI and its isolated environment:
uv tool uninstall vonk-cluster-profiles`}</CommandBlock>
          <p><code>recipe update --all</code> refreshes every cached recipe to its current accepted revision and follows the work. <code>vonkctl update</code> checks the signed release channel and installs only with <code>--apply</code>; it never touches the Controller or Sparks.</p>
        </div>

        <div className="agent-contract" aria-labelledby="agent-contract-title">
          <h3 id="agent-contract-title">Written for agents</h3>
          <ul>
            <li><strong><code>--json</code></strong><span>One result or one structured error on stdout; progress and prompts go to stderr. Errors carry <code>usage</code> and <code>recovery_actions</code>.</span></li>
            <li><strong><code>--review</code> then <code>--yes</code></strong><span>Read the plan without changing anything, then consent explicitly. Without a terminal, nothing is applied unless <code>--yes</code> is given.</span></li>
            <li><strong>Exit codes</strong><span><code>0</code> success or dry run · <code>1</code> awaited partial result · <code>2</code> failed, blocked, or invalid · <code>130</code> interrupted · <code>141</code> closed pipe. None cancels Controller work.</span></li>
            <li><strong>Reconnectable</strong><span>Every mutation prints a request key; <code>progress --request-key KEY --follow</code> resumes observation after a lost response.</span></li>
          </ul>
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
