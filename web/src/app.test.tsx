import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

import { App, preparePage } from "./app";
import indexHtml from "../index.html?raw";
import { InstallPage } from "./pages/install";

const siteHeader = () => document.querySelector<HTMLElement>("header.site-header")!;

// The footer reads the verified release manifest the Pages build writes.
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.endsWith("/catalog/release.json"))
        return {
          ok: true,
          json: async () => ({
            repository: "CarstVaartjes/vonk-forge-recipes",
            tag: "v2.0.0",
            contract_version: "2.0.0",
            updated_at: "2026-09-28T20:04:06Z",
            source_commit: "f".repeat(40),
            catalog_index_sha256: "b".repeat(64),
          }),
        };
      return { ok: false, status: 404 };
    }),
  );
});

// Open a page the way the browser does: its code is loaded before it is shown.
async function go(path: string): Promise<void> {
  window.history.replaceState({}, "", path);
  await preparePage(path);
}

// The page is lazy: wait for React to show it.
const shown = () =>
  waitFor(() => expect(document.querySelector("#main-content main")).not.toBeNull());

afterEach(() => {
  window.history.replaceState({}, "", "/");
  vi.unstubAllGlobals();
});

test("shows the recipe library version and when it was last updated", async () => {
  render(<App />);
  const footer = screen.getByRole("contentinfo");
  expect(await within(footer).findByRole("link", { name: "v2.0.0" })).toHaveAttribute(
    "href",
    "https://github.com/CarstVaartjes/vonk-forge-recipes/releases/tag/v2.0.0",
  );
  expect(within(footer).getByText(/Updated 28 Sep 2026/)).toBeVisible();
  expect(within(footer).getByText("bbbbbbbbbbbb")).toBeVisible();
  expect(
    within(siteHeader()).getByRole("link", { name: /Catalog v2\.0\.0 · updated 28 Sep 2026/ }),
  ).toBeVisible();
});

test("the theme switch is a labelled button that flips and remembers the theme", async () => {
  render(<App />);
  const toggle = screen.getByRole("button", { name: "Switch to light theme" });
  toggle.click();
  expect(await screen.findByRole("button", { name: "Switch to dark theme" })).toBeVisible();
  expect(document.documentElement).toHaveAttribute("data-theme", "light");
  expect(localStorage.getItem("vonk-theme")).toBe("light");
  localStorage.clear();
});

test("the release pill and footer line are not drawn when the release cannot be read", async () => {
  const unreadable = vi.fn(async () => ({ ok: false, status: 404 }));
  vi.stubGlobal("fetch", unreadable);
  render(<App />);
  await waitFor(() => expect(unreadable).toHaveBeenCalled());
  expect(screen.queryByText(/Recipe library/)).toBeNull();
  expect(within(siteHeader()).queryByText(/updated/)).toBeNull();
});

test("defines the product and puts installation first", () => {
  render(<App />);

  expect(
    screen.getByRole("heading", { level: 1, name: "Models that fit your Sparks, kept current." }),
  ).toBeVisible();
  expect(
    screen.getByText(/Vonk Forge is the open-source Controller for NVIDIA DGX Spark/),
  ).toBeVisible();
  expect(screen.getByRole("link", { name: "See the agent-friendly CLI" })).toHaveAttribute(
    "href",
    "/control#local-cli",
  );
  expect(screen.getAllByRole("link", { name: "Install" })[0]).toHaveAttribute("href", "/install");
  expect(screen.getByRole("link", { name: "Browse what runs" })).toHaveAttribute(
    "href",
    "/recipes",
  );
  expect(screen.getByText("curl -fsSL https://install.vonkforge.ai/nas | sh")).toBeVisible();
  expect(screen.getByText("Enroll Spark", { selector: "strong" })).toBeVisible();
  expect(screen.getAllByAltText(/Controller Overview on an example fleet/i)[0]).toBeVisible();
});

test("tells one story: what it does, with the vonkctl session behind it", () => {
  render(<App />);

  for (const title of ["Know what fits.", "Stay current.", "Run the mix you need."]) {
    expect(screen.getByRole("heading", { name: title })).toBeVisible();
  }
  const session = document.querySelector(".agent-session code")!;
  expect(session.textContent).toContain("vonkctl fleet\n");
  expect(session.textContent).toContain("vonkctl recipe library --fits-fleet --limit 5\n");
  expect(session.textContent).toContain('vonkctl --profile 2 run "Qwen Code"\n');
  expect(session.textContent).toContain("vonkctl profile endpoint\n");
  expect(session.textContent).not.toContain("profile load");
  expect(screen.queryByText("Newest verified recipes")).not.toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Which recipes fit your Sparks" })).toBeVisible();
  expect(document.body.textContent).not.toMatch(/15 minutes/);
  expect(document.querySelectorAll("main section").length).toBeLessThanOrEqual(7);
});

