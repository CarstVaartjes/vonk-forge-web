import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";

import { BarSeries } from "./bar-series";

const points = [{ range: "1 Nov to 7 Nov", count: 2 }, { range: "8 Nov to 14 Nov", count: 9 }, { range: "15 Nov to 21 Nov", count: 4 }];

test("totals in the group's label, a table of every bar, and labels only on the peak and the newest bar", () => {
  const { container } = render(<BarSeries title="Recipes released per week" noun="recipes" points={points} axis={["week of 1 Nov", "week of 15 Nov"]} />);
  expect(screen.getByRole("group", { name: "Recipes released per week: 15 recipes, peak 9 in 8 Nov to 14 Nov" })).toBeVisible();
  const rows = within(screen.getByRole("table", { name: "Recipes released per week" })).getAllByRole("row");
  expect(rows.map((row) => row.textContent)).toEqual(["Datesrecipes", "1 Nov to 7 Nov2", "8 Nov to 14 Nov9", "15 Nov to 21 Nov4"]);
  expect([...container.querySelectorAll(".bar em")].map((label) => label.textContent)).toEqual(["9", "4"]);
  expect([...container.querySelectorAll<HTMLElement>(".bar")].map((bar) => bar.style.height)).toEqual(["22.22222222222222%", "100%", "44.44444444444444%"]);
});
