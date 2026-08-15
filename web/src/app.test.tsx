import { render, screen, within } from "@testing-library/react";
import { afterEach } from "vitest";

import { App } from "./app";


afterEach(() => window.history.replaceState({}, "", "/"));


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

  const primaryNavigation = screen.getByRole("navigation", {
    name: "Primary navigation",
  });

  expect(within(primaryNavigation).getByRole("link", { name: "Recipes" })).toHaveAttribute(
    "href",
    "/recipes",
  );
  expect(within(primaryNavigation).getByRole("link", { name: "Publish" })).toHaveAttribute(
    "href",
    "/publish",
  );
  expect(within(primaryNavigation).getByRole("link", { name: "Architecture" })).toHaveAttribute(
    "href",
    "/architecture",
  );
  expect(within(primaryNavigation).getByRole("link", { name: "Install" })).toHaveAttribute(
    "href",
    "/install",
  );
});


test("explains the operator-owned architecture for one to many Sparks", () => {
  window.history.replaceState({}, "", "/architecture");
  render(<App />);

  expect(
    screen.getByRole("heading", { name: /one control plane.*one to many sparks/i }),
  ).toBeVisible();
  for (const name of ["Public catalog", "Operator workstation", "NAS control", "Spark fleet"]) {
    expect(screen.getByRole("heading", { name })).toBeVisible();
  }
  expect(screen.getByText(/tailscale https/i)).toBeVisible();
  expect(screen.getByText(/management-lan tls \/ mtls/i)).toBeVisible();
  expect(screen.getByText("NVIDIA fabric", { selector: "strong" })).toBeVisible();
  expect(screen.getByText("SSH project publisher")).toBeVisible();

});


test("explains the control to runtime contract without MIA-specific control logic", () => {
  window.history.replaceState({}, "", "/architecture");
  render(<App />);

  expect(screen.getByRole("heading", { name: "One contract. Any reviewed runtime." })).toBeVisible();
  for (const name of ["Recipe", "NAS control", "Spark enforcement", "Runtime adapter"]) {
    expect(screen.getByRole("heading", { name })).toBeVisible();
  }
  expect(screen.getByText("VONK_RANK", { selector: "code" })).toBeVisible();
  expect(screen.getByText("/run/vonk/runtime.json", { selector: "code" })).toBeVisible();
  expect(screen.getByText(/MIA changes how reasoning tokens are handled/i)).toBeVisible();
  expect(screen.getByText(/No control-plane change/i)).toBeVisible();
});


test("provides bounded development and production installation paths", () => {
  window.history.replaceState({}, "", "/install");
  render(<App />);

  expect(screen.getByRole("heading", { name: "Install Vonk Forge" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Development" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Production" })).toBeVisible();
  expect(screen.getByText("docker-compose.yml + secrets/", { selector: "strong" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "One Spark" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Many Sparks" })).toBeVisible();
  expect(screen.getByText(/funnel stays disabled/i)).toBeVisible();
  expect(screen.getByText(/complete 22-file source generation/i)).toBeVisible();
  expect(screen.getByText(/validated 18-file projection/i)).toBeVisible();
  expect(screen.getByText(/publish through batch-mode ssh/i)).toBeVisible();
  expect(screen.getByText(/smb is only an operator view/i)).toBeVisible();
  expect(screen.getByRole("link", { name: /complete development runbook/i })).toHaveAttribute(
    "href",
    expect.stringContaining("development-nas-installation.md"),
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
