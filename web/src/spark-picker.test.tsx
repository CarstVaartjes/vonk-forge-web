import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import { summaryFixture } from "./catalog-summary.fixture";
import { useMySparks } from "./my-sparks";
import { FitAnswerView, FitResults, SparkSegments, TypeChips } from "./spark-picker";

function Harness() {
  const [pick, setPick] = useMySparks();
  return (
    <>
      <SparkSegments value={pick.sparks} onChange={(sparks) => setPick({ sparks })} />
      <FitAnswerView summary={summaryFixture} pick={pick} />
      <TypeChips summary={summaryFixture} pick={pick} onChange={(type) => setPick({ type })} />
      <FitResults summary={summaryFixture} pick={pick} />
    </>
  );
}

afterEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});

test("answers with the verified total until a count is picked, then names the count, in a polite live region", () => {
  const { container } = render(<Harness />);
  const answer = () => container.querySelector(".answer")!;
  expect(answer()).toHaveAttribute("aria-live", "polite");
  expect(answer()).toHaveTextContent("3recipes verified on a real DGX Spark, out of 4 in the catalog.");
  const one = screen.getByRole("button", { name: "1 Spark" });
  fireEvent.click(one);
  expect(one).toHaveAttribute("aria-pressed", "true");
  expect(answer()).toHaveTextContent("3verified recipes run on one Spark.");
  expect(container.querySelector(".answer-breakdown")).toHaveTextContent("3 use one. Your Controller checks the exact memory and disk fit before it runs anything.");
  fireEvent.click(screen.getByRole("button", { name: "2 Sparks" }));
  expect(answer()).toHaveTextContent("3verified recipes run on 2 Sparks.");
});

test("the choice lands in the URL and is remembered; a type narrows the answer and links the filtered catalog", () => {
  const { container } = render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "2 Sparks" }));
  fireEvent.click(within(screen.getByRole("group", { name: "Model type" })).getByRole("button", { name: "3D: 1" }));
  expect(window.location.search).toBe("?sparks=2&type=3d");
  expect(localStorage.getItem("vonk-my-sparks")).toBe("sparks=2&type=3d");
  expect(container.querySelector(".answer")).toHaveTextContent("1verified 3D recipes run on 2 Sparks.");
  expect(screen.getByRole("link", { name: "See all 1 in the catalog" })).toHaveAttribute("href", "/recipes?sparks=2&type=3d");
});

test("lists the five newest verified recipes that fit, newest first, each linking to its recipe", () => {
  const row = summaryFixture.recipes[0]!;
  const six = { ...summaryFixture, recipes: Array.from({ length: 6 }, (_, index) => ({ ...row, slug: `r${index}`, released: `2026-11-0${index + 1}` })) };
  render(<FitResults summary={six} pick={{ sparks: "", type: "" }} />);
  const items = within(screen.getByRole("region", { name: "Newest that fit" })).getAllByRole("listitem");
  expect(items.map((item) => within(item).getAllByRole("link")[0]!.getAttribute("href"))).toEqual(["r5", "r4", "r3", "r2", "r1"].map((slug) => `/recipes/${row.publisher}/${slug}`));
});
