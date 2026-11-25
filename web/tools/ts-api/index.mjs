// The TypeScript compiler API and openapi-typescript, pinned to typescript 5.
// openapi-typescript peers typescript ^5, so it cannot share the root's
// typescript 7 (whose programmatic API differs). The root type-checks with 7; the
// scripts that need the compiler API or openapi-typescript import it from here.
export { default as openapiTS, astToString } from "openapi-typescript";
export { default as ts } from "typescript";
