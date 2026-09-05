import { render, screen } from "@testing-library/react";

import { PublishingGuidePage } from "./publishing-guide";


test("points recipe authors to the repository workflow", () => {
  render(<PublishingGuidePage />);

  expect(screen.getByRole("heading", { name: "Publish a recipe others can trust." })).toBeVisible();
  expect(screen.getByText(/authored and reviewed in the version-controlled/i)).toBeVisible();
  expect(screen.getByRole("link", { name: "Open the recipe library" })).toHaveAttribute(
    "href",
    "https://github.com/CarstVaartjes/vonk-forge-recipes",
  );
  expect(screen.getByRole("link", { name: "Read the recipe authoring guide" })).toHaveAttribute(
    "href",
    "https://github.com/CarstVaartjes/vonk-forge-recipes/blob/main/docs/recipe-authoring.md",
  );
  for (const name of ["Describe the model and run", "Check the recipe", "Open a pull request"]) {
    expect(screen.getByRole("heading", { name })).toBeVisible();
  }
  expect(screen.getByRole("heading", { name: "Keep authoring in the repository." })).toBeVisible();
});
