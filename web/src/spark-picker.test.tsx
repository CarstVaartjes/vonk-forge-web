import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import { summaryFixture } from "./catalog-summary.fixture";
import { fitAnswer, useMySparks } from "./my-sparks";
import { FitAnswerView, FitResults, SparkPicker, TypeChips } from "./spark-picker";

function Harness() {
  const [pick, setPick] = useMySparks();
  return (
    <>
      <SparkPicker value={pick.sparks} onChange={(sparks) => setPick({ sparks })} />
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
  const total = summaryFixture.verified;
  expect(container.querySelector(".answer")).toHaveAttribute("aria-live", "polite");
  expect(container.querySelector(".answer")).toHaveTextContent(`${total}recipes verified on a real DGX Spark, out of ${summaryFixture.total} in the catalog.`);
  const one = screen.getByRole("button", { name: "1 Spark" });
  fireEvent.click(one);
  expect(one).toHaveAttribute("aria-pressed", "true");
  expect(container.querySelector(".answer")).toHaveTextContent(`${fitAnswer(summaryFixture, { sparks: "1", type: "" }).count}verified recipes run on one Spark.`);
  expect(container.querySelector(".answer-breakdown")).toHaveTextContent("use one");
  expect(container.querySelector(".answer-breakdown")).toHaveTextContent("Your Controller checks the exact memory and disk fit before it runs anything.");
});

test("the choice lands in the URL and is remembered; a type narrows the answer and links the filtered catalog", () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "2 Sparks" }));
  const types = within(screen.getByRole("group", { name: "Model type" }));
  const chip = summaryFixture.types.find((type) => summaryFixture.recipes.some((row) => row.verified && row.types.includes(type.id)))!;
  fireEvent.click(types.getByRole("button", { name: new RegExp(`^${chip.label}:`) }));
  expect(window.location.search).toBe(`?sparks=2&type=${chip.id}`);
  expect(localStorage.getItem("vonk-my-sparks")).toBe(`sparks=2&type=${chip.id}`);
  expect(screen.getByRole("link", { name: /^See all \d+ in the catalog/ })).toHaveAttribute("href", `/recipes?sparks=2&type=${chip.id}`);
  expect(screen.getByRole("button", { name: new RegExp(`^${chip.label}:`) })).toHaveAttribute("aria-pressed", "true");
});

test("lists at most five newest verified recipes that fit, each linking to its recipe", () => {
  render(<Harness />);
  const items = within(screen.getByRole("region", { name: "Newest that fit" })).getAllByRole("listitem");
  expect(items.length).toBeGreaterThan(0);
  expect(items.length).toBeLessThanOrEqual(5);
  expect(within(items[0]!).getAllByRole("link")[0]!.getAttribute("href")).toMatch(/^\/recipes\/[^/]+\/[^/]+$/);
});
