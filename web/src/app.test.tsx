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
  expect(within(primaryNavigation).getByRole("link", { name: "Control" })).toHaveAttribute(
    "href",
    "/control",
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


test("provides the current signed NAS and Spark installation path", () => {
  window.history.replaceState({}, "", "/install");
  render(<App />);

  expect(screen.getByRole("heading", { name: "Install Vonk Forge" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Prepare the NAS" })).toBeVisible();
  expect(screen.getByText("curl -fsSL https://install.vonkforge.ai/nas | sh")).toBeVisible();
  expect(screen.getByRole("heading", { name: "Choose a control path" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Web Controller" })).toBeVisible();
  expect(screen.getByRole("heading", { name: /vonkctl CLI/i })).toBeVisible();
  expect(screen.getByRole("heading", { name: "One Spark" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Many Sparks" })).toBeVisible();
  expect(screen.getByText(/VONK_CONTROLLER_ADDRESS=192\.168\.1\.231/)).toBeVisible();
  expect(document.querySelector(".control-install .fleet-note")).toHaveTextContent(
    /public vonkforge\.ai site is documentation and catalog/i,
  );
  expect(screen.getByRole("link", { name: /complete CLI reference/i })).toHaveAttribute(
    "href",
    expect.stringContaining("vonkctl.md"),
  );
});


test("documents two equivalent control paths and complete CLI setup", () => {
  window.history.replaceState({}, "", "/control");
  render(<App />);

  expect(screen.getByRole("heading", { name: "Choose browser or terminal." })).toBeVisible();
  expect(screen.getAllByRole("heading", { name: "Web Controller" })).toHaveLength(2);
  expect(screen.getAllByRole("heading", { name: "Local CLI" })).toHaveLength(2);
  expect(screen.getByText(/uv tool install 'git\+https:\/\/github\.com\/CarstVaartjes\/vonk-forge\.git@main'/)).toBeVisible();
  expect(screen.getByText(/VONK_CONTROL_TOKEN_FILE/)).toBeVisible();
  expect(screen.getByText(/browser password is not a CLI credential/i)).toBeVisible();
  expect(screen.getByText(/vonkctl library public facets/)).toBeVisible();
  expect(screen.getByText(/uv tool upgrade vonk-cluster-profiles/)).toBeVisible();
});


test("discloses aggregate cookie-free visitor analytics", () => {
  window.history.replaceState({}, "", "/privacy");
  render(<App />);

  expect(screen.getByRole("heading", { name: "Useful numbers. No visitor profiles." })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Available statistics" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "No analytics cookies" })).toBeVisible();
  expect(screen.getByText(/Cloudflare Web Analytics does not use cookies or local storage/i)).toBeVisible();
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
  expect(screen.getByRole("heading", { name: "Web Controller" })).toBeVisible();
  expect(screen.getByRole("heading", { name: /vonkctl CLI/i })).toBeVisible();
});


test("distinguishes development convenience from production authority", () => {
  render(<App />);

  expect(screen.getByRole("heading", { name: "Development" })).toBeVisible();
  expect(screen.getByText(":dev")).toBeVisible();
  expect(screen.getByRole("heading", { name: "Production" })).toBeVisible();
  expect(screen.getByText(/trusted updater/i)).toBeVisible();
});
