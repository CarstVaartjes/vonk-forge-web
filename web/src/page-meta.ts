import { useEffect } from "react";

import { canonicalUrl, type PageMeta } from "./route-meta";

function headTag<T extends HTMLElement>(selector: string, create: () => T): T {
  let tag = document.head.querySelector<T>(selector);
  if (!tag) {
    tag = create();
    document.head.append(tag);
  }
  return tag;
}

function metaTag(attribute: "name" | "property", key: string): HTMLMetaElement {
  return headTag(`meta[${attribute}="${key}"]`, () => {
    const tag = document.createElement("meta");
    tag.setAttribute(attribute, key);
    return tag;
  });
}

// Each route names itself (route-meta.ts): the tab title, the description a search result or a
// pasted link may show, and its own canonical address. The build writes the same values into the
// address's HTML file; this keeps them right when a visitor moves between pages.
export function usePageMeta({ title, description }: PageMeta) {
  useEffect(() => {
    const url = canonicalUrl(window.location.pathname);
    document.title = title;
    metaTag("name", "description").content = description;
    metaTag("property", "og:title").content = title;
    metaTag("property", "og:description").content = description;
    metaTag("property", "og:url").content = url;
    metaTag("name", "twitter:title").content = title;
    metaTag("name", "twitter:description").content = description;
    headTag<HTMLLinkElement>('link[rel="canonical"]', () => {
      const link = document.createElement("link");
      link.rel = "canonical";
      return link;
    }).href = url;
  }, [title, description]);
}

// A page that is not part of the site (the not-found view, an entry that is not in the index) asks
// search engines to skip it.
export function useNoindex(active = true) {
  useEffect(() => {
    if (!active) return;
    const tag = document.createElement("meta");
    tag.name = "robots";
    tag.content = "noindex";
    document.head.append(tag);
    return () => tag.remove();
  }, [active]);
}
