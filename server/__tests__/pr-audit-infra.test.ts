import { strict as assert } from "node:assert";
import test from "node:test";
import { analyzeDependencyVersions, parseGitHubIssueRef, parseGitHubPullRef, rankContextFiles } from "../prAuditInfra";

test("parseGitHubPullRef extracts owner/repo/pull number", () => {
  const ref = parseGitHubPullRef("Please audit https://github.com/octo/demo/pull/42 for launch readiness");
  assert.deepEqual(ref, { owner: "octo", repo: "demo", pullNumber: 42 });
});

test("parseGitHubIssueRef extracts owner/repo/issue number", () => {
  const ref = parseGitHubIssueRef("linked issue: https://github.com/octo/demo/issues/99");
  assert.deepEqual(ref, { owner: "octo", repo: "demo", issueNumber: 99 });
});

test("rankContextFiles prioritizes schema/docs files related to changed paths", () => {
  const files = [
    { path: "README.md", type: "file" as const },
    { path: "docs/payments.md", type: "file" as const },
    { path: "shared/schema.ts", type: "file" as const },
    { path: "server/routes.ts", type: "file" as const },
  ];

  const ranked = rankContextFiles(files, ["server/payments/checkout.ts", "shared/schema.ts"]);
  assert.equal(ranked[0], "shared/schema.ts");
  assert.ok(ranked.includes("docs/payments.md"));
});

test("analyzeDependencyVersions flags major lag as medium/high risk", () => {
  const results = analyzeDependencyVersions(
    { express: "^4.18.0", lodash: "^3.10.0", pinned: "1.0.0" },
    { express: "4.21.0", lodash: "5.0.0" },
  );

  assert.equal(results.some((r) => r.packageName === "lodash" && r.risk === "high"), true);
  assert.equal(results.some((r) => r.packageName === "pinned" && r.risk === "medium"), true);
});
