// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

const SKIP = "    if: github.event.pull_request.user.login != 'dependabot[bot]'";

// A Dependabot pull request uses no runner; its update lands through an
// integration pull request, which runs CI once.
test("every pull request CI job skips Dependabot pull requests", () => {
  const workflow = readFileSync(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");
  const jobs = workflow
    .split(/^jobs:\n/m)[1]
    .split(/^(?= {2}[\w-]+:\n)/m)
    .filter((job) => job.trim());
  expect(jobs.length).toBeGreaterThan(0);
  for (const job of jobs) expect(job.split("\n")).toContain(SKIP);
});
