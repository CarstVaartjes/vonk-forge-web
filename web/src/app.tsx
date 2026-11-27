import {
  Component,
  Suspense,
  lazy,
  useEffect,
  useLayoutEffect,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";

import { formatDate } from "./dates";

import { getLibraryRelease, type LibraryRelease } from "./api/client";
import { HomePage } from "./pages/home";
import { ThemeIcon } from "./icons";
import { matchRoute, type Route, type RouteMatch } from "./routes";
import { useNoindex, usePageMeta } from "./page-meta";
import { NOT_FOUND_META } from "./route-meta";
import { settleNavigation, startRouter, useLocationKey } from "./router";
import { applyTheme, chooseTheme, currentTheme, followSystem, type Theme } from "./theme";

function NotFoundPage() {
  usePageMeta(NOT_FOUND_META);
  useNoindex();
  return (
    <main className="status-panel">
      <h1>Not found</h1>
      <p>This spark has not been forged. Try one of these instead.</p>
      <p className="status-actions">
        <a className="text-link" href="/">
          Home
        </a>{" "}
        ·{" "}
        <a className="text-link" href="/recipes">
          Recipes
        </a>{" "}
        ·{" "}
        <a className="text-link" href="/install">
          Install
        </a>
      </p>
    </main>
  );
}

// A page whose code cannot load or whose render throws leaves a way out instead of a blank site.
class PageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="status-panel error" role="alert">
        <h1>This page could not be loaded</h1>
        <p>The site may have been updated while this page was open.</p>
        <p className="status-actions">
          <button type="button" className="button" onClick={() => window.location.reload()}>
            Reload
          </button>
        </p>
      </main>
    );
  }
}

type PageProps = RouteMatch["params"];

// One entry per route in routes.ts (the type makes a missing one a compile error). Home is in the entry
// chunk; every other page is its own chunk, loaded before navigation shows it (see `preparePage`).
const PAGE_LOADERS: Record<Route, () => Promise<{ default: ComponentType<PageProps> }>> = {
  "/": async () => ({ default: HomePage }),
  "/architecture": () =>
    import("./pages/architecture").then((m) => ({ default: m.ArchitecturePage })),
  "/control": () => import("./pages/control").then((m) => ({ default: m.ControlPage })),
  "/example-setup": () => import("./pages/showcase").then((m) => ({ default: m.ShowcasePage })),
  "/install": () => import("./pages/install").then((m) => ({ default: m.InstallPage })),
  "/models": () => import("./pages/models").then((m) => ({ default: m.ModelsPage })),
  "/models/:publisher/:slug": () =>
    import("./pages/models").then((m) => ({ default: m.ModelDetailPage })),
  "/privacy": () => import("./pages/privacy").then((m) => ({ default: m.PrivacyPage })),
  "/publish": () =>
    import("./pages/publishing-guide").then((m) => ({ default: m.PublishingGuidePage })),
  "/recipes": () => import("./pages/recipes").then((m) => ({ default: m.RecipesPage })),
  "/recipes/:publisher/:slug": () =>
    import("./pages/recipe-detail").then((m) => ({ default: m.RecipeDetailPage })),
};

const PAGES = Object.fromEntries(
  Object.entries(PAGE_LOADERS).map(([route, load]) => [route, lazy(load)]),
) as unknown as Record<Route, ComponentType<PageProps>>;

// Loads the code of the page at `pathname` (nothing for an unknown path, which renders the not-found page).
export function preparePage(pathname: string): Promise<unknown> {
  const match = matchRoute(pathname);
  return match ? PAGE_LOADERS[match.route]() : Promise.resolve();
}

function CurrentPage() {
  const match = matchRoute(window.location.pathname);
  if (!match) return <NotFoundPage />;
  const Page = PAGES[match.route];
  return <Page {...match.params} />;
}

// The release this site serves (its tag is the contract version), read once from the small
// manifest. Until it is read, or if it cannot be, the pill and the footer line are not drawn.
function useLibraryRelease(): LibraryRelease | null {
  const [release, setRelease] = useState<LibraryRelease | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    getLibraryRelease(controller.signal)
      .then(setRelease)
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  return release;
}

