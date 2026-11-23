import { useSyncExternalStore } from "react";

import { matchRoute } from "./routes";

// The one owner of in-app navigation: history.pushState / popstate over the single route list in routes.ts.
// A click on a same-origin link to a known route is handled here; everything else (modified clicks, new
// tabs, downloads, other origins, unknown paths, same-page #anchors) is left to the browser.

type Listener = () => void;
type Pending = { kind: "push" | "pop"; hash: string; scrollY: number };

const listeners = new Set<Listener>();
// What the app shows: a counter plus the address. Only this module changes it, so a page that rewrites its
// own query string with replaceState does not remount itself; every navigation that changes the path or the
// query bumps the counter, so it always remounts (a link to /recipes from a filtered /recipes resets it).
let serial = 0;
let current = `${serial}|${locationKey()}`;
// The path and query of the last address seen, kept true through the pages' own replaceState (see startRouter).
let lastAddress = locationKey();
let pending: Pending | null = null;
let ticket = 0;

function locationKey(): string {
  return `${window.location.pathname}${window.location.search}`;
}

function setCurrent(): void {
  serial += 1;
  current = `${serial}|${locationKey()}`;
  lastAddress = locationKey();
  for (const listener of listeners) listener();
}

export function useLocationKey(): string {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => current,
    () => current,
  );
}

function rememberScroll(): void {
  window.history.replaceState(
    { ...(window.history.state as object | null), scrollY: window.scrollY },
    "",
  );
}

function linkTarget(event: MouseEvent): URL | null {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return null;
  const anchor = (event.target as Element | null)?.closest?.("a");
  if (!anchor?.hasAttribute("href") || anchor.hasAttribute("download")) return null;
  if (anchor.target && anchor.target !== "_self") return null;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin || !matchRoute(url.pathname)) return null;
  // A link to a spot on the page we are on is the browser's own.
  if (
    url.hash &&
    url.pathname === window.location.pathname &&
    url.search === window.location.search
  )
    return null;
  return url;
}

// Runs once per navigation, after the new page is committed: scroll, then focus.
export function settleNavigation(): void {
  const done = pending;
  pending = null;
  if (!done) return;
  const main = document.getElementById("main-content");
  if (done.kind === "pop") restoreScroll(done.scrollY);
  else if (done.hash && document.getElementById(decodeURIComponent(done.hash.slice(1))))
    document.getElementById(decodeURIComponent(done.hash.slice(1)))!.scrollIntoView();
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
    return found && (found.checkVisibility?.() ?? found.getClientRects().length > 0) ? found : null;
  };
  const focus = (target: HTMLElement) => {
    target.tabIndex = -1;
    target.focus({ preventScroll: true });
  };
  const first = visibleHeading();
  if (first) {
    focus(first);
    return;
  }
  focus(main);
  const watch = new MutationObserver(() => {
    const found = visibleHeading();
    if (!found) return;
    watch.disconnect();
    if (document.activeElement === main || document.activeElement === document.body) focus(found);
  });
  watch.observe(main, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["style", "hidden"],
  });
  window.setTimeout(() => watch.disconnect(), 10_000);
}

// `prepare` loads what a route needs (its code chunk) before it is shown, so a page never flashes a spinner.
// If that fails (a deploy replaced the chunk since this page opened) the browser loads the address itself.
export function startRouter(prepare: (pathname: string) => Promise<unknown>): () => void {
  const previousRestoration = window.history.scrollRestoration;
  window.history.scrollRestoration = "manual";
  // A page rewrites its own query with replaceState; keep the last address true.
  const replaceState = window.history.replaceState;
  window.history.replaceState = function (
    this: History,
    ...args: Parameters<History["replaceState"]>
  ) {
    replaceState.apply(this, args);
    lastAddress = locationKey();
  };

  async function show(url: URL, kind: Pending["kind"], scrollY = 0): Promise<void> {
    const mine = ++ticket;
    try {
      await prepare(url.pathname);
    } catch {
      if (mine !== ticket) return;
      if (kind === "push") window.location.assign(url.href);
      else window.location.reload();
      return;
    }
    if (mine !== ticket) return;
    const address = `${url.pathname}${url.search}`;
    // A link to the page we are on (path and query) adds no history entry and keeps the page.
    const samePage = kind === "push" && address === locationKey();
    if (kind === "push") {
      if (samePage) window.history.replaceState(window.history.state, "", `${address}${url.hash}`);
      else {
        rememberScroll();
        window.history.pushState({ scrollY: 0 }, "", `${address}${url.hash}`);
      }
    }
    pending = { kind, hash: url.hash, scrollY };
    if (samePage) settleNavigation();
    else setCurrent();
  }

  const onClick = (event: MouseEvent) => {
    const url = linkTarget(event);
    if (!url) return;
    event.preventDefault();
    void show(url, "push");
  };
  const onPopState = () => {
    const before = lastAddress;
    lastAddress = locationKey();
    // A step that changes only the hash is the browser's own scroll to an anchor: nothing to show.
    if (lastAddress === before) return;
    void show(
      new URL(window.location.href),
      "pop",
      (window.history.state as { scrollY?: number } | null)?.scrollY ?? 0,
    );
  };
  document.addEventListener("click", onClick);
  window.addEventListener("popstate", onPopState);
  return () => {
    document.removeEventListener("click", onClick);
    window.removeEventListener("popstate", onPopState);
    window.history.replaceState = replaceState;
    window.history.scrollRestoration = previousRestoration;
  };
}
