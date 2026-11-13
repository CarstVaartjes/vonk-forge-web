import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";

import { catalogIndexFixture } from "./api/catalog.fixture";
import type { CatalogIndex } from "./api/catalog-types";
import { parseLibraryIndex, recipesFromIndex } from "./api/static-catalog";
import { deriveCatalogStats, type CatalogSummary } from "./catalog-stats";
import { CatalogWall, cellState } from "./catalog-wall";

// The four real recipes of the fixture release: Working gemma and 3D recipes, one of them with a
// measured peak, and an eight-Spark recipe that is not verified.
const index = catalogIndexFixture as CatalogIndex;
const release = { repository: index.repository, tag: "v4.8.0", contract_version: index.contract_version, updated_at: index.updated_at, source_commit: index.source_commit, catalog_index_sha256: "a".repeat(64) };
const stats = deriveCatalogStats(recipesFromIndex(parseLibraryIndex(index, release)), index.vocabulary, index.updated_at);
const summary: CatalogSummary = { summary_version: 2, release: "v4.8.0", catalog_index_sha256: "a".repeat(64), ...stats };

const linkOf = (row: { publisher: string; slug: string }) => document.querySelector(`a[href="/recipes/${row.publisher}/${row.slug}"]`)!;

test("draws one link per recipe with the legend counts of the summary", () => {
  render(<CatalogWall summary={summary} />);
  expect(screen.getAllByRole("link")).toHaveLength(summary.total);
  const legend = within(screen.getByRole("list", { name: "What the marks mean" }));
  expect(legend.getByText(/^Working/)).toHaveTextContent(`Working ${summary.verified}`);
  const states = summary.recipes.map(cellState);
  expect(legend.getByText(/^No hardware pass yet/)).toHaveTextContent(`No hardware pass yet ${states.filter((state) => state === "none").length}`);
  expect(states.filter((state) => state === "verified")).toHaveLength(summary.verified);
});

test("a multi-Spark recipe is one focusable link drawn as joined marks", () => {
  const eight = summary.recipes.find((row) => row.sparks === 8)!;
  render(<CatalogWall summary={summary} />);
  const link = linkOf(eight);
  expect(link.querySelectorAll("i")).toHaveLength(8);
});

test("is one tab stop; arrow keys move between marks and the card names the recipe", () => {
  render(<CatalogWall summary={summary} />);
  const links = screen.getAllByRole("link");
  expect(links.filter((link) => link.tabIndex === 0)).toHaveLength(1);
  links[0]!.focus();
  fireEvent.keyDown(links[0]!, { key: "ArrowRight" });
  expect(document.activeElement).toBe(links[1]);
  expect(links[1]!.tabIndex).toBe(0);
  expect(links[0]!.tabIndex).toBe(-1);
  fireEvent.keyDown(links[1]!, { key: "End" });
  expect(document.activeElement).toBe(links.at(-1));
  const row = summary.recipes.find((item) => links.at(-1)!.getAttribute("href") === `/recipes/${item.publisher}/${item.slug}`)!;
  const card = within(screen.getByText("Open recipe").closest(".wall-card") as HTMLElement);
  expect(card.getByText(row.title)).toBeVisible();
  expect(card.getByText(row.status)).toBeVisible();
});

test("the card says measured only for a recipe the summary has a measured peak for", () => {
  const measured = summary.recipes.find((row) => row.measuredBytes !== null)!;
  const declared = summary.recipes.find((row) => row.measuredBytes === null && row.memoryBytes !== null)!;
  render(<CatalogWall summary={summary} />);
  for (const [row, word] of [[measured, "measured"], [declared, "declared"]] as const) {
    fireEvent.mouseEnter(linkOf(row));
    const card = screen.getByText("Open recipe").closest(".wall-card") as HTMLElement;
    expect(card).toHaveTextContent(`per Spark, ${word}`);
    expect(card).not.toHaveTextContent(word === "measured" ? "declared" : "measured");
  }
});
