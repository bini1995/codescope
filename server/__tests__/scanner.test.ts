import test from "node:test";
import assert from "node:assert/strict";
import { buildFileTreeCacheKey, getLineNumber, shouldScanFile, truncateSnippet } from "../scanner";

test("shouldScanFile supports code/config files and skips binaries", () => {
  assert.equal(shouldScanFile("src/index.ts"), true);
  assert.equal(shouldScanFile("config/.env"), true);
  assert.equal(shouldScanFile("assets/logo.png"), false);
});

test("buildFileTreeCacheKey is deterministic", () => {
  assert.equal(buildFileTreeCacheKey("acme", "codescope", "abc123"), "acme/codescope@abc123");
});

test("line number and snippet helpers map source locations", () => {
  const content = ["line1", "line2", "line3", "line4", "line5"].join("\n");
  const index = content.indexOf("line3");
  const lineNum = getLineNumber(content, index);

  assert.equal(lineNum, 3);
  const snippet = truncateSnippet(content, lineNum, 1);
  assert.match(snippet, /2 \| line2/);
  assert.match(snippet, /3 \| line3/);
  assert.match(snippet, /4 \| line4/);
});
