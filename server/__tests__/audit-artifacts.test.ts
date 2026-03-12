import test from "node:test";
import assert from "node:assert/strict";
import type { Audit, Finding } from "../../shared/schema";
import { buildAuditBusinessAssets } from "../auditArtifacts";

const baseAudit: Audit = {
  id: "audit_1",
  userId: "user_1",
  repoUrl: "https://github.com/acme/app",
  repoName: "app",
  ownerName: "acme",
  stack: "typescript",
  deploymentTarget: "railway",
  contactEmail: "founder@acme.dev",
  contactName: "Founder",
  status: "complete",
  biggestConcern: "launch risk",
  securityScore: 4,
  stabilityScore: 6,
  maintainabilityScore: 5,
  scalabilityScore: 5,
  cicdScore: 3,
  executiveSummary: null,
  remediationPlan: null,
  repoMeta: null,
  fileTree: null,
  scanLog: null,
  scannedAt: null,
  paidAt: new Date(),
  stripeSessionId: null,
  createdAt: new Date(),
};

const findings: Finding[] = [
  {
    id: "f1",
    auditId: "audit_1",
    category: "security",
    severity: "critical",
    title: "Unprotected admin mutation endpoint",
    description: "Admin route missing authorization checks",
    filePath: "server/routes/admin.ts",
    lineStart: 10,
    lineEnd: 20,
    codeSnippet: "app.post('/admin/delete', ...)",
    businessImpact: "Attackers could mutate protected records",
    fixSteps: "Add role middleware",
    effort: "M",
    status: "open",
    autoDetected: true,
  },
  {
    id: "f2",
    auditId: "audit_1",
    category: "cicd",
    severity: "high",
    title: "No secret scanning in CI",
    description: "Pipeline misses secret scanning step",
    filePath: ".github/workflows/ci.yml",
    lineStart: 1,
    lineEnd: 8,
    codeSnippet: null,
    businessImpact: "Secrets can ship to production",
    fixSteps: "Add gitleaks job",
    effort: "S",
    status: "open",
    autoDetected: true,
  },
];

test("buildAuditBusinessAssets returns concrete artifact outputs", () => {
  const assets = buildAuditBusinessAssets(baseAudit, findings);

  assert.equal(assets.framework.name, "CodeAudit SignalLens");
  assert.ok(assets.framework.patterns.length >= 10);
  assert.match(assets.artifacts.ctoSummaryMemo, /CTO Summary Memo/);
  assert.match(assets.artifacts.founderOnePager, /Founder One-Pager/);
  assert.match(assets.artifacts.devHandoffBrief, /Send this to your dev/);
  assert.equal(assets.artifacts.jiraLinearIssueExport.issues.length, 2);
  assert.match(assets.artifacts.jiraLinearIssueExport.jiraCsv, /Summary,Description,Priority/);
  assert.match(assets.artifacts.jiraLinearIssueExport.linearMarkdown, /- \[ \]/);
});
