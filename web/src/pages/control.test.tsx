import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import fixture from "./connection-examples.fixture.json";
import { ControlPage } from "./control";

// connection-examples.fixture.json holds what the Controller's own connection examples
// (vonk-forge control/web/src/components/ui/connection-examples.tsx, connectionSnippets)
// produce for its first case. Refresh it when that function changes; this test then fails
// until the page text matches again.
test("Connect your tools shows the Controller's curl and Python examples exactly, with copy buttons and no try-it control", () => {
  render(<ControlPage />);
  const [example] = fixture.cases;
  const section = screen.getByRole("region", { name: "Connect your tools" });
  const codes = [...section.querySelectorAll(".command-block code")].map(
    (code) => code.textContent,
  );

  expect(codes).toEqual([example?.setup, example?.curl, example?.python]);
  expect(section.querySelectorAll("button")).toHaveLength(3);
  expect(
    [...section.querySelectorAll("button")].every((button) => button.textContent === "Copy"),
  ).toBe(true);
  expect(section.textContent).not.toMatch(/try (it|request)/i);
});

test("the Control page explains jobs with the runbook's job run and job contract commands", () => {
  render(<ControlPage />);
  const section = screen.getByRole("region", { name: "Make images, video, audio and 3D" });
  const codes = [...section.querySelectorAll(".command-block code")].map(
    (code) => code.textContent,
  );
  expect(codes).toEqual([
    "vonkctl job run ALIAS --input prompt=prompt.txt --option steps=4 --output results",
    "vonkctl job contract --run RUN_UUID",
  ]);
});

test("Connect your tools says where an alias comes from", () => {
  render(<ControlPage />);
  const section = screen.getByRole("region", { name: "Connect your tools" });
  expect(section.textContent).toContain(
    "An alias comes from vonkctl --profile 2 run RECIPE --as qwen-code; vonkctl profile endpoint lists them.",
  );
});

test("the site says load, not apply, for a profile", () => {
  render(<ControlPage />);
  expect(document.body.textContent).toContain("then load it.");
  expect(document.body.textContent).not.toMatch(/then apply|applies the plan|nothing is applied/);
  expect(document.body.textContent).toContain("vonkctl update --apply");
});
