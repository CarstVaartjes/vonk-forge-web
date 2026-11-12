import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

import { App } from "./app";
import indexHtml from "../index.html?raw";


// The footer reads the verified release manifest the Pages build writes.
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.endsWith("/catalog/release.json")) return { ok: true, json: async () => ({ repository: "CarstVaartjes/vonk-forge-recipes", tag: "v2.0.0", contract_version: "2.0.0", updated_at: "2026-09-28T20:04:06Z", source_commit: "f".repeat(40) }) };
    return { ok: false, status: 404 };
  }));
});

afterEach(() => {
  window.history.replaceState({}, "", "/");
  vi.unstubAllGlobals();
});


test("shows the recipe library version and when it was last updated", async () => {
  render(<App />);
  const footer = screen.getByRole("contentinfo");
  expect(await within(footer).findByRole("link", { name: "v2.0.0" })).toHaveAttribute("href", "https://github.com/CarstVaartjes/vonk-forge-recipes/releases/tag/v2.0.0");
  expect(within(footer).getByText(/Updated Sep 28, 2026/)).toBeVisible();
});


test("defines the product and puts installation first", () => {
  render(<App />);

  expect(
    screen.getByRole("heading", { name: /recipes verified on DGX Spark/i }),
  ).toBeVisible();
  expect(screen.getByText(/Vonk Forge is the open-source Controller for NVIDIA DGX Spark/)).toBeVisible();
  expect(screen.getByRole("link", { name: "See the agent-friendly CLI" })).toHaveAttribute("href", "/control#local-cli");
  expect(screen.getAllByRole("link", { name: "Install" })[0]).toHaveAttribute("href", "/install");
  expect(screen.getByRole("link", { name: "Browse what runs" })).toHaveAttribute("href", "/recipes");
  expect(screen.getByText("curl -fsSL https://install.vonkforge.ai/nas | sh")).toBeVisible();
  expect(screen.getByText(/install\.vonkforge\.ai\/spark \| VONK_CONTROLLER_ADDRESS=/)).toBeVisible();
  expect(screen.getByText("The real Web Controller")).toBeVisible();
  expect(screen.getByAltText(/Vonk Forge Library showing model and recipe lists/i)).toBeVisible();
});


test("states the four promises with the vonkctl command behind each", () => {
  render(<App />);

  const promises = screen.getByRole("heading", { name: "What Vonk Forge does for you." }).closest("section");
  expect(promises).not.toBeNull();
  const section = within(promises as HTMLElement);
  const expected: Array<[string, string]> = [
    ["Know what fits your setup.", "vonkctl recipe library --fits-fleet"],
    ["Stay current without the chase.", "vonkctl recipe update --all"],
    ["Run the mix you need.", "vonkctl --profile 2 profile load"],
    ["Click it, or script it.", 'vonkctl run "Qwen Code" --yes --json'],
  ];
  for (const [title, command] of expected) {
    expect(section.getByRole("heading", { name: title })).toBeVisible();
    expect(section.getByText(command)).toBeVisible();
  }
  expect(section.getByText(/syncs the signed library on its own/i)).toBeVisible();
  expect(document.body.textContent).not.toMatch(/15 minutes/);
  expect(screen.getByText("vonkctl --profile 2 profile load --yes --json")).toBeVisible();
});


test("top menu is Catalog, Install, Docs; Publish and Example setup live in the footer", () => {
  render(<App />);

  const primaryNavigation = within(screen.getByRole("navigation", { name: "Primary navigation" }));
  expect(primaryNavigation.getAllByRole("link").map((link) => link.textContent)).toEqual(["Catalog", "Install", "Docs"]);
  expect(primaryNavigation.getByRole("link", { name: "Catalog" })).toHaveAttribute("href", "/recipes");
  expect(primaryNavigation.getByRole("link", { name: "Install" })).toHaveAttribute("href", "/install");
  expect(primaryNavigation.getByRole("link", { name: "Docs" })).toHaveAttribute("href", "/architecture");

  const footer = within(screen.getByRole("navigation", { name: "Footer navigation" }));
  expect(footer.getByRole("link", { name: "Publish" })).toHaveAttribute("href", "/publish");
  expect(footer.getByRole("link", { name: "Example setup" })).toHaveAttribute("href", "/example-setup");
});


