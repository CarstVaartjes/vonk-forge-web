// The site shows the qualification status exactly as the recipe library
// publishes it. Beyond the one status the styling needs (below) it keeps only
// the short meanings in STATUS_MEANING, for the legend. It is registered in
// `web/src/qualification-status.single-source.json` against the contracts schema.
export const WORKING_STATUS = "Working";

// A recipe is verified on Spark when the library published it as Working.
export const isVerified = (recipe: { catalog: { qualification: string } }): boolean => recipe.catalog.qualification === WORKING_STATUS;

// Shown for an entry whose index record carries no readable status.
export const STATUS_UNAVAILABLE = "Status unavailable";

// What each published status means, one sentence each, from
// vonk-forge-recipes docs/recipe-authoring.md (the statuses list and the
// catalog `qualification` paragraph). The block lists only statuses the loaded
// catalog carries and shows any status without an entry here as published,
// with no meaning invented for it.
const STATUS_MEANING: Record<string, string> = {
  [WORKING_STATUS]: "Passed on a real DGX Spark for this exact recipe, runtime image and model.",
  "Re-check: worked before": "Passed before, but the recipe, image or model has changed since.",
  "Fix to verify": "A recipe failure was followed by a change to the recipe, image or model.",
  "Failed: recipe": "Failed on a real DGX Spark with the current recipe, image and model.",
  "Not yet verified": "No hardware verdict yet; the reason is shown under the badge.",
};

export const statusMeaning = (status: string): string | undefined => STATUS_MEANING[status];
