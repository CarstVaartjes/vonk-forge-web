// What each address says about itself: its tab title, its description and its canonical address.
// One owner for both readers: the pages set them at runtime (page-meta.ts), and the build writes
// them into each address's own HTML file (scripts/route-pages.mjs) for crawlers and link previews,
// which run no JavaScript. Nothing here touches the DOM, so Node can load it.
import type { Route } from "./routes.ts";

export const SITE_ORIGIN = "https://vonkforge.ai";
export const SITE_NAME = "Vonk Forge";

export type PageMeta = { title: string; description: string };

const named = (page: string, description: string): PageMeta => ({
  title: `${page} · ${SITE_NAME}`,
  description,
});

// The routes with no parameter: each has one fixed title and description.
export type FixedRoute = Exclude<Route, `${string}:${string}`>;

export const PAGE_META: Record<FixedRoute, PageMeta> = {
  "/": {
    title: "Vonk Forge — Models that fit your Sparks, kept current",
    description:
      "Vonk Forge shows which models fit your NVIDIA DGX Sparks, keeps up with new models and recipes for you, and runs the mix you need in a few clicks or one agent-friendly vonkctl command.",
  },
  "/architecture": named(
    "How it works",
    "How the public catalog, your local Controller and your Spark fleet fit together, and what never leaves your network.",
  ),
  "/control": named(
    "Control",
    "Drive your Vonk Forge fleet from the Web Controller or from vonkctl, the JSON-first CLI built for scripts and AI agents.",
  ),
  "/example-setup": named(
    "Example setup",
    "An example setup: 3D game generation on two DGX Sparks, with the models and recipes it uses.",
  ),
  "/install": named(
    "Install",
    "Install the Vonk Forge Controller on a laptop, NAS or local server with one signed command, then enroll your DGX Sparks.",
  ),
  "/models": named(
    "Models",
    "Browse models with their exact versions, variants and the recipes that run them on DGX Spark.",
  ),
  "/privacy": named("Privacy", "What the Vonk Forge site measures and what it never collects."),
  "/publish": named(
    "Publish a recipe",
    "How to publish a Vonk Forge recipe others can trust, through the recipe repository.",
  ),
  "/recipes": named(
    "Recipes",
    "Browse recipes for NVIDIA DGX Spark, each shown with whether it passed hardware checks, its memory and Spark count.",
  ),
};

export const NOT_FOUND_META = named(
  "Not found",
  "This page does not exist on the Vonk Forge site.",
);

// A recipe or Model page before its entry has loaded (or when it is not in the index) has only the generic text.
export function recipeMeta(title?: string): PageMeta {
  return title
    ? named(
        title,
        `${title}: a recipe for NVIDIA DGX Spark, with its published verification status and install contract.`,
      )
    : named("Recipe", "A Vonk Forge recipe for NVIDIA DGX Spark.");
}

export function modelMeta(title?: string): PageMeta {
  return title
    ? named(
        `${title} · Models`,
        `${title}: published versions, variants and the recipes that run it on NVIDIA DGX Spark.`,
      )
    : named("Model", "A model in the Vonk Forge catalog.");
}

// The production address of a path. Every deployment (production, previews) names this one, so a
// preview never claims to be the original.
export function canonicalUrl(pathname: string): string {
  return `${SITE_ORIGIN}${pathname}`;
}
