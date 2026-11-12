// A recipe is verified on Spark when the vocabulary of the release that published it says its
// status counts as verified; the adapter resolves that once (src/vocabulary.ts).
export const isVerified = (recipe: { catalog: { verified: boolean } }): boolean => recipe.catalog.verified;
