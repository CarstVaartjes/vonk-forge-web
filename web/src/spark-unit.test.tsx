import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { SparkUnit } from "./spark-unit";

const GIB = 1024 ** 3;

test("one slab per Spark, measured and declared on one scale", () => {
  const { container } = render(<SparkUnit model="Acme 4bpw" sparks={2} measuredBytes={100 * GIB} declaredBytes={50 * GIB} />);
  expect(screen.getByText("one model across 2 Sparks")).toBeVisible();
  expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual(["Spark 1", "Spark 2"]);
  expect(screen.getAllByText("100.0 GiB")).toHaveLength(2);
  expect(screen.getAllByText("50.0 GiB")).toHaveLength(2);
  expect([...container.querySelectorAll<HTMLElement>(".meter i")].map((bar) => bar.style.width)).toEqual(["100%", "50%", "100%", "50%"]);
  expect(container.querySelector(".spark-unit-bracket")).not.toBeNull();
});

test("without a measurement it shows the declared value and never says measured", () => {
  const { container } = render(<SparkUnit model="Acme 4bpw" sparks={1} measuredBytes={null} declaredBytes={50 * GIB} />);
  expect(screen.getByText("Declared")).toBeVisible();
  expect(container.textContent).not.toContain("easured");
  expect(container.querySelector(".spark-unit-bracket")).toBeNull();
});

test("a recipe that declares no memory says so", () => {
  render(<SparkUnit model="Acme" sparks={1} measuredBytes={null} declaredBytes={null} />);
  expect(screen.getByText("Memory not declared")).toBeVisible();
});
