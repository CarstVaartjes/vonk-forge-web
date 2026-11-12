import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import fixture from "./connection-examples.fixture.json";
import { ControlPage } from "./control";

// connection-examples.fixture.json is a verbatim copy of
// tests/fixtures/connection-examples.json in vonk-forge, the examples the
// Controller shows. Refresh the copy when that file changes; this test then
// fails until the page text matches again.
test("Connect your tools shows the Controller's curl and Python examples exactly, with copy buttons and no try-it control", () => {
  render(<ControlPage />);
  const [example] = fixture.cases;
  const section = screen.getByRole("region", { name: "Connect your tools" });
  const codes = [...section.querySelectorAll(".command-block code")].map((code) => code.textContent);

  expect(codes).toEqual([example?.setup, example?.curl, example?.python]);
  expect(section.querySelectorAll("button")).toHaveLength(3);
  expect([...section.querySelectorAll("button")].every((button) => button.textContent === "Copy")).toBe(true);
  expect(section.textContent).not.toMatch(/try (it|request)/i);
});
