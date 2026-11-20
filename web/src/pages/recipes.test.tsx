import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import type { RecipeSummary } from "../api/client";
import { readMySparks, saveMySparks } from "../my-sparks";
import { RecipesPage } from "./recipes";
import { catalogFacts, vocabularyFixture } from "../vocabulary.fixture";


const { loadRecipeCatalog, getVocabulary } = vi.hoisted(() => ({ loadRecipeCatalog: vi.fn(), getVocabulary: vi.fn() }));
vi.mock("../api/client", () => ({ loadRecipeCatalog, getVocabulary }));


const recipe: RecipeSummary = {
  publisher: "vonk",
  slug: "qwen-fast",
  title: "Qwen Fast",
  official: true,
  content_sha256: "a".repeat(64),
  published_at: "2026-08-07T10:00:00Z",
  runtime: { adapter: "vllm" },
  build: { dockerfile: "Dockerfile" },
  capacity: {
    profile_node_counts: [1],
    maximum_installed_bytes_per_node: 20 * 1024 ** 3,
    maximum_runtime_memory_bytes_per_node: 48 * 1024 ** 3,
  },
  moderation_warning: null,
  facts: { source_bundle_observed: true },
  catalog: catalogFacts({
    description: "",
    tags: ["openai.chat"],
    model_publisher: "vonk",
    model_slug: "qwen",
    model_title: "qwen",
    model_version_publisher: "vonk",
    model_version_slug: "qwen",
    model_version_title: "qwen",
    model_family: "Qwen",
    source_owner: null,
    source_repository: null,
    alignment: "unspecified",
    capabilities: ["chat"],
    qualification: "Not yet verified",
    qualification_reason: "never tested",
    execution_readiness: "not-declared",
    runtime_distribution: "vllm",
    precision: null,
    quantizations: [],
    node_count: 1,
    expected_download_bytes: 0,
  }),
};


beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/recipes?runtime=vllm&verified=0");
  loadRecipeCatalog.mockReset().mockResolvedValue([recipe]);
  getVocabulary.mockReset().mockResolvedValue(vocabularyFixture);
});


test("shows sizing, immutable identity, and evidence provenance", async () => {
  render(<RecipesPage />);
  expect(await screen.findByRole("link", { name: "Qwen Fast" })).toBeVisible();
  expect(screen.getByRole("cell", { name: "48 GiB" })).toBeVisible();
  expect(screen.getByText(/Source verified/)).toBeVisible();
  expect(within(screen.getByRole("table")).getByText(/Not yet verified/, { selector: ".status" })).toBeVisible();
  expect(screen.getByText(/never tested/)).toBeVisible();
  expect(screen.getByText(/not a Vonk endorsement/i)).toBeVisible();
  // Hashes and slugs belong to the recipe page, and a recipe with no executable contract shows it.
  expect(screen.queryByText(/aaaaaaaaaa…/)).not.toBeInTheDocument();
  expect(within(screen.getByRole("table")).getByText("Readiness not declared")).toBeVisible();
  expect(screen.getAllByRole("columnheader")).toHaveLength(6);
  expect(screen.getAllByRole("cell")).toHaveLength(6);
  expect(document.querySelector("td h2, td h3")).toBeNull();
});


test("the executable-contract badge shows only on a row that deviates from it", async () => {
  loadRecipeCatalog.mockResolvedValue([{ ...recipe, catalog: { ...recipe.catalog, execution_readiness: "executable" } }]);
  render(<RecipesPage />);
  await screen.findByRole("link", { name: "Qwen Fast" });
  expect(within(screen.getByRole("table")).queryByText("Executable contract")).not.toBeInTheDocument();
});

test("keeps Controller-parity filters in the URL and applies them locally", async () => {
  render(<RecipesPage />);
  await screen.findByRole("link", { name: "Qwen Fast" });
  fireEvent.change(screen.getByLabelText("Filter by abliterated"), { target: { value: "false" } });
  await waitFor(() => expect(window.location.search).toContain("abliterated=false"));
  const more = within(document.querySelector(".catalog-more") as HTMLElement);
  for (const name of ["Model family", "Engine", "Capabilities"]) expect(more.getByRole("group", { name })).toBeInTheDocument();
  for (const label of ["Filter by model", "Filter by memory per spark", "Filter by disk per spark", "Filter by download size", "Filter by updated date", "Filter by execution readiness", "Filter by qualification", "Filter by original repository"]) expect(more.getByLabelText(label)).toBeInTheDocument();
  expect(screen.getByText(/status appear only in/i)).toBeVisible();
  expect(screen.queryByRole("button", { name: "Cards" })).not.toBeInTheDocument();
});

