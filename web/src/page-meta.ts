import { useEffect } from "react";

export const SITE_NAME = "Vonk Forge";

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
// description a search result or a pasted link may show. The home page passes
// no page name and keeps the site-wide title from index.html.
export function usePageMeta(page: string | null, description: string) {
  useEffect(() => {
    if (page) document.title = `${page} · ${SITE_NAME}`;
    descriptionTag().content = description;
  }, [page, description]);
}
