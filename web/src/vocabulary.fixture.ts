// The real vocabulary of the release (catalog.fixture.ts), and the two recipe facts the adapter
// derives from it, for tests that build recipe summaries by hand.
import { catalogIndexFixture } from "./api/catalog.fixture";
import type { RecipeSummary } from "./api/client";
import type { ServedFact } from "./served";
import { isVerifiedStatus, typesOf } from "./vocabulary";

export const vocabularyFixture = catalogIndexFixture.vocabulary;

// `capabilities` are the model's declared capabilities (they give the types); `served` is what the
// recipe launch serves and defaults to nothing declared.
export function catalogFacts({
  capabilities,
  served = [],
  ...facts
}: Omit<RecipeSummary["catalog"], "types" | "verified" | "served"> & {
  capabilities: string[];
  served?: ServedFact[];
}): RecipeSummary["catalog"] {
  return {
    ...facts,
    served,
    types: typesOf(vocabularyFixture, capabilities),
    verified: isVerifiedStatus(vocabularyFixture, facts.qualification),
  };
}
