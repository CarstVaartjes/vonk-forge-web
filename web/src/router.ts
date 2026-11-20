import { useSyncExternalStore } from "react";

import { matchRoute } from "./routes";

// The one owner of in-app navigation: history.pushState / popstate over the single route list in routes.ts.
// A click on a same-origin link to a known route is handled here; everything else (modified clicks, new
// tabs, downloads, other origins, unknown paths, same-page #anchors) is left to the browser.

type Listener = () => void;
type Pending = { kind: "push" | "pop"; hash: string; scrollY: number };

const listeners = new Set<Listener>();
// What the app shows. Only this module changes it: a page that rewrites its own query string with
// replaceState must not remount itself.
let current = locationKey();
let pending: Pending | null = null;
let ticket = 0;

function locationKey(): string {
  return `${window.location.pathname}${window.location.search}`;
}

function setCurrent(): void {
  current = locationKey();
  for (const listener of listeners) listener();
}

export function useLocationKey(): string {
  return useSyncExternalStore((listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => current, () => current);
}

function rememberScroll(): void {
  window.history.replaceState({ ...(window.history.state as object | null), scrollY: window.scrollY }, "");
}

function linkTarget(event: MouseEvent): URL | null {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const anchor = (event.target as Element | null)?.closest?.("a");
  if (!anchor || !anchor.hasAttribute("href") || anchor.hasAttribute("download")) return null;
  if (anchor.target && anchor.target !== "_self") return null;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin || !matchRoute(url.pathname)) return null;
  // A link to a spot on the page we are on is the browser's own.
  if (url.hash && url.pathname === window.location.pathname && url.search === window.location.search) return null;
  return url;
}

// Runs once per navigation, after the new page is committed: scroll, then focus.
export function settleNavigation(): void {
  const done = pending;
  pending = null;
  if (!done) return;
  const main = document.getElementById("main-content");
  if (done.kind === "pop") restoreScroll(done.scrollY);
  else if (done.hash && document.getElementById(decodeURIComponent(done.hash.slice(1)))) document.getElementById(decodeURIComponent(done.hash.slice(1)))!.scrollIntoView();
  else window.scrollTo(0, 0);
  focusHeading(main);
}

// The page may still be growing (data arriving), so retry briefly until the old position exists.
function restoreScroll(y: number): void {
  let frames = 0;
  const step = () => {
    window.scrollTo(0, y);
    if (Math.abs(window.scrollY - y) > 1 && frames++ < 60) requestAnimationFrame(step);
  };
  step();
}

// Focus moves to the new page's heading so a screen reader announces the page. While the page is not
// there yet (its code or data is arriving, and the old page may still be hiding in the DOM), the container
// holds focus and the heading gets it as soon as it is visible, unless the visitor has moved on by then.
function focusHeading(main: HTMLElement | null): void {
  if (!main) return;
  const visibleHeading = () => {
    const found = main.querySelector<HTMLElement>("h1");
    return found?.checkVisibility() ? found : null;
  };
  const focus = (target: HTMLElement) => { target.tabIndex = -1; target.focus({ preventScroll: true }); };
  const first = visibleHeading();
  if (first) { focus(first); return; }
  focus(main);
  const watch = new MutationObserver(() => {
    const found = visibleHeading();
    if (!found) return;
    watch.disconnect();
    if (document.activeElement === main || document.activeElement === document.body) focus(found);
  });
  watch.observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "hidden"] });
  window.setTimeout(() => watch.disconnect(), 10_000);
}

// `prepare` loads what a route needs (its code chunk) before it is shown, so a page never flashes a spinner.
export function startRouter(prepare: (pathname: string) => Promise<unknown>): () => void {
  const previousRestoration = window.history.scrollRestoration;
  window.history.scrollRestoration = "manual";

  async function show(url: URL, kind: Pending["kind"], scrollY = 0): Promise<void> {
    const mine = ++ticket;
    await prepare(url.pathname).catch(() => undefined);
    if (mine !== ticket) return;
    if (kind === "push") {
      const address = `${url.pathname}${url.search}${url.hash}`;
      // A link to the page we are on adds no history entry.
      if (`${url.pathname}${url.search}` === locationKey()) window.history.replaceState(window.history.state, "", address);
      else { rememberScroll(); window.history.pushState({ scrollY: 0 }, "", address); }
    }
    pending = { kind, hash: url.hash, scrollY };
    if (locationKey() === current) settleNavigation(); else setCurrent();
  }

  const onClick = (event: MouseEvent) => {
    const url = linkTarget(event);
    if (!url) return;
    event.preventDefault();
    void show(url, "push");
  };
  const onPopState = () => {
    const url = new URL(window.location.href);
    // A hash change on the same page needs nothing from us.
    if (locationKey() === current) return;
    void show(url, "pop", (window.history.state as { scrollY?: number } | null)?.scrollY ?? 0);
  };
  document.addEventListener("click", onClick);
  window.addEventListener("popstate", onPopState);
  return () => {
    document.removeEventListener("click", onClick);
    window.removeEventListener("popstate", onPopState);
    window.history.scrollRestoration = previousRestoration;
  };
}
