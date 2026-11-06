// Checks every registered single-source value in the tracked files. The file
// list is the input: CI pipes it in, so no code here runs git.
//   git ls-files -z | node web/scripts/check-single-sources.mjs
// Paths are relative to the repository root; they are resolved from this file,
// not from the working directory.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkSingleSources, registrations } from "./single-source-values.mjs";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

export function readSources(listing, read = (file) => readFileSync(path.join(repositoryRoot, file), "utf8")) {
  return new Map(listing.split("\0").filter(Boolean).map((file) => [file, read(file)]));
}

// Empty or failed input names no registration; that must fail, never pass.
export function problems(files) {
  return registrations(files).length ? checkSingleSources(files) : ["no *.single-source.json registration in the input"];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = problems(readSources(readFileSync(0, "utf8")));
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(1);
  }
}
