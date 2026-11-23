// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

// The browsers come from Microsoft's Playwright image, not an install step, so the image
// must be the version @playwright/test resolves to, pinned by digest.
test("every Playwright container image matches the locked @playwright/test version", () => {
  const lock = JSON.parse(read("../package-lock.json"));
  const version = lock.packages["node_modules/@playwright/test"].version;
  for (const file of ["ci.yml", "pages.yml"]) {
    const images = [
      ...read(`../../.github/workflows/${file}`).matchAll(
        /image: (mcr\.microsoft\.com\/playwright:\S+)/g,
      ),
    ].map((m) => m[1]);
    expect(images.length, file).toBeGreaterThan(0);
    for (const image of images)
      expect(image, file).toMatch(
        new RegExp(
          `^mcr\\.microsoft\\.com/playwright:v${version.replaceAll(".", "\\.")}-noble@sha256:[0-9a-f]{64}$`,
        ),
      );
  }
});
