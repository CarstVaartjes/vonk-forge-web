// The site shows the qualification status exactly as the recipe library
// publishes it and keeps no copy of the vocabulary. This is the one status
// the styling needs to know; it is registered in
// `web/src/qualification-status.single-source.json` against the contracts schema.
export const WORKING_STATUS = "Working";

// A recipe is verified on Spark when the library published it as Working.
export const isVerified = (recipe: { catalog: { qualification: string } }): boolean => recipe.catalog.qualification === WORKING_STATUS;

// Shown for an entry whose index record carries no readable status.
export const STATUS_UNAVAILABLE = "Status unavailable";