test("top menu is Recipes, Models, Controller, How it works beside Install; Publish and Example setup live in the footer", () => {
  render(<App />);

  const primaryNavigation = within(screen.getByRole("navigation", { name: "Primary navigation" }));
  expect(primaryNavigation.getAllByRole("link").map((link) => link.textContent)).toEqual([
    "Recipes",
    "Models",
    "Controller",
    "How it works",
  ]);
  expect(primaryNavigation.getByRole("link", { name: "Recipes" })).toHaveAttribute(
    "href",
    "/recipes",
  );
  expect(within(siteHeader()).getByRole("link", { name: "Install" })).toHaveAttribute(
    "href",
    "/install",
  );
  expect(primaryNavigation.getByRole("link", { name: "How it works" })).toHaveAttribute(
    "href",
    "/architecture",
  );

  const footer = within(screen.getByRole("navigation", { name: "Footer navigation" }));
  for (const label of ["Recipes", "Models", "Controller", "How it works"]) {
    expect(footer.getByRole("link", { name: label })).toBeInTheDocument();
  }
  expect(footer.getByRole("link", { name: "Publish" })).toHaveAttribute("href", "/publish");
  expect(footer.getByRole("link", { name: "Example setup" })).toHaveAttribute(
    "href",
    "/example-setup",
  );
});

test("marks the current top-level destination, grouping the pages under it", async () => {
  const current = async (path: string) => {
    await go(path);
    const view = render(<App />);
    await shown();
    const links = within(siteHeader()).getAllByRole("link");
    const marked = links
      .filter((link) => link.getAttribute("aria-current") === "page")
      .map((link) => link.textContent);
    view.unmount();
    return marked;
  };

  expect(await current("/recipes/vonk/qwen-fast")).toEqual(["Recipes"]);
  expect(await current("/models")).toEqual(["Models"]);
  expect(await current("/install")).toEqual(["Install"]);
  expect(await current("/control")).toEqual(["Controller"]);
  expect(await current("/publish")).toEqual([]);
});

test("routes publishing to the repository guide without a browser authoring workspace", async () => {
  await go("/publish");
  render(<App />);
  await shown();

  expect(screen.getByRole("heading", { name: "Publish a recipe others can trust." })).toBeVisible();
  expect(screen.getByRole("link", { name: "Read the recipe authoring guide" })).toHaveAttribute(
    "href",
    "https://github.com/CarstVaartjes/vonk-forge-recipes/blob/main/docs/recipe-authoring.md",
  );
  expect(screen.queryByLabelText("Upload local JSON")).not.toBeInTheDocument();
});

test("explains the operator-owned architecture for one to many Sparks", async () => {
  await go("/architecture");
  render(<App />);
  await shown();

  expect(
    screen.getByRole("heading", { name: /one control plane.*one to many sparks/i }),
  ).toBeVisible();
  for (const name of [
    "Public catalog",
    "Operator workstation",
    "Local controller",
    "Spark fleet",
  ]) {
    expect(screen.getByRole("heading", { name })).toBeVisible();
  }
  expect(screen.getByText(/tailscale https/i)).toBeVisible();
  expect(screen.getByText(/management-lan tls \/ mtls/i)).toBeVisible();
  expect(screen.getByText("NVIDIA fabric", { selector: "strong" })).toBeVisible();
  expect(screen.getByText("Local project files")).toBeVisible();
  expect(
    screen.getByText(
      /Prepares and caches verified model files and runtime images on your Controller/i,
    ),
  ).toBeVisible();
  expect(screen.getByText(/Prepared assets are distributed as needed/i)).toBeVisible();
});

