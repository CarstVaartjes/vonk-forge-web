// Checks every registered single-source value in the tracked files. The file
// list is the input: CI pipes it in, so no code here runs git.
//   git ls-files -z | node web/scripts/check-single-sources.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { checkSingleSources } from "./single-source-values.mjs";

export function readSources(listing, read = (file) => readFileSync(file, "utf8")) {
  return new Map(listing.split("\0").filter(Boolean).map((file) => [file, read(file)]));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = checkSingleSources(readSources(readFileSync(0, "utf8")));
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(1);
  }
}