function releaseUrl(release: LibraryRelease): string {
  return `https://github.com/CarstVaartjes/vonk-forge-recipes/releases/tag/${release.version}`;
}

function LibraryVersion({ release }: { release: LibraryRelease | null }) {
  if (!release) return null;
  return (
    <p className="library-version">
      Recipe library <a href={releaseUrl(release)}>{release.version}</a> · Updated{" "}
      {formatDate(release.updated_at)} · Index <code>{release.index_sha256.slice(0, 12)}</code>
    </p>
  );
}

function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>(currentTheme);
  useEffect(
    () =>
      followSystem((next) => {
        applyTheme(next);
        setTheme(next);
      }),
    [],
  );
  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      className="theme-switch"
      aria-label={`Switch to ${next} theme`}
      onClick={() => {
        chooseTheme(next);
        setTheme(next);
      }}
    >
      <ThemeIcon theme={theme} />
    </button>
  );
}

// A top-level entry is current on its own path and on the pages it groups.
function NavigationLink({
  href,
  children,
  primary = false,
  also = [],
}: {
  href: string;
  children: string;
  primary?: boolean;
  also?: string[];
}) {
  const path = window.location.pathname;
  const current = [href, ...also].some((root) => path === root || path.startsWith(`${root}/`));
  return (
    <a
      aria-current={current ? "page" : undefined}
      className={
        [primary ? "nav-primary" : "", current ? "is-active" : ""].filter(Boolean).join(" ") ||
        undefined
      }
      href={href}
    >
      {children}
    </a>
  );
}

export function App() {
  const release = useLibraryRelease();
  const [menuOpen, setMenuOpen] = useState(false);
  // The page shown follows the router's location, which only an in-app navigation or the back button changes.
  const location = useLocationKey();
  useEffect(() => startRouter(preparePage), []);
  useLayoutEffect(() => {
    setMenuOpen(false);
    settleNavigation();
  }, [location]);
  // Escape closes the phone menu and hands focus back to its button.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      document.querySelector<HTMLButtonElement>(".menu-button")?.focus();
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [menuOpen]);
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <div className="site-shell">
        <header className="site-header">
          <a className="brand" href="/" aria-label="Vonk Forge home">
            <span aria-hidden="true" className="brand-mark">
              <i />
              <i />
              <i />
            </span>
            <span className="brand-name">
              <strong>Vonk</strong> Forge
            </span>
          </a>
          <nav
            aria-label="Primary navigation"
            className={menuOpen ? "is-open" : undefined}
            id="primary-nav"
          >
            <NavigationLink href="/recipes">Recipes</NavigationLink>
            <NavigationLink href="/models">Models</NavigationLink>
            <NavigationLink href="/control">Controller</NavigationLink>
            <NavigationLink href="/architecture">How it works</NavigationLink>
          </nav>
          <div className="site-header-end">
            {release && (
              <a className="release-pill" href={releaseUrl(release)}>
                Catalog <b>{release.version}</b> · updated {formatDate(release.updated_at)}
              </a>
            )}
            <ThemeSwitch />
            <NavigationLink primary href="/install">
              Install
            </NavigationLink>
            <button
              type="button"
              className="menu-button"
              aria-expanded={menuOpen}
              aria-controls="primary-nav"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              Menu
            </button>
          </div>
        </header>
        <div id="main-content" tabIndex={-1}>
          <PageBoundary key={location}>
            <Suspense fallback={null}>
              <CurrentPage />
            </Suspense>
          </PageBoundary>
        </div>
        <footer className="site-footer">
          <div>
            <p>
              <strong>Vonk Forge</strong> · Models that fit your Sparks, kept current. Open-source
              local control for NVIDIA DGX Spark.
            </p>
            <LibraryVersion release={release} />
          </div>
          <nav aria-label="Footer navigation">
            <a href="/recipes">Recipes</a>
            <a href="/models">Models</a>
            <a href="/install">Install</a>
            <a href="/architecture">How it works</a>
            <a href="/control">Controller</a>
            <a href="/example-setup">Example setup</a>
            <a href="/publish">Publish</a>
            <a href="/privacy">Privacy</a>
            <a href="https://github.com/CarstVaartjes/vonk-forge">GitHub</a>
          </nav>
        </footer>
      </div>
    </>
  );
}
