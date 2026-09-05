import { ArchitecturePage } from "./pages/architecture";
import { ControlPage } from "./pages/control";
import { HomePage } from "./pages/home";
import { InstallPage } from "./pages/install";
import { PrivacyPage } from "./pages/privacy";
import { PublisherPage } from "./pages/publisher";
import { PublisherWorkspacePage } from "./pages/publisher-workspace";
import { PublishingGuidePage } from "./pages/publishing-guide";
import { RecipeDetailPage } from "./pages/recipe-detail";
import { RecipesPage } from "./pages/recipes";
import { ModelDetailPage, ModelsPage } from "./pages/models";
import { usesStaticCatalog } from "./api/client";


function CurrentPage() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  if (parts.length === 0) return <HomePage />;
  if (parts[0] === "architecture" && parts.length === 1) return <ArchitecturePage />;
  if (parts[0] === "control" && parts.length === 1) return <ControlPage />;
  if (parts[0] === "install" && parts.length === 1) return <InstallPage />;
  if (parts[0] === "privacy" && parts.length === 1) return <PrivacyPage />;
  if (parts[0] === "recipes" && parts.length === 1) return <RecipesPage />;
  if (parts[0] === "recipes" && parts.length === 3) {
    return <RecipeDetailPage publisher={parts[1] ?? ""} slug={parts[2] ?? ""} />;
  }
  if (parts[0] === "models" && parts.length === 1) return <ModelsPage />;
  if (parts[0] === "models" && parts.length === 3) return <ModelDetailPage publisher={parts[1] ?? ""} slug={parts[2] ?? ""} />;
  if (parts[0] === "publishers" && parts.length === 2) {
    return <PublisherPage publisher={parts[1] ?? ""} />;
  }
  if (parts[0] === "publish") {
    return usesStaticCatalog ? <PublishingGuidePage /> : <PublisherWorkspacePage />;
  }
  return <main className="status-panel"><h1>Not found</h1><p>This spark has not been forged.</p></main>;
}

function NavigationLink({ href, children, primary = false }: { href: string; children: string; primary?: boolean }) {
  const path = window.location.pathname;
  const current = path === href || path.startsWith(`${href}/`);
  return (
    <a
      aria-current={current ? "page" : undefined}
      className={[primary ? "nav-primary" : "", current ? "is-active" : ""].filter(Boolean).join(" ") || undefined}
      href={href}
    >
      {children}
    </a>
  );
}

export function App() {
  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <div className="site-shell">
        <header className="site-header">
          <a className="brand" href="/" aria-label="Vonk Forge home">
            <span aria-hidden="true" className="brand-mark"><i /><i /><i /></span>
            <span className="brand-name"><strong>Vonk</strong> Forge</span>
          </a>
          <nav aria-label="Primary navigation">
            <NavigationLink primary href="/install">Install</NavigationLink>
            <NavigationLink href="/architecture">How it works</NavigationLink>
            <NavigationLink href="/control">Control</NavigationLink>
            <NavigationLink href="/models">Models</NavigationLink>
            <NavigationLink href="/recipes">Recipes</NavigationLink>
            <NavigationLink href="/publish">Publish</NavigationLink>
          </nav>
        </header>
        <div id="main-content" tabIndex={-1}>
          <CurrentPage />
        </div>
        <footer className="site-footer">
          <p><strong>Vonk Forge</strong> · Open-source local control for NVIDIA DGX Spark.</p>
          <nav aria-label="Footer navigation">
            <a href="/install">Install</a>
            <a href="/architecture">How it works</a>
            <a href="/control">Control</a>
            <a href="/models">Models</a>
            <a href="/recipes">Recipes</a>
            <a href="/publish">Publish</a>
            <a href="/privacy">Privacy</a>
            <a href="https://github.com/CarstVaartjes/vonk-forge">GitHub</a>
          </nav>
        </footer>
      </div>
    </>
  );
}
