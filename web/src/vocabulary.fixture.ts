// The real vocabulary of a release (catalog-factory.fixture.ts), and the two recipe facts the adapter
// derives from it, for tests that build recipe summaries by hand.
import { catalogEnvelope } from "./api/catalog-factory.fixture";
import type { RecipeSummary } from "./api/client";
import { isVerifiedStatus, typesOf } from "./vocabulary";

export const vocabularyFixture = catalogEnvelope.vocabulary;

export function catalogFacts(
  facts: Omit<RecipeSummary["catalog"], "types" | "verified">,
): RecipeSummary["catalog"] {
  return {
    ...facts,
    types: typesOf(vocabularyFixture, facts.capabilities),
    verified: isVerifiedStatus(vocabularyFixture, facts.qualification),
  };
}
