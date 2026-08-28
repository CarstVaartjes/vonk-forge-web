import { render, screen } from "@testing-library/react";

import { PublishingGuidePage } from "./publishing-guide";


test("provides a complete public publishing path without a hosted API", () => {
  render(<PublishingGuidePage />);

  expect(screen.getByRole("heading", { name: "Publish a recipe others can trust." })).toBeVisible();
  expect(screen.getByText(/hosted publisher workspace is not active yet/i)).toBeVisible();
  expect(screen.getByRole("link", { name: "Open the recipe library" })).toHaveAttribute(
    "href",
    "https://github.com/CarstVaartjes/vonk-forge-recipes",
  );
  for (const name of ["Describe the exact workload", "Validate the complete closure", "Publish through review"]) {
    expect(screen.getByRole("heading", { name })).toBeVisible();
  }
});
