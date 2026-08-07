import { HomePage } from "./pages/home";
import { PublisherPage } from "./pages/publisher";
import { PublisherWorkspacePage } from "./pages/publisher-workspace";
import { RecipeDetailPage } from "./pages/recipe-detail";
import { RecipesPage } from "./pages/recipes";


function CurrentPage() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  if (parts.length === 0) return <main><HomePage /></main>;
  if (parts[0] === "recipes" && parts.length === 1) return <RecipesPage />;
  if (parts[0] === "recipes" && parts.length === 3) {
    return <RecipeDetailPage publisher={parts[1] ?? ""} slug={parts[2] ?? ""} />;
  }
  if (parts[0] === "publishers" && parts.length === 2) {
    return <PublisherPage publisher={parts[1] ?? ""} />;
  }
  if (parts[0] === "publish") {
    return <PublisherWorkspacePage />;
  }
  return <main className="status-panel"><h1>Not found</h1><p>This spark has not been forged.</p></main>;
}

export function App() {
  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href="/" aria-label="Vonk Forge home">
          <span aria-hidden="true" className="brand-mark">V</span>
          <span>Vonk Forge</span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="/recipes">Recipes</a>
          <a href="/publish">Publish</a>
        </nav>
      </header>
      <CurrentPage />
    </div>
  );
}
