import { useEffect } from "react";

export const SITE_NAME = "Vonk Forge";

// The site-wide title and description index.html ships, read before any page changes them: the home page
// puts them back when a visitor navigates to it from another page.
const SITE_TITLE = document.title;
const SITE_DESCRIPTION =
  document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ?? "";

function descriptionTag(): HTMLMetaElement {
  let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (!tag) {
    tag = document.createElement("meta");
    tag.name = "description";
    document.head.append(tag);
  }
  return tag;
}

// Each route names itself: the tab title ("Install · Vonk Forge") and the
// description a search result or a pasted link may show. The home page does not
// call it: index.html owns the site-wide title and description.
export function usePageMeta(page: string, description: string) {
  useEffect(() => {
    document.title = `${page} · ${SITE_NAME}`;
    descriptionTag().content = description;
  }, [page, description]);
}

export function useSiteMeta() {
  useEffect(() => {
    document.title = SITE_TITLE;
    if (SITE_DESCRIPTION) descriptionTag().content = SITE_DESCRIPTION;
  }, []);
}

// A page that is not part of the site (the not-found view) asks search engines to skip it.
export function useNoindex() {
  useEffect(() => {
    const tag = document.createElement("meta");
    tag.name = "robots";
    tag.content = "noindex";
    document.head.append(tag);
    return () => tag.remove();
  }, []);
}
