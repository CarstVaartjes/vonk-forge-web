import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { Draft } from "../api/client";
import { DraftEditor } from "./draft-editor";
import { PublisherWorkspacePage } from "./publisher-workspace";


const recipe = {
  identity: { publisher: "ada-labs", slug: "qwen-fast" },
  metadata: { title: "Qwen Fast" },
  runtime: { image: `ghcr.io/ada/qwen@sha256:${"b".repeat(64)}` },
};

const passedDraft: Draft = {
  id: "draft-1",
  publisher: "ada-labs",
  recipe_id: "recipe-1",
  version: 3,
  state: "validated",
  content_sha256: "a".repeat(64),
  recipe,
  validation_problems: [],
  validation: {
    status: "passed",
    created_at: "2026-08-07T10:00:00Z",
    checks: [{ code: "registry.arm64_available", passed: true, detail: "linux/arm64 manifest found" }],
  },
};

function response(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

function signedInFetch(draft: Draft = passedDraft) {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/v1/me")) return response({
      user: { id: "user-1", display_name: "Ada" },
      accounts: [{ provider: "github", email: "ada@example.test" }],
      csrf_token: "csrf-1",
      session_expires_at: "2026-08-08T10:00:00Z",
    });
    if (url.endsWith("/v1/publishers")) return response({ items: [
      { id: "publisher-1", slug: "ada-labs", name: "Ada Labs", role: "owner", official: false },
    ] });
    if (url.endsWith("/v1/publishers/ada-labs/drafts") && (!init?.method || init.method === "GET")) {
      return response({ items: [draft] });
    }
    if (url.endsWith("/v1/publishers/ada-labs/drafts/draft-1/publish")) {
      return response({ revision_id: "revision-1", revision_number: 4, content_sha256: draft.content_sha256, official: false }, 201);
    }
    if (url.endsWith("/v1/publishers/ada-labs/drafts/draft-1/validate")) {
      return response({ job_id: "job-1", state: "queued" }, 202);
    }
    if (url.endsWith("/v1/publishers/ada-labs/forks")) return response({ draft_id: "fork-1" }, 201);
    if (url.endsWith("/v1/publishers/ada-labs/drafts") && init?.method === "POST") return response(draft, 201);
    throw new Error(`Unhandled request: ${init?.method ?? "GET"} ${url}`);
  });
}

beforeEach(() => {
  window.history.replaceState(null, "", "/publish");
});

afterEach(() => vi.unstubAllGlobals());


test("offers configured OAuth providers when the browser has no session", async () => {
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
    if (String(input).endsWith("/v1/me")) return response({
      type: "about:blank", title: "Sign in required", status: 401,
      code: "auth.required", detail: "Sign in first.", request_id: "request-1",
    }, 401);
    return response({ providers: ["github", "google"] });
  }));

  render(<PublisherWorkspacePage />);

  expect(await screen.findByRole("heading", { name: /sign in to your forge/i })).toBeVisible();
  expect(await screen.findByRole("link", { name: "Continue with GitHub" })).toHaveAttribute(
    "href", "/v1/auth/github/start?return_to=%2Fpublish",
  );
  expect(screen.getByRole("link", { name: "Continue with Google" })).toBeVisible();
});


test("shows exact evidence and requires explicit confirmation before publication", async () => {
  const fetchMock = signedInFetch();
  vi.stubGlobal("fetch", fetchMock);

  render(<PublisherWorkspacePage />);

  expect(await screen.findByRole("heading", { name: "Qwen Fast" })).toBeVisible();
  expect(screen.getByText("Pass · registry.arm64_available")).toBeVisible();
  const publish = screen.getByRole("button", { name: "Publish publicly" });
  expect(publish).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox", { name: /confirm these exact public identifiers/i }));
  expect(publish).toBeEnabled();
  fireEvent.click(publish);

  expect(await screen.findByText(/published immutable revision 4/i)).toBeVisible();
  expect(fetchMock).toHaveBeenCalledWith(
    "/v1/publishers/ada-labs/drafts/draft-1/publish",
    expect.objectContaining({ method: "POST", credentials: "include" }),
  );
});


