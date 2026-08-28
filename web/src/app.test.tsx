import { render, screen, within } from "@testing-library/react";
import { afterEach } from "vitest";

import { App } from "./app";


afterEach(() => window.history.replaceState({}, "", "/"));


test("defines the product and puts installation first", () => {
  render(<App />);

  expect(
    screen.getByRole("heading", { name: /local ai\.\s*one private control plane/i }),
  ).toBeVisible();
  expect(
    screen.getByText(/turns a laptop, NAS, or local server into the command center/i),
  ).toBeVisible();
  expect(screen.getByRole("link", { name: "Install your controller" })).toHaveAttribute("href", "/install");
  expect(screen.getByText("curl -fsSL https://install.vonkforge.ai/nas | sh")).toBeVisible();
  expect(screen.getByText("The real Web Controller")).toBeVisible();
  expect(screen.getByAltText(/Vonk Forge Library showing model recipes/i)).toBeVisible();
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
  expect(within(primaryNavigation).getByRole("link", { name: "How it works" })).toHaveAttribute(
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
  for (const name of ["Public catalog", "Operator workstation", "Local controller", "Spark fleet"]) {
    expect(screen.getByRole("heading", { name })).toBeVisible();
  }
  expect(screen.getByText(/tailscale https/i)).toBeVisible();
  expect(screen.getByText(/management-lan tls \/ mtls/i)).toBeVisible();
  expect(screen.getByText("NVIDIA fabric", { selector: "strong" })).toBeVisible();
  expect(screen.getByText("Local project files")).toBeVisible();

});


test("explains the control to runtime contract without MIA-specific control logic", () => {
  window.history.replaceState({}, "", "/architecture");
  render(<App />);

  expect(screen.getByRole("heading", { name: "One contract. Any reviewed runtime." })).toBeVisible();
  for (const name of ["Recipe", "Local controller", "Spark enforcement", "Runtime adapter"]) {
    expect(screen.getByRole("heading", { name })).toBeVisible();
  }
  expect(screen.getByText("VONK_RANK", { selector: "code" })).toBeVisible();
  expect(screen.getByText("/run/vonk/runtime.json", { selector: "code" })).toBeVisible();
  expect(screen.getByText(/MIA changes how reasoning tokens are handled/i)).toBeVisible();
  expect(screen.getByText(/No control-plane change/i)).toBeVisible();
});


test("provides the current signed controller and Spark installation path", () => {
  window.history.replaceState({}, "", "/install");
  render(<App />);

  expect(screen.getByRole("heading", { name: "Install Vonk Forge" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Prepare the controller" })).toBeVisible();
  expect(screen.getByText(/this laptop for a lab/i)).toBeVisible();
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


test("maps the public catalog to operator-owned control and execution", () => {
  render(<App />);

  expect(
    screen.getByRole("heading", { name: /private by architecture, not by promise/i }),
  ).toBeVisible();
  expect(screen.getByRole("heading", { name: "Catalog + signed releases" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Vonk Forge controller" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "DGX Spark fleet" })).toBeVisible();
  expect(screen.getByText("Runtime secrets")).toBeVisible();
  expect(screen.getByRole("link", { name: "Tour the Web Controller" })).toBeVisible();
  expect(screen.getByRole("link", { name: "See the CLI" })).toBeVisible();
});


test("shows the safe operating loop without hiding the private boundary", () => {
  render(<App />);

  for (const name of ["Install the controller", "Connect your Sparks", "Choose a recipe", "Preview, then run"]) {
    expect(screen.getByRole("heading", { name })).toBeVisible();
  }
  expect(screen.getByRole("heading", { name: /your controller, your choice/i })).toBeVisible();
  expect(screen.getByText(/A NAS is convenient, not compulsory/i)).toBeVisible();
});
