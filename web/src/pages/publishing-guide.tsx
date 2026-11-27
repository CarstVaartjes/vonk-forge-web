import { usePageMeta } from "../page-meta";
import { PAGE_META } from "../route-meta";

const recipeLibrary = "https://github.com/CarstVaartjes/vonk-forge-recipes";
const authoringGuide = `${recipeLibrary}/blob/main/docs/recipe-authoring.md`;
const forkGuide = `${authoringGuide}#pull-requests-from-a-fork`;

export function PublishingGuidePage() {
  usePageMeta(PAGE_META["/publish"]);
  return (
    <main className="guide-page publishing-guide">
      <section className="guide-hero" aria-labelledby="publishing-title">
        <h1 id="publishing-title">Publish a recipe others can trust.</h1>
        <p>
          Public recipes are authored and reviewed in the version-controlled Vonk Forge recipe
          library. Use its guide to add or update a recipe; the repository checks and catalog sync
          carry approved changes here.
        </p>
        <div className="hero-actions">
          <a className="button primary" href={recipeLibrary}>
            Open the recipe library
          </a>
          <a className="button" href={authoringGuide}>
            Read the recipe authoring guide
          </a>
        </div>
      </section>

      <section className="publishing-path" aria-labelledby="publishing-path-title">
        <header>
          <h2 id="publishing-path-title">One clear path from source to catalog.</h2>
          <p>
            Model weights and private credentials stay out of recipe files. Automatic checks run
            with each pull request and sync approved changes to the catalog.
          </p>
        </header>
        <ol>
          <li>
            <span>1</span>
            <div>
              <h3>Describe the model and run</h3>
              <p>List the model files, software, settings, and Spark requirements.</p>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <h3>Check the recipe</h3>
              <p>
                Run the <a href={`${recipeLibrary}#local-checks`}>local checks from the README</a>{" "}
                before opening a pull request.
              </p>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <h3>Open a pull request</h3>
              <p>
                Automatic checks review the documents, source links, and catalog update before sync.
              </p>
            </div>
          </li>
        </ol>
      </section>

      <section className="publishing-path publishing-fork" aria-labelledby="publishing-fork-title">
        <header>
          <h2 id="publishing-fork-title">Contributing from a fork.</h2>
          <p>
            Most pull requests from a fork finish CI on their own. Two changes need a maintainer,
            who carries them for you.{" "}
            <a className="text-link" href={forkGuide}>
              How fork pull requests are carried
            </a>
          </p>
        </header>
        <ul>
          <li>
            <h3>A runtime image change</h3>
            <p>
              CI proves a changed image by pushing a candidate, which a fork cannot. A maintainer
              pushes your branch to the recipe repository and CI then completes.
            </p>
          </li>
          <li>
            <h3>An adapter source over 1 MiB</h3>
            <p>
              Large files stay out of Git. A maintainer adds the file with{" "}
              <code>tools/adapter-sources add</code>.
            </p>
          </li>
        </ul>
      </section>

      <section className="publishing-boundary" aria-labelledby="publishing-boundary-title">
        <div>
          <h2 id="publishing-boundary-title">Keep authoring in the repository.</h2>
          <p>
            The public site is for browsing the catalog. Recipe files, build inputs, review, and
            publication stay in the recipe repository.
          </p>
        </div>
        <a className="text-link" href={`${recipeLibrary}/pulls`}>
          Review recipe changes on GitHub
        </a>
      </section>
    </main>
  );
}