test("explains the control to runtime contract without wrapper-specific control logic", async () => {
  await go("/architecture");
  render(<App />);
  await shown();

  expect(
    screen.getByRole("heading", { name: "One contract. Any reviewed runtime." }),
  ).toBeVisible();
  for (const name of ["Recipe", "Local controller", "Spark enforcement", "Runtime adapter"]) {
    expect(screen.getByRole("heading", { name })).toBeVisible();
  }
  expect(screen.getByText("VONK_RANK", { selector: "code" })).toBeVisible();
  expect(screen.getByText("/run/vonk/runtime.json", { selector: "code" })).toBeVisible();
  expect(
    screen.getByText(/The creator's wrapper changes how reasoning tokens are handled/i),
  ).toBeVisible();
  expect(screen.getByText(/No control-plane change/i)).toBeVisible();
});

test("provides the current signed controller and Spark installation path", async () => {
  await go("/install");
  render(<App />);
  await shown();

  expect(screen.getByRole("heading", { name: "Install Vonk Forge" })).toBeVisible();
  expect(
    screen.getByRole("heading", { name: "Lab mode: from this page to a signed-in Controller" }),
  ).toBeVisible();
  expect(screen.getByRole("heading", { name: "Run the Secure remote installer" })).toBeVisible();
  expect(screen.getByText(/this laptop for a lab/i)).toBeVisible();
  const preflightHeading = screen.getByRole("heading", {
    name: "Complete private HTTPS setup first.",
  });
  const [labCommand, secureCommand] = screen.getAllByText(
    "curl -fsSL https://install.vonkforge.ai/nas | sh",
  ) as [HTMLElement, HTMLElement];
  expect(
    labCommand.compareDocumentPosition(preflightHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    preflightHeading.compareDocumentPosition(secureCommand) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(screen.getByText(/MagicDNS and HTTPS certificates/i)).toBeVisible();
  expect(screen.getByText(/OAuth client with only/)).toHaveTextContent(
    /auth_keys.*tag:vonk-gateway/i,
  );
  expect(
    screen.getByText(/Production and development use these same unsuffixed names/i),
  ).toBeVisible();
  expect(screen.getByText(/isolated, disposable test tailnet/i)).toBeVisible();
  expect(screen.getByRole("heading", { name: "Choose a control path" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Web Controller" })).toBeVisible();
  expect(screen.getByRole("heading", { name: /vonkctl CLI/i })).toBeVisible();
  expect(screen.getByRole("heading", { name: "One Spark" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Many Sparks" })).toBeVisible();
  expect(screen.getByText(/this site cannot show a complete command/)).toBeVisible();
  expect(screen.queryByText(/VONK_CONTROLLER_ADDRESS/)).not.toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Prove the private route before enrolling Sparks." }),
  ).toBeVisible();
  expect(
    screen.getByText(/docker compose exec tailscale-gateway tailscale status --json/),
  ).toBeVisible();
  expect(
    screen.getByText(/tailscale ping vonk-forge\.<TAILNET_DNS_SUFFIX>\.ts\.net/),
  ).toBeVisible();
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

test("documents two equivalent control paths and complete CLI setup", async () => {
  await go("/control");
  render(<App />);
  await shown();

  expect(screen.getByRole("heading", { name: "Click it, or script it." })).toBeVisible();
  expect(screen.getAllByRole("heading", { name: "Web Controller" })).toHaveLength(2);
  expect(screen.getAllByRole("heading", { name: "Local CLI" })).toHaveLength(2);
  expect(
    screen.getByText(/curl -fsSL https:\/\/install\.vonkforge\.ai\/vonkctl \| sh/),
  ).toBeVisible();
  expect(screen.queryByText(/uv tool install 'git\+https/)).not.toBeInTheDocument();
  expect(screen.getByText(/vonkctl recipe library --fits-fleet --limit 5/)).toBeVisible();
  expect(screen.getByText(/vonkctl --profile 2 profile load --review --json/)).toBeVisible();
  expect(screen.getByText(/recipe repository syncs automatically/i)).toBeVisible();
  expect(screen.queryByText(/vonkctl models (list|discover)/)).not.toBeInTheDocument();
  expect(screen.getByText(/vonkctl update --apply/)).toBeVisible();
  expect(screen.getByText(/uv tool uninstall vonk-cluster-profiles/)).toBeVisible();
  expect(screen.getByRole("heading", { name: "Written for agents" })).toBeVisible();
  expect(screen.getByText(/closed pipe/)).toBeVisible();
});

test("the install page links the removal runbook", () => {
  render(<InstallPage />);

  const section = document.querySelector("#uninstall") as HTMLElement;
  expect(within(section).getByRole("link", { name: "removal runbook on GitHub" })).toHaveAttribute(
    "href",
    "https://github.com/CarstVaartjes/vonk-forge/blob/main/docs/operations/uninstall.md",
  );
});

test("offers lab and secure remote install modes with current enrollment commands", async () => {
  await go("/install");
  render(<App />);
  await shown();

  const labHeading = screen.getByRole("heading", {
    name: "Lab mode: from this page to a signed-in Controller",
  });
  const secureHeading = screen.getByRole("heading", { name: "Secure remote with Tailscale" });
  expect(
    labHeading.compareDocumentPosition(secureHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  const secureSection = document.getElementById("controller")!;
  for (const section of [document.getElementById("lab")!, secureSection]) {
    expect(
      within(section).getByText(/sudo docker compose up -d --wait --remove-orphans/),
    ).toBeVisible();
  }
  expect(
    screen.getAllByText(/vonk-forge\/secrets\/admin-password/, { selector: "code" }).length,
  ).toBeGreaterThan(0);
  expect(screen.getByText("https://vonk-forge.local:8443", { selector: "code" })).toBeVisible();
  expect(screen.queryByText(/Fleet page/)).not.toBeInTheDocument();
  expect(screen.getByText(/Lab mode skips this section/)).toBeVisible();
  expect(screen.getByRole("link", { name: /Lab quickstart/ })).toHaveAttribute(
    "href",
    "https://github.com/CarstVaartjes/vonk-forge/blob/main/docs/QUICKSTART.md",
  );
  expect(screen.getByText(/vonkctl fleet enroll Atlas --output atlas-grant\.json/)).toBeVisible();
  expect(screen.queryByText(/fleet enroll --apply/)).not.toBeInTheDocument();
});

test("discloses aggregate cookie-free visitor analytics", async () => {
  await go("/privacy");
  render(<App />);
  await shown();

  expect(
    screen.getByRole("heading", { name: "Useful numbers. No visitor profiles." }),
  ).toBeVisible();
  expect(screen.getByRole("heading", { name: "Available statistics" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "No analytics cookies" })).toBeVisible();
  expect(
    screen.getByText(/Cloudflare Web Analytics does not use cookies or local storage/i),
  ).toBeVisible();
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
  expect(screen.getByRole("link", { name: "See the agent-friendly CLI" })).toHaveAttribute(
    "href",
    "/control#local-cli",
  );
});

test("each route sets its own tab title and description", async () => {
  const meta = async (path: string) => {
    await go(path);
    const view = render(<App />);
    await shown();
    const seen = [
      document.title,
      document.querySelector('meta[name="description"]')?.getAttribute("content"),
      document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href,
    ];
    view.unmount();
    return seen;
  };
  const pages: Array<Array<string | null | undefined>> = [];
  for (const path of [
    "/recipes",
    "/install",
    "/control",
    "/architecture",
    "/publish",
    "/example-setup",
  ])
    pages.push(await meta(path));

  expect(pages.map(([title]) => title)).toEqual(
    ["Recipes", "Install", "Control", "How it works", "Publish a recipe", "Example setup"].map(
      (name) => `${name} · Vonk Forge`,
    ),
  );
  expect(new Set(pages.map(([, description]) => description)).size).toBe(pages.length);
  expect(pages.map(([, , canonical]) => canonical)).toEqual(
    ["/recipes", "/install", "/control", "/architecture", "/publish", "/example-setup"].map(
      (path) => `https://vonkforge.ai${path}`,
    ),
  );
});

test("shared links get a large card with the share image", () => {
  const html = indexHtml;
  expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
  expect(html).toContain('content="https://vonkforge.ai/og.png"');
  expect(html).toContain('<link rel="icon" href="/favicon.svg"');
});

test("Escape closes the open menu and returns focus to its button", () => {
  render(<App />);
  const button = screen.getByRole("button", { name: "Menu" });
  fireEvent.click(button);
  expect(button).toHaveAttribute("aria-expanded", "true");
  fireEvent.keyDown(document, { key: "Escape" });
  expect(button).toHaveAttribute("aria-expanded", "false");
  expect(document.activeElement).toBe(button);
});

test("an unknown address says not found, offers the way back and asks search engines to skip it", async () => {
  await go("/no-such-page");
  const view = render(<App />);
  await shown();

  expect(screen.getByRole("heading", { name: "Not found" })).toBeVisible();
  const main = within(screen.getByRole("main"));
  expect(main.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
  expect(main.getByRole("link", { name: "Recipes" })).toHaveAttribute("href", "/recipes");
  expect(main.getByRole("link", { name: "Install" })).toHaveAttribute("href", "/install");
  expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex");
  view.unmount();
  expect(document.querySelector('meta[name="robots"]')).toBeNull();
});
