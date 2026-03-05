import test from "node:test";
import assert from "node:assert/strict";
import { insertAuditSchema } from "../../shared/schema";
import { submitAuditSchema } from "../auditSchemas";

const validAuditPayload = {
  repoUrl: "https://github.com/acme/project",
  repoName: "project",
  ownerName: "acme",
  stack: "node",
  deploymentTarget: "railway",
  contactEmail: "founder@acme.dev",
  contactName: "Founding Engineer",
  status: "pending",
  biggestConcern: "Secrets in repo",
};

test("insertAuditSchema accepts required fields", () => {
  const parsed = insertAuditSchema.safeParse(validAuditPayload);
  assert.equal(parsed.success, true);
});

test("submitAuditSchema defaults triggerScan to true", () => {
  const parsed = submitAuditSchema.parse(validAuditPayload);
  assert.equal(parsed.triggerScan, true);
});

test("insertAuditSchema rejects missing required fields", () => {
  const { repoUrl, ...missingRepoUrl } = validAuditPayload;
  const parsed = insertAuditSchema.safeParse(missingRepoUrl);
  assert.equal(parsed.success, false);
});
