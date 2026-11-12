// The site shows the qualification status exactly as the recipe library
// publishes it and keeps no copy of the vocabulary. This is the one status
// the styling needs to know; it is registered in
// `web/src/qualification-status.single-source.json` against the contracts schema.
export const WORKING_STATUS = "Working";

// A recipe is verified on Spark when the library published it as Working.
export const isVerified = (recipe: { catalog: { qualification: string } }): boolean => recipe.catalog.qualification === WORKING_STATUS;

// Shown for an entry whose index record carries no readable status.
export const STATUS_UNAVAILABLE = "Status unavailable";

// What each published status means, for the "How recipes are verified" block.
// This file is the one place the other status words are written; the block
// lists only statuses the loaded catalog actually carries and shows any status
// without an entry here as published, with no meaning invented for it.
const STATUS_MEANING: Record<string, string> = {
  [WORKING_STATUS]: "Passed hardware checks on a real DGX Spark, for this exact recipe, runtime image and model.",
  "Re-check: worked before": "Passed before. The recipe, image, source or model has changed since, so it needs another hardware run.",
  "Fix to verify": "A failure was traced and a fix is in progress. It will be checked again on hardware.",
  "Failed: recipe": "The last hardware run failed because of the recipe. It needs a fix from its creator.",
  "Not yet verified": "No passing hardware run on record. The reason, such as needing more Sparks than were available to test, is shown under the badge.",
};

export const statusMeaning = (status: string): string | undefined => STATUS_MEANING[status];
