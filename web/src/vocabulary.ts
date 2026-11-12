// The words for capabilities, model types and qualification statuses come from the recipe
// library release (`CatalogIndex.vocabulary`), not from this site: the contract owns the names
// and their labels, descriptions, categories and whether a status counts as verified, so the
// site, the Controller and vonkctl show the same text. Loaded under Node by the release build,
// so runtime imports use .ts.
import type { CatalogVocabulary } from "./api/catalog-types.ts";

export type Vocabulary = CatalogVocabulary;

// A model type is a capability category. A model can be several types (a vision-language
// model is Language and Vision); a capability the vocabulary does not know is no type.
export function typesOf(vocabulary: Vocabulary, capabilities: readonly string[]): string[] {
  const categories = new Set(capabilities.flatMap((name) => vocabulary.capabilities.find((capability) => capability.name === name)?.category ?? []));
  return vocabulary.categories.map((category) => category.id).filter((id) => categories.has(id));
}

// Only the vocabulary says which statuses count as verified on a Spark.
export function isVerifiedStatus(vocabulary: Vocabulary, status: string): boolean {
  return vocabulary.statuses.some((entry) => entry.status === status && entry.verified);
}

// Shown as published; a name this release does not know is shown as its name.
export function capabilityLabel(vocabulary: Vocabulary, name: string): string {
  return vocabulary.capabilities.find((capability) => capability.name === name)?.label ?? name;
}

export function typeLabel(vocabulary: Vocabulary, id: string): string {
  return vocabulary.categories.find((category) => category.id === id)?.label ?? id;
}

export function statusMeaning(vocabulary: Vocabulary, status: string): string | undefined {
  return vocabulary.statuses.find((entry) => entry.status === status)?.meaning;
}
