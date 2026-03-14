import test from "node:test";
import assert from "node:assert/strict";
import { parseGitHubRepo } from "../previewScan";
import { buildPreviewPdf } from "../previewDelivery";

test("parseGitHubRepo parses owner and repo", () => {
  assert.deepEqual(parseGitHubRepo("https://github.com/acme/widgets"), { owner: "acme", repo: "widgets" });
  assert.equal(parseGitHubRepo("https://example.com/acme/widgets"), null);
});

test("buildPreviewPdf returns a PDF buffer", () => {
  const pdf = buildPreviewPdf({
    fullName: "acme/widgets",
    defaultBranch: "main",
    filesScanned: 12,
    treeEntries: 18,
    repoSizeKb: 120,
    semgrepMatches: [],
    gitleaksMatches: [],
  });

  assert.equal(Buffer.isBuffer(pdf), true);
  assert.equal(pdf.toString("utf8", 0, 8), "%PDF-1.4");
});
