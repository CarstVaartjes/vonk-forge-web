const recipeLibrary = "https://github.com/CarstVaartjes/vonk-forge-recipes";


export function PublishingGuidePage() {
  return (
    <main className="guide-page publishing-guide">
      <section className="guide-hero" aria-labelledby="publishing-title">
        <h1 id="publishing-title">Publish a recipe others can trust.</h1>
        <p>
          Public recipes are reviewed in the version-controlled Vonk Forge
          recipe library. The hosted publisher workspace is not active yet, so
          this site will never ask you to sign in and then fail halfway through.
        </p>
        <div className="hero-actions">
          <a className="button primary" href={recipeLibrary}>Open the recipe library</a>
          <a className="button" href={`${recipeLibrary}#add-or-update-a-recipe`}>Read the publishing contract</a>
        </div>
      </section>

      <section className="publishing-path" aria-labelledby="publishing-path-title">
        <header>
          <h2 id="publishing-path-title">One reviewable path from source to catalog.</h2>
          <p>
            Model weights and private credentials never belong in a recipe
            submission. GitHub Actions is the publication authority.
          </p>
        </header>
        <ol>
          <li><span>1</span><div><h3>Describe the exact workload</h3><p>Bind immutable model, runtime, topology, capacity, source, and qualification identities.</p></div></li>
          <li><span>2</span><div><h3>Validate the complete closure</h3><p>Rebuild the catalog index and run repository validation before requesting review.</p></div></li>
          <li><span>3</span><div><h3>Publish through review</h3><p>Open a focused pull request. CI verifies schema, semantics, source boundaries, and catalog freshness.</p></div></li>
        </ol>
      </section>

      <section className="publishing-boundary" aria-labelledby="publishing-boundary-title">
        <div>
          <h2 id="publishing-boundary-title">The browser workspace comes later.</h2>
          <p>
            When the hosted catalog API and identity service are available,
            this route can activate draft upload, validation, and publishing.
            Until then, the public Git workflow is the complete supported path.
          </p>
        </div>
        <a className="text-link" href={`${recipeLibrary}/pulls`}>Review current recipe work →</a>
      </section>
    </main>
  );
}