test("marks the current top-level destination, grouping the pages under it", () => {
  const current = (path: string) => {
    window.history.replaceState({}, "", path);
    const view = render(<App />);
    const links = within(screen.getByRole("navigation", { name: "Primary navigation" })).getAllByRole("link");
    const marked = links.filter((link) => link.getAttribute("aria-current") === "page").map((link) => link.textContent);
    view.unmount();
    return marked;
  };

  expect(current("/recipes/vonk/qwen-fast")).toEqual(["Catalog"]);
  expect(current("/models")).toEqual(["Catalog"]);
  expect(current("/install")).toEqual(["Install"]);
  expect(current("/control")).toEqual(["Docs"]);
  expect(current("/publish")).toEqual([]);
});


test("routes publishing to the repository guide without a browser authoring workspace", () => {
  window.history.replaceState({}, "", "/publish");
  render(<App />);

  expect(screen.getByRole("heading", { name: "Publish a recipe others can trust." })).toBeVisible();
  expect(screen.getByRole("link", { name: "Read the recipe authoring guide" })).toHaveAttribute(
    "href",
    "https://github.com/CarstVaartjes/vonk-forge-recipes/blob/main/docs/recipe-authoring.md",
  );
  expect(screen.queryByLabelText("Upload local JSON")).not.toBeInTheDocument();
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
  expect(screen.getByText(/Prepares and caches verified model files and runtime images on your NAS/i)).toBeVisible();
  expect(screen.getByText(/Prepared assets are distributed as needed/i)).toBeVisible();

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
  const preflightHeading = screen.getByRole("heading", { name: "Complete private HTTPS setup first." });
  const controllerCommand = screen.getByText("curl -fsSL https://install.vonkforge.ai/nas | sh");
  expect(preflightHeading.compareDocumentPosition(controllerCommand) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByText(/MagicDNS and HTTPS certificates/i)).toBeVisible();
  expect(screen.getByText(/OAuth client with only/)).toHaveTextContent(/auth_keys.*tag:vonk-gateway/i);
  expect(screen.getByText(/Production and development use these same unsuffixed names/i)).toBeVisible();
  expect(screen.getByText(/isolated, disposable test tailnet/i)).toBeVisible();
  expect(screen.getByRole("heading", { name: "Choose a control path" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Web Controller" })).toBeVisible();
  expect(screen.getByRole("heading", { name: /vonkctl CLI/i })).toBeVisible();
  expect(screen.getByRole("heading", { name: "One Spark" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Many Sparks" })).toBeVisible();
  expect(screen.getByText(/VONK_CONTROLLER_ADDRESS=192\.168\.1\.231/)).toBeVisible();
  expect(screen.getByRole("heading", { name: "Prove the private route before enrolling Sparks." })).toBeVisible();
  expect(screen.getByText(/docker compose exec tailscale-gateway tailscale status --json/)).toBeVisible();
  expect(screen.getByText(/tailscale ping vonk-forge\.<TAILNET_DNS_SUFFIX>\.ts\.net/)).toBeVisible();
  expect(screen.getByLabelText("Exact Tailscale Serve map")).toHaveTextContent(
    /svc:vonk-forge.*http:\/\/caddy:8080/i,
  );
  expect(screen.getByText("No matching peer")).toBeVisible();
  expect(document.querySelector(".control-install .fleet-note")).toHaveTextContent(
    /public vonkforge\.ai site is documentation and catalog/i,
  );
  expect(screen.getByRole("link", { name: /complete CLI reference/i })).toHaveAttribute(
    "href",
    expect.stringContaining("vonkctl.md"),
  );
  expect(screen.getByRole("link", { name: /canonical Tailscale runbook/i })).toHaveAttribute(
    "href",
    "https://github.com/CarstVaartjes/vonk-forge/blob/main/docs/runbooks/tailscale.md",
  );
});


test("documents two equivalent control paths and complete CLI setup", () => {
  window.history.replaceState({}, "", "/control");
  render(<App />);

  expect(screen.getByRole("heading", { name: "Click it, or script it." })).toBeVisible();
  expect(screen.getAllByRole("heading", { name: "Web Controller" })).toHaveLength(2);
  expect(screen.getAllByRole("heading", { name: "Local CLI" })).toHaveLength(2);
  expect(screen.getByText(/curl -fsSL https:\/\/install\.vonkforge\.ai\/vonkctl \| sh/)).toBeVisible();
  expect(screen.queryByText(/uv tool install 'git\+https/)).not.toBeInTheDocument();
  expect(screen.getByText(/VONK_CONTROL_TOKEN_FILE/)).toBeVisible();
  expect(screen.getByText(/vonkctl --check-connection --json/)).toBeVisible();
  expect(screen.getByText(/browser password is not a CLI credential/i)).toBeVisible();
  expect(screen.getByText(/vonkctl recipe library --fits-fleet --json/)).toBeVisible();
  expect(screen.getByText(/vonkctl --profile 2 profile load --review --json/)).toBeVisible();
  expect(screen.getByText(/recipe repository syncs automatically/i)).toBeVisible();
  expect(screen.queryByText(/vonkctl models (list|discover)/)).not.toBeInTheDocument();
  expect(screen.getByText(/vonkctl update --apply/)).toBeVisible();
  expect(screen.getByText(/uv tool uninstall vonk-cluster-profiles/)).toBeVisible();
  expect(screen.getByRole("heading", { name: "Written for agents" })).toBeVisible();
  expect(screen.getByText(/closed pipe/)).toBeVisible();
});


test("offers lab and secure remote install modes with current enrollment commands", () => {
  window.history.replaceState({}, "", "/install");
  render(<App />);

  expect(screen.getByRole("heading", { name: "Lab on your LAN, or secure remote." })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Lab mode" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Secure remote" })).toBeVisible();
  expect(screen.getByText(/Lab mode skips this section/)).toBeVisible();
  expect(screen.getByRole("link", { name: /Lab quickstart/ })).toHaveAttribute("href", "https://github.com/CarstVaartjes/vonk-forge/blob/main/docs/QUICKSTART.md");
  expect(screen.getByText(/vonkctl fleet enroll Atlas --output atlas-grant\.json/)).toBeVisible();
  expect(screen.queryByText(/fleet enroll --apply/)).not.toBeInTheDocument();
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
  expect(screen.getByRole("heading", { name: "Catalog + verified releases" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Vonk Forge controller" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "DGX Spark fleet" })).toBeVisible();
  expect(screen.getByText("Runtime secrets")).toBeVisible();
  expect(screen.getByRole("link", { name: "Tour the Web Controller" })).toBeVisible();
  expect(screen.getByRole("link", { name: "See the CLI" })).toBeVisible();
});


test("shows the safe operating loop without hiding the private boundary", () => {
  render(<App />);

  for (const name of ["Install the controller", "Connect your Sparks", "Choose a model or recipe", "Prepare, run, switch"]) {
    expect(screen.getByRole("heading", { name })).toBeVisible();
  }
  expect(screen.getByRole("heading", { name: /your controller, your choice/i })).toBeVisible();
  expect(screen.getByText(/A NAS is convenient, not compulsory/i)).toBeVisible();
});


test("each route sets its own tab title and description", () => {
  const meta = (path: string) => {
    window.history.replaceState({}, "", path);
    const view = render(<App />);
    const seen = [document.title, document.querySelector('meta[name="description"]')?.getAttribute("content")];
    view.unmount();
    return seen;
  };
  const pages = ["/recipes", "/install", "/control", "/architecture", "/publish", "/example-setup"].map(meta);

  expect(pages.map(([title]) => title)).toEqual(
    ["Recipes", "Install", "Control", "How it works", "Publish a recipe", "Example setup"].map((name) => `${name} · Vonk Forge`),
  );
  expect(new Set(pages.map(([, description]) => description)).size).toBe(pages.length);
});


test("shared links get a large card with the share image", () => {
  const html = indexHtml;
  expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
  expect(html).toContain('content="https://vonkforge.ai/og.png"');
  expect(html).toContain('<link rel="icon" href="/favicon.svg"');
});
