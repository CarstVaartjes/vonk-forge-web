// The published catalog index, as typed by the schema that ships in the recipe-library
// release (`npm run catalog` generates catalog.generated.d.ts from it). The adapter
// and its fixtures read contract fields through these types, so a field the contract
// does not have fails `tsc`.
import type { components } from "./catalog.generated";

type Schemas = components["schemas"];

export type CatalogIndex = Schemas["CatalogIndex"];
export type CatalogModelEntry = Schemas["CatalogModelEntry"];
export type CatalogRecipeEntry = Schemas["CatalogRecipeEntry"];
export type CatalogVocabulary = Schemas["CatalogVocabulary"];