test("starts from the visitor's Sparks and engine, in the same URL facets as the columns", async () => {
  window.history.replaceState(null, "", "/recipes?verified=0");
  render(<RecipesPage />);
  await screen.findByRole("link", { name: "Qwen Fast" });
  const oneSpark = screen.getByRole("button", { name: "1 Spark 1 recipe" });
  // "I have 2 Sparks" also runs the one-Spark recipe: a count means "that many or fewer".
  expect(screen.getByRole("button", { name: "2 Sparks 1 recipe" })).toBeEnabled();
  fireEvent.click(oneSpark);
  await waitFor(() => expect(window.location.search).toBe("?verified=0&sparks=1"));
  expect(oneSpark).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(within(screen.getByRole("group", { name: "Engine" })).getByRole("button", { name: "vLLM: 1" }));
  await waitFor(() => expect(window.location.search).toContain("runtime=vllm"));
  expect(within(screen.getByRole("group", { name: "Engine" })).getByRole("button", { name: "vLLM: 1" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getAllByRole("columnheader").map((header) => header.textContent?.trim())).toEqual(["Recipe", "Sparks", "Memory / Spark", "Engine", "Capabilities", "Status"]);
});

test("a header sorts ascending, then descending, then back to newest; a capacity bucket filters by at-most", async () => {
  render(<RecipesPage />);
  await screen.findByRole("link", { name: "Qwen Fast" });
  const memory = () => screen.getByRole("button", { name: /^Memory \/ Spark/ });
  fireEvent.click(memory());
  await waitFor(() => expect(window.location.search).toContain("sort=memory&direction=asc"));
  fireEvent.click(memory());
  await waitFor(() => expect(window.location.search).toContain("direction=desc"));
  fireEvent.click(memory());
  await waitFor(() => expect(window.location.search).not.toContain("sort="));
  // 48 GiB memory: only the "at most 64 GiB" bucket (and none below it) holds the recipe, so it is the one offered.
  const labels = [...screen.getByLabelText("Filter by memory per spark").querySelectorAll("option")].map((option) => option.textContent);
  expect(labels).toEqual(["Any", "≤ 64 GiB (1)"]);
  fireEvent.change(screen.getByLabelText("Filter by memory per spark"), { target: { value: "64" } });
  await waitFor(() => expect(window.location.search).toContain("memory=64"));
  expect(screen.getByRole("link", { name: "Qwen Fast" })).toBeVisible();
});


function verifiedCoder(): RecipeSummary {
  return { ...recipe, slug: "coder", title: "Coder", catalog: catalogFacts({ ...recipe.catalog, model_family: "Coder", model_version_slug: "coder", model_version_title: "coder", capabilities: ["code-generation"], qualification: "Working", qualification_reason: null }) };
}

describe("My Sparks", () => {
  test("a pick remembered from the home page fills in the Spark count, and the URL wins over it", async () => {
    saveMySparks({ sparks: "2", type: "" });
    window.history.replaceState(null, "", "/recipes?verified=0");
    const first = render(<RecipesPage />);
    await screen.findByRole("link", { name: "Qwen Fast" });
    expect(screen.getByRole("button", { name: "2 Sparks 1 recipe" })).toHaveAttribute("aria-pressed", "true");
    expect(window.location.search).toBe("?verified=0&sparks=2");
    first.unmount();

    window.history.replaceState(null, "", "/recipes?verified=0&sparks=1");
    render(<RecipesPage />);
    await screen.findByRole("link", { name: "Qwen Fast" });
    expect(screen.getByRole("button", { name: "1 Spark 1 recipe" })).toHaveAttribute("aria-pressed", "true");
  });

  test("picking on this page is remembered, and clearing the picker forgets it", async () => {
    window.history.replaceState(null, "", "/recipes?verified=0");
    render(<RecipesPage />);
    await screen.findByRole("link", { name: "Qwen Fast" });
    fireEvent.click(screen.getByRole("button", { name: "2 Sparks 1 recipe" }));
    expect(readMySparks("")).toEqual({ sparks: "2", type: "" });
    fireEvent.click(screen.getByRole("button", { name: "Every count 1 recipe" }));
    expect(readMySparks("")).toEqual({ sparks: "", type: "" });
  });

  test("the Spark picker is the first control of the setup section", async () => {
    render(<RecipesPage />);
    const setup = within(await screen.findByRole("region", { name: "Then narrow it to your setup." }));
    expect(setup.getAllByRole("group")[0]).toHaveAccessibleName("How many Sparks do you have?");
  });
});

describe("type-first filtering", () => {
  beforeEach(() => {
    loadRecipeCatalog.mockReset().mockResolvedValue([recipe, verifiedCoder()]);
  });

  test("shows only verified recipes until the toggle is turned off", async () => {
    window.history.replaceState(null, "", "/recipes");
    render(<RecipesPage />);
    expect(await screen.findByRole("link", { name: "Coder" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Qwen Fast" })).not.toBeInTheDocument();
    const toggle = screen.getByRole("checkbox", { name: /Verified on Spark/ });
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);
    await waitFor(() => expect(window.location.search).toBe("?verified=0"));
    expect(await screen.findByRole("link", { name: "Qwen Fast" })).toBeVisible();
    fireEvent.click(toggle);
    await waitFor(() => expect(window.location.search).toBe(""));
  });

  test("the type row comes first, counts with the other filters applied, and lives in the URL", async () => {
    window.history.replaceState(null, "", "/recipes?type=code");
    render(<RecipesPage />);
    expect(await screen.findByRole("link", { name: "Coder" })).toBeVisible();
    const types = screen.getByRole("group", { name: "Model type" });
    expect(within(types).getAllByRole("button").map((button) => button.textContent)).toEqual(["All 1", "Language 0", "Code 1", "Vision 0", "Image 0", "Video 0", "Audio 0", "3D 0", "Other 0"]);
    expect(within(types).getByRole("button", { name: "Code 1" })).toHaveAttribute("aria-pressed", "true");
    // The type row precedes the setup refinements in the page order.
    expect(types.compareDocumentPosition(screen.getByRole("group", { name: "How many Sparks do you have?" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(within(types).getByRole("button", { name: "All 1" }));
    await waitFor(() => expect(window.location.search).toBe(""));
    fireEvent.click(within(screen.getByRole("group", { name: "Model type" })).getByRole("button", { name: "Code 1" }));
    await waitFor(() => expect(window.location.search).toBe("?type=code"));
  });

  test("an explicit qualification turns the default off", async () => {
    window.history.replaceState(null, "", "/recipes?qualification=Not+yet+verified");
    render(<RecipesPage />);
    expect(await screen.findByRole("link", { name: "Qwen Fast" })).toBeVisible();
    expect(screen.getByRole("checkbox", { name: /Verified on Spark/ })).not.toBeChecked();
  });

  function variant(slug: string, owner: string, nodes: number, capabilities: string[]): RecipeSummary {
    const base = verifiedCoder();
    return { ...base, slug, title: slug, catalog: catalogFacts({ ...base.catalog, model_family: slug, model_version_slug: slug, model_version_title: slug, source_owner: owner, node_count: nodes, capabilities }) };
  }

  test("Sparks and Creator refinements change the type counts, and an empty type chip is aria-disabled", async () => {
    loadRecipeCatalog.mockReset().mockResolvedValue([variant("coder", "eugr", 1, ["code-generation"]), variant("chatter", "NVIDIA", 2, ["chat"])]);
    window.history.replaceState(null, "", "/recipes");
    render(<RecipesPage />);
    await screen.findByRole("link", { name: "coder" });
    const types = () => within(screen.getByRole("group", { name: "Model type" }));
    expect(types().getByRole("button", { name: "Code 1" })).not.toHaveAttribute("aria-disabled");
    expect(types().getByRole("button", { name: "Language 1" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "1 Spark 1 recipe" }));
    await waitFor(() => expect(types().getByRole("button", { name: "Language 0" })).toHaveAttribute("aria-disabled", "true"));
    expect(types().getByRole("button", { name: "Code 1" })).toBeVisible();
    // An empty chip stays focusable but does nothing.
    fireEvent.click(types().getByRole("button", { name: "Language 0" }));
    expect(window.location.search).toBe("?sparks=1");

    fireEvent.click(screen.getByRole("button", { name: "Every count 2 recipes" }));
    await waitFor(() => expect(window.location.search).toBe(""));
    fireEvent.click(within(screen.getByRole("group", { name: "Creator" })).getByRole("button", { name: "eugr: 1" }));
    await waitFor(() => expect(types().getByRole("button", { name: "Language 0" })).toHaveAttribute("aria-disabled", "true"));
    expect(types().getByRole("button", { name: "Code 1" })).toBeVisible();
  });

  test("the default Verified on Spark filter is an applied chip and is named in the empty state", async () => {
    window.history.replaceState(null, "", "/recipes?type=vision");
    render(<RecipesPage />);
    const empty = await screen.findByText("No matching recipes.");
    expect(empty.parentElement).toHaveTextContent(/Verified on Spark is on, so recipes that have not passed hardware checks/);
    const applied = screen.getByLabelText("Applied filters");
    expect(within(applied).getByRole("button", { name: /Verified on Spark/ })).toBeVisible();
    expect(within(applied).getByRole("button", { name: /Type: Vision/ })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Include recipes not yet verified" }));
    await waitFor(() => expect(window.location.search).toBe("?type=vision&verified=0"));
    fireEvent.click(screen.getAllByRole("button", { name: /^Reset filters/ })[0]!);
    await waitFor(() => expect(window.location.search).toBe(""));
    expect(screen.getByLabelText("Applied filters")).toHaveTextContent("Verified on Spark");
  });

  test("Reset counts only what the visitor chose, and restores the default Verified on Spark", async () => {
    window.history.replaceState(null, "", "/recipes");
    render(<RecipesPage />);
    await screen.findByRole("link", { name: "Coder" });
    expect(screen.getByLabelText("Applied filters")).toHaveTextContent("Verified on Spark");
    expect(screen.queryByRole("button", { name: /^Reset filters/ })).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("group", { name: "Model type" })).getByRole("button", { name: "Code 1" }));
    const reset = await screen.findByRole("button", { name: /^Reset filters/ });
    expect(reset).toHaveTextContent("to Verified on Spark");
    fireEvent.click(reset);
    await waitFor(() => expect(window.location.search).toBe(""));
    expect(screen.getByRole("checkbox", { name: /Verified on Spark/ })).toBeChecked();
    expect(screen.queryByRole("button", { name: /^Reset filters/ })).not.toBeInTheDocument();
  });
});


test("explains each status shown with the release's meaning, links every badge to the explanation, and lists only the published statuses", async () => {
  loadRecipeCatalog.mockResolvedValue([
    recipe,
    { ...recipe, slug: "odd", title: "Odd", catalog: { ...recipe.catalog, qualification: "Status from a newer library" } },
  ]);
  render(<RecipesPage />);
  await screen.findByRole("link", { name: "Odd" });
  const legend = within(document.getElementById("how-recipes-are-verified") as HTMLElement);
  expect(legend.getByText(/information to help you choose, never a gate/)).toBeInTheDocument();
  // The vocabulary's meaning, exactly as published; a status it has no entry for is listed by name alone.
  expect(legend.getAllByText("Status from a newer library")).toHaveLength(1);
  expect(legend.getByText("No hardware verdict yet; the reason is shown under the badge.")).toBeInTheDocument();
  expect(legend.queryByText("Working")).toBeNull();
  expect(legend.queryByRole("link")).toBeNull();
  const table = within(screen.getByRole("table"));
  const known = table.getByRole("link", { name: "Not yet verified" });
  const unknown = table.getByRole("link", { name: "Status from a newer library" });
  expect(known).toHaveAttribute("title", "No hardware verdict yet; the reason is shown under the badge.");
  expect(unknown).not.toHaveAttribute("title");
  [known, unknown].forEach((link) => expect(link).toHaveAttribute("href", "#how-recipes-are-verified"));
});
