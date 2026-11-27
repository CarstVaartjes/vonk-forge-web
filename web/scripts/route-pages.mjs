// After `vite build`: give every address of the site its own HTML file, so a crawler or a link
// preview (which run no JavaScript) sees that page's title, description and canonical address.
// The addresses come from ROUTES, the recipe and Model pages from the verified catalog index the
// build ships under dist/catalog. The same step writes the sitemap, robots.txt, the 404 page and
// the HTML cache rules. Cloudflare Pages serves `/install` from `install.html`; an address with no
// file gets the 404 page (the same app, which shows its not-found view), with a real 404 status.
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { modelsFromIndex, parseLibraryIndex, recipesFromIndex } from "../src/api/static-catalog.ts";
import {
  NOT_FOUND_META,
  PAGE_META,
  SITE_ORIGIN,
  canonicalUrl,
  modelMeta,
  recipeMeta,
} from "../src/route-meta.ts";
import { ROUTES } from "../src/routes.ts";

const escapeHtml = (text) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

// One path segment of a recipe or Model address, which also becomes a file name.
const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function headTags({ title, description }, pathname) {
  const tags = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
  ];
  if (pathname === null) tags.push('<meta name="robots" content="noindex" />');
  else {
    const url = escapeHtml(canonicalUrl(pathname));
    tags.push(
      `<link rel="canonical" href="${url}" />`,
      `<meta property="og:url" content="${url}" />`,
    );
  }
  return tags.map((tag) => `    ${tag}\n`).join("");
}

function render(template, meta, pathname) {
  if (/<title>|rel="canonical"|name="description"/.test(template))
    throw new Error("index.html must not carry page meta: route-pages.mjs writes it per address");
  const end = template.indexOf("</head>");
  if (end < 0) throw new Error("index.html has no </head>");
  return `${template.slice(0, end).trimEnd()}\n${headTags(meta, pathname)}  ${template.slice(end)}`;
}

// Every page address with its meta. A new route with parameters needs its addresses listed here.
function pages(index) {
  const entries = [];
  const add = (publisher, slug, prefix, meta) => {
    if (!SEGMENT.test(publisher) || !SEGMENT.test(slug))
      throw new Error(`unsafe address ${prefix}/${publisher}/${slug}`);
    entries.push([`${prefix}/${publisher}/${slug}`, meta]);
  };
  for (const route of ROUTES) {
    if (route in PAGE_META) entries.push([route, PAGE_META[route]]);
    else if (route === "/recipes/:publisher/:slug")
      for (const recipe of recipesFromIndex(index))
        add(recipe.publisher, recipe.slug, "/recipes", recipeMeta(recipe.title));
    else if (route === "/models/:publisher/:slug")
      for (const model of modelsFromIndex(index))
        add(model.publisher, model.slug, "/models", modelMeta(model.title));
    else throw new Error(`route-pages.mjs does not know the addresses of ${route}`);
  }
  return new Map(entries);
}

// The files to write into dist, by path relative to dist. Pure, for the test.
export function routeFiles({ template, index, release }) {
  const byPath = pages(parseLibraryIndex(index, release));
  const files = new Map();
  for (const [pathname, meta] of byPath)
    files.set(
      pathname === "/" ? "index.html" : `${pathname.slice(1)}.html`,
      render(template, meta, pathname),
    );
  files.set("404.html", render(template, NOT_FOUND_META, null));
  const urls = Array.from(
    byPath.keys(),
    (pathname) => `  <url><loc>${escapeHtml(canonicalUrl(pathname))}</loc></url>\n`,
  );
  files.set(
    "sitemap.xml",
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("")}</urlset>\n`,
  );
  files.set("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`);
  // A page is never kept stale after a deploy. `_headers` matches the request path, which has no
  // `.html`, so the rules name each route (a parameter becomes a splat).
  const htmlRules = ROUTES.map((route) => route.replace("/:publisher/:slug", "/*"));
  files.set("_headers", htmlRules.map((rule) => `\n${rule}\n  Cache-Control: no-cache\n`).join(""));
  return files;
}

async function main() {
  const dist = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), "dist");
  const read = (name) => readFile(path.join(dist, name), "utf8");
  const files = routeFiles({
    template: await read("index.html"),
    index: JSON.parse(await read("catalog/catalog-index.json")),
    release: JSON.parse(await read("catalog/release.json")),
  });
  for (const [name, content] of files) {
    const target = path.join(dist, name);
    await mkdir(path.dirname(target), { recursive: true });
    // `_headers` already holds the security headers from public/; the HTML rules go after them.
    if (name === "_headers") await appendFile(target, content);
    else await writeFile(target, content);
  }
  console.log(`Wrote ${files.size} route files to ${path.relative(process.cwd(), dist)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
