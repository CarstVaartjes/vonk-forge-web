import { useEffect, useState } from "react";

import { getLibraryRelease, type LibraryRelease } from "./api/client";
import { ArchitecturePage } from "./pages/architecture";
import { ControlPage } from "./pages/control";
import { HomePage } from "./pages/home";
import { InstallPage } from "./pages/install";
import { PrivacyPage } from "./pages/privacy";
import { PublishingGuidePage } from "./pages/publishing-guide";
import { RecipeDetailPage } from "./pages/recipe-detail";
import { RecipesPage } from "./pages/recipes";
import { ShowcasePage } from "./pages/showcase";
import { ModelDetailPage, ModelsPage } from "./pages/models";
import { ThemeIcon } from "./icons";
import { applyTheme, chooseTheme, currentTheme, followSystem, type Theme } from "./theme";


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
  if (parts[0] === "example-setup" && parts.length === 1) return <ShowcasePage />;
  if (parts[0] === "publish") {
    return <PublishingGuidePage />;
  }
  return <main className="status-panel"><h1>Not found</h1><p>This spark has not been forged.</p></main>;
}

function dateLabel(value: string, options: Intl.DateTimeFormatOptions): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(date);
}

// The release this site serves (its tag is the contract version), read once from the small
// manifest. Until it is read, or if it cannot be, the pill and the footer line are not drawn.
function useLibraryRelease(): LibraryRelease | null {
  const [release, setRelease] = useState<LibraryRelease | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    getLibraryRelease(controller.signal).then(setRelease).catch(() => undefined);
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
      Recipe library <a href={releaseUrl(release)}>{release.version}</a> · Updated {dateLabel(release.updated_at, { dateStyle: "medium" })} · Index <code>{release.index_sha256.slice(0, 12)}</code>
    </p>
  );
}

function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>(currentTheme);
  useEffect(() => followSystem((next) => { applyTheme(next); setTheme(next); }), []);
  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <button type="button" className="theme-switch" aria-label={`Switch to ${next} theme`} onClick={() => { chooseTheme(next); setTheme(next); }}>
      <ThemeIcon theme={theme} />
    </button>
  );
}

// A top-level entry is current on its own path and on the pages it groups.
function NavigationLink({ href, children, primary = false, also = [] }: { href: string; children: string; primary?: boolean; also?: string[] }) {
  const path = window.location.pathname;
  const current = [href, ...also].some((root) => path === root || path.startsWith(`${root}/`));
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
  const release = useLibraryRelease();
  const [menuOpen, setMenuOpen] = useState(false);
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
      <a className="skip-link" href="#main-content">Skip to content</a>
      <div className="site-shell">
        <header className="site-header">
          <a className="brand" href="/" aria-label="Vonk Forge home">
            <span aria-hidden="true" className="brand-mark"><i /><i /><i /></span>
            <span className="brand-name"><strong>Vonk</strong> Forge</span>
          </a>
          <nav aria-label="Primary navigation" className={menuOpen ? "is-open" : undefined} id="primary-nav">
            <NavigationLink href="/recipes">Catalog</NavigationLink>
            <NavigationLink href="/models">Models</NavigationLink>
            <NavigationLink href="/control">Controller</NavigationLink>
            <NavigationLink href="/architecture">Docs</NavigationLink>
          </nav>
          <div className="site-header-end">
            {release && <a className="release-pill" href={releaseUrl(release)}>Catalog <b>{release.version}</b> · updated {dateLabel(release.updated_at, { day: "numeric", month: "short" })}</a>}
            <ThemeSwitch />
            <NavigationLink primary href="/install">Install</NavigationLink>
            <button type="button" className="menu-button" aria-expanded={menuOpen} aria-controls="primary-nav" onClick={() => setMenuOpen(!menuOpen)}>Menu</button>
          </div>
        </header>
        <div id="main-content" tabIndex={-1}>
          <CurrentPage />
        </div>
        <footer className="site-footer">
          <div>
            <p><strong>Vonk Forge</strong> · Models that fit your Sparks, kept current. Open-source local control for NVIDIA DGX Spark.</p>
            <LibraryVersion release={release} />
          </div>
          <nav aria-label="Footer navigation">
            <a href="/recipes">Catalog</a>
            <a href="/models">Models</a>
            <a href="/install">Install</a>
            <a href="/architecture">How it works</a>
            <a href="/control">Control</a>
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
