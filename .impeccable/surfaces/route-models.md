---
version: 1
slug: "route-models"
primary_target: "route:/models"
related_targets: ["route:/"]
---

# PublicCatalogExplainer

The models page includes a collapsible, plain-language explanation of the public catalog boundary. Its job is to answer the first operator question quickly: a model is the AI and its exact files; a recipe is one way to run that model. The explanation sits inside the public models index so it can clarify the catalog without competing with search, filters, or the model list.

## Composition

- The closed summary reads “How a model becomes a local run”. When open, a large definition leads into a connected relationship map: one illustrative model branches to Recipe A for one Spark and Recipe B for two Sparks.
- The model panel lists family, version, and variant. Each recipe panel names the engine, Spark count, and settings it supplies. The caption states that recipes change execution while the model files stay the same.
- A second map carries the idea across the public/private boundary: Published catalog → choose a run → Your Controller. The local panel distinguishes model files from the runtime container, then shows download or build → local cache → selected Sparks → application run.
- The final copy names the private Controller as the place to view downloads, running models, and Spark status. It describes saved profiles without implying that this public page can see a private fleet.

## Behavior and responsive form

The explainer is closed by default to preserve catalog scanning. `/models#model-recipe-explainer`, linked from the homepage setup flow, opens it on arrival. On wide screens the model-to-recipes and catalog-to-Controller relationships read horizontally; at narrow widths both become one-column reading paths with vertical connectors, and the local run sequence remains a compact two-column step grid. The native `details` control, semantic headings, text labels, and visible focus keep the explanation usable without relying on color or a diagram alone.

## Visual expression

This local extension inherits the established Onest, warm-ivory, near-black workbench. The panel uses one-pixel rules and restrained tonal layering: orange identifies the public model/source side, while green identifies the local run path and private readiness. Cards stay compact with modest corners; connector lines and short monospace labels make the relationships legible without introducing a new icon set or visual identity.

## Source of truth

The implementation lives in `web/src/pages/models.tsx` (`PublicCatalogExplainer`) and its scoped rules in `web/src/styles.css`; the homepage entry point is `web/src/pages/home.tsx` (`/models#model-recipe-explainer`).