test("uploads only a local JSON envelope and queues validation", async () => {
  const fetchMock = signedInFetch({ ...passedDraft, validation: null, state: "draft" });
  vi.stubGlobal("fetch", fetchMock);
  render(<PublisherWorkspacePage />);
  await screen.findByRole("heading", { name: "Qwen Fast" });

  const file = new File([JSON.stringify({ recipe, test_report: { schema_version: 1 } })], "recipe.json", { type: "application/json" });
  fireEvent.change(screen.getByLabelText("Upload local JSON"), { target: { files: [file] } });
  expect(await screen.findByText(/no container or model bytes were sent/i)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Validate this version" }));
  expect(await screen.findByText(/validation queued as job-1/i)).toBeVisible();

  const upload = fetchMock.mock.calls.find(([input, init]) =>
    String(input).endsWith("/drafts") && (init as RequestInit | undefined)?.method === "POST"
  );
  expect(JSON.parse(String((upload?.[1] as RequestInit).body))).toEqual({ recipe, test_report: { schema_version: 1 } });
});


test("creates a private, unvalidated fork from an immutable revision", async () => {
  window.history.replaceState(null, "", "/publish?fork_revision=revision-source");
  const fetchMock = signedInFetch();
  vi.stubGlobal("fetch", fetchMock);
  render(<PublisherWorkspacePage />);
  await screen.findByRole("heading", { name: "Qwen Fast" });
  fireEvent.change(screen.getByLabelText("New recipe slug"), { target: { value: "my-qwen" } });
  fireEvent.click(screen.getByRole("button", { name: "Create private fork" }));

  expect(await screen.findByText(/fork created as private draft fork-1/i)).toBeVisible();
  const call = fetchMock.mock.calls.find(([input]) => String(input).endsWith("/forks"));
  expect(JSON.parse(String((call?.[1] as RequestInit).body))).toEqual({
    source_revision_id: "revision-source", slug: "my-qwen",
  });
});


test("turns an ETag conflict into reload guidance instead of overwriting", async () => {
  vi.stubGlobal("fetch", vi.fn(() => response({
    type: "about:blank", title: "Version conflict", status: 409,
    code: "draft.version_conflict", detail: "The draft changed.", request_id: "request-2",
  }, 409)));
  render(<DraftEditor draft={passedDraft} csrf="csrf-1" onChange={vi.fn()} />);

  fireEvent.click(screen.getByRole("button", { name: "Save corrections" }));

  expect(await screen.findByText(/changed elsewhere.*reload it/i)).toBeVisible();
  expect(fetch).toHaveBeenCalledWith(
    "/v1/publishers/ada-labs/drafts/draft-1",
    expect.objectContaining({
      method: "PUT",
      headers: expect.objectContaining({ "If-Match": '"draft-version-3"' }),
    }),
  );
});


test("shows schema paths, terminal worker codes, and actionable repair guidance", () => {
  const failed: Draft = {
    ...passedDraft,
    state: "validation_failed",
    validation_problems: [{ path: "resources.per_node.installed_bytes", rule: "minimum", message: "must be positive" }],
    validation: {
      status: "failed", created_at: "2026-08-07T10:00:00Z",
      checks: [{ code: "registry.arm64_available", passed: false, detail: "No ARM64 manifest was found." }],
    },
  };
  render(<DraftEditor draft={failed} csrf="csrf-1" onChange={vi.fn()} />);

  expect(screen.getByText("Repair · resources.per_node.installed_bytes")).toBeVisible();
  expect(screen.getByText("Repair · registry.arm64_available")).toBeVisible();
  expect(screen.getByText(/publish a linux\/arm64 manifest/i)).toBeVisible();
});
