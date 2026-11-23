import { render } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

import { ArchitecturePage } from "./architecture";
import { ControlPage } from "./control";
import { HomePage } from "./home";
import { InstallPage } from "./install";
import { PrivacyPage } from "./privacy";
import { PublishingGuidePage } from "./publishing-guide";
import { ShowcasePage } from "./showcase";

// The Controller has Overview, Workloads, Library, Activity (and API keys); see
// vonk-forge control/web/src/app.tsx. Site copy must not point readers at any other page.
const controllerPages = new Set(["Overview", "Workloads", "Library", "Activity", "API keys"]);
const staticPages = {
  ArchitecturePage,
  ControlPage,
  HomePage,
  InstallPage,
  PrivacyPage,
  PublishingGuidePage,
  ShowcasePage,
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: false, status: 404 })),
  );
});
afterEach(() => vi.unstubAllGlobals());

function invalidNames(text: string): string[] {
  const found: string[] = [];
  // "the Fleet page", "Settings tab": a capitalised name followed by page/tab/view/screen.
  for (const m of text.matchAll(/\b([A-Z][a-z]+(?: [a-z]+)?) (?:page|tab|view|screen)\b/g)) {
    if (!controllerPages.has(m[1]!)) found.push(m[0]);
  }
  // "in Fleet", "on the Profiles", "Fleet, Library": a removed name used as a location.
  for (const m of text.matchAll(
    /\b(?:in|on|to|from|open) (?:the )?(?:Fleet|Profiles)\b|\b(?:Fleet|Profiles), (?:Library|Activity|Overview|Workloads)\b/g,
  ))
    found.push(m[0]);
  return found;
}

test.each(Object.entries(staticPages))(
  "%s names only Controller pages that exist",
  (_name, Page) => {
    const { container } = render(<Page />);
    expect(invalidNames(container.textContent ?? "")).toEqual([]);
  },
);

test("the guard flags a Fleet page and allows CLI text", () => {
  expect(invalidNames("Open the Fleet page")).toEqual(["Fleet page"]);
  expect(invalidNames("Run vonkctl fleet enroll Atlas on the Overview page")).toEqual([]);
});
