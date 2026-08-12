import { render, screen } from "@testing-library/react";

import { App } from "./app";


test("explains the public catalog boundary", () => {
  render(<App />);

  expect(
    screen.getByRole("heading", { name: /many sparks\. one forge/i }),
  ).toBeVisible();
  expect(
    screen.getByText(/verified build source here.*weights at their origin/i),
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


test("maps the catalog to operator-owned Spark execution", () => {
  render(<App />);

  expect(
    screen.getByRole("heading", { name: /build where the models live/i }),
  ).toBeVisible();
  expect(screen.getByRole("heading", { name: "Catalog" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "NAS control" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Spark runtime" })).toBeVisible();
  expect(screen.getByText(/nvidia \+ docker/i)).toBeVisible();
  expect(screen.getByText(/secrets stay local/i)).toBeVisible();
});


test("distinguishes development convenience from production authority", () => {
  render(<App />);

  expect(screen.getByRole("heading", { name: "Development" })).toBeVisible();
  expect(screen.getByText(":dev")).toBeVisible();
  expect(screen.getByRole("heading", { name: "Production" })).toBeVisible();
  expect(screen.getByText(/trusted updater/i)).toBeVisible();
});
