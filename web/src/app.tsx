export function App() {
  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href="/" aria-label="Vonk Forge home">
          <span aria-hidden="true" className="brand-mark">
            V
          </span>
          <span>Vonk Forge</span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="/recipes">Recipes</a>
          <a href="/publish">Publish</a>
        </nav>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <p className="eyebrow">A typed catalog for DGX Spark</p>
          <h1 id="hero-title">Many sparks. One forge.</h1>
          <p className="lede">
            Discover reproducible recipes, inspect their exact runtime and
            capacity needs, then import them into your own Vonk Forge.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="/recipes">
              Explore recipes
            </a>
            <a className="button secondary" href="/publish">
              Publish yours
            </a>
          </div>
        </section>

        <section className="boundary" aria-labelledby="boundary-title">
          <p className="eyebrow">A clean boundary</p>
          <h2 id="boundary-title">Metadata here. Payloads where they belong.</h2>
          <p>
            Images and weights stay in their registries. Vonk Forge stores the
            typed recipe, immutable digests, sizing, topology, and test
            evidence needed to decide whether it belongs on your cluster.
          </p>
        </section>
      </main>
    </div>
  );
}
