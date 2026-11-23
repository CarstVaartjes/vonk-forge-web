// Recipes and Models are two views of one catalog; the top menu lists both and these tabs switch between the views.
export function CatalogTabs({ current }: { current: "recipes" | "models" }) {
  return (
    <nav className="catalog-tabs" aria-label="Recipes and Models views">
      <a href="/recipes" aria-current={current === "recipes" ? "page" : undefined}>
        Recipes
      </a>
      <a href="/models" aria-current={current === "models" ? "page" : undefined}>
        Models
      </a>
    </nav>
  );
}
