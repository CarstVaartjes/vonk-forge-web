import { render, screen } from "@testing-library/react";

import { App } from "./app";


test("explains the public catalog boundary", () => {
  render(<App />);

  expect(
    screen.getByRole("heading", { name: /many sparks\. one forge/i }),
  ).toBeVisible();
  expect(
    screen.getByText(/images and weights stay in their registries/i),
  ).toBeVisible();
});


test("provides the catalog and publishing navigation", () => {
  render(<App />);

  expect(screen.getByRole("link", { name: "Recipes" })).toHaveAttribute(
    "href",
    "/recipes",
  );
  expect(screen.getByRole("link", { name: "Publish" })).toHaveAttribute(
    "href",
    "/publish",
  );
});
