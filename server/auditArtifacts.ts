import type { Audit, Finding } from "@shared/schema";

type Owner = "Frontend" | "Backend" | "DevOps";

type ArtifactIssue = {
  id: string;
  title: string;
  severity: string;
  category: string;
  owner: Owner;
  scope: string;
  acceptanceCriteria: string[];
};

type FailurePatternKey =
  | "hallucination_surface"
  | "auth_permission_fragility"
  | "dependency_sprawl"
  | "duplicated_business_logic"
  | "dead_routes"
  | "prompt_to_production_drift"
  | "missing_operational_controls"
  | "shallow_test_confidence"
  | "insecure_tutorial_defaults"
  | "pseudo_architecture";

const PATTERN_DEFINITIONS: Array<{
  key: FailurePatternKey;
  label: string;
  terms: string[];
  whyItMatters: string;
}> = [
  {
    key: "hallucination_surface",
    label: "Hallucination Surface",
    terms: ["hallucinat", "invented", "missing lockfile", "broken dependenc", "version conflict"],
    whyItMatters: "Invented or mismatched components create latent production failures.",
  },
  {
    key: "auth_permission_fragility",
    label: "Auth & Permission Fragility",
    terms: ["auth", "permission", "admin", "role", "tenant", "session", "jwt", "access control"],
    whyItMatters: "Access-control gaps are high-impact and often customer-visible.",
  },
  {
    key: "dependency_sprawl",
    label: "Dependency Sprawl",
    terms: ["dependency", "lockfile", "package", "npm", "version", "supply chain"],
    whyItMatters: "Unmanaged dependencies increase exploit and outage risk.",
  },
  {
    key: "duplicated_business_logic",
    label: "Duplicated Business Logic",
    terms: ["duplicate", "copied", "drift", "inconsistent validation"],
    whyItMatters: "Logic duplication causes divergent behavior and rework.",
  },
  {
    key: "dead_routes",
    label: "Dead Routes & Unreachable Features",
    terms: ["dead code", "unreachable", "unused", "orphaned route", "TODO", "FIXME"],
    whyItMatters: "Dead paths increase maintenance burden and onboarding confusion.",
  },
  {
    key: "prompt_to_production_drift",
    label: "Prompt-to-Production Drift",
    terms: ["drift", "does not match", "incomplete", "missing validation", "unexpected"],
    whyItMatters: "Spec drift breaks trust between intended and actual behavior.",
  },
  {
    key: "missing_operational_controls",
    label: "Missing Operational Controls",
    terms: ["rate limit", "backup", "monitor", "observability", "logging", "rollback", "ci", "cicd"],
    whyItMatters: "Without controls, routine incidents become outages.",
  },
  {
    key: "shallow_test_confidence",
    label: "Shallow Test Confidence",
    terms: ["test", "coverage", "missing tests", "not tested", "smoke"],
    whyItMatters: "Low-depth tests miss real-world failure modes.",
  },
  {
    key: "insecure_tutorial_defaults",
    label: "Insecure Defaults Copied from Tutorials",
    terms: ["cors", "secret", "hardcoded", "dangerouslysetinnerhtml", "eval", "open redirect"],
    whyItMatters: "Tutorial defaults often fail production threat models.",
  },
  {
    key: "pseudo_architecture",
    label: "Pseudo-Architecture",
    terms: ["n+1", "synchronous", "bottleneck", "scalability", "query", "timeouts"],
    whyItMatters: "Looks structured but degrades quickly under load.",
  },
];

function getOwnerSuggestion(finding: Pick<Finding, "category" | "filePath">): Owner {
  if (finding.category === "cicd" || finding.filePath?.includes(".github/")) return "DevOps";
  if (finding.filePath?.includes("client/") || finding.filePath?.includes("frontend/")) return "Frontend";
  return "Backend";
}

function calculateLaunchReadiness(audit: Audit) {
  const security = audit.securityScore ?? 0;
  const stability = audit.stabilityScore ?? 0;
  const operability = Math.round(((audit.maintainabilityScore ?? 0) + (audit.scalabilityScore ?? 0) + (audit.cicdScore ?? 0)) / 3);
  return Math.round(security * 0.4 + stability * 0.35 + operability * 0.25);
}

function toIssues(findings: Finding[]): ArtifactIssue[] {
  const severityWeight: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

  return findings
    .slice()
    .sort((a, b) => {
      const diff = (severityWeight[b.severity] ?? 0) - (severityWeight[a.severity] ?? 0);
      if (diff !== 0) return diff;
      return (a.title || "").localeCompare(b.title || "");
    })
    .slice(0, 12)
    .map((finding) => ({
      id: finding.id,
      title: finding.title,
      severity: finding.severity,
      category: finding.category,
      owner: getOwnerSuggestion(finding),
      scope: `${getOwnerSuggestion(finding)} team updates ${finding.filePath ?? "affected service"} and verifies behavior in staging.`,
      acceptanceCriteria: [
        `${finding.title} is no longer reproducible in QA/staging.`,
        "Automated tests cover the failure mode and edge cases.",
        `Re-scan no longer returns finding ${finding.id}.`,
      ],
    }));
}

function detectFailurePatterns(findings: Finding[]) {
  return PATTERN_DEFINITIONS.map((pattern) => {
    const matchedFindings = findings.filter((finding) => {
      const corpus = `${finding.title} ${finding.description} ${finding.fixSteps} ${finding.businessImpact} ${finding.filePath ?? ""}`.toLowerCase();
      return pattern.terms.some((term) => corpus.includes(term.toLowerCase()));
    });

    return {
      key: pattern.key,
      label: pattern.label,
      whyItMatters: pattern.whyItMatters,
      findingCount: matchedFindings.length,
      sampleFindings: matchedFindings.slice(0, 3).map((finding) => ({
        id: finding.id,
        title: finding.title,
        severity: finding.severity,
      })),
    };
  });
}

export function buildAuditBusinessAssets(audit: Audit, findings: Finding[]) {
  const issues = toIssues(findings);
  const launchReadiness = calculateLaunchReadiness(audit);
  const criticalCount = findings.filter((f) => f.severity === "critical").length;
  const highCount = findings.filter((f) => f.severity === "high").length;
  const patterns = detectFailurePatterns(findings);
  const topPattern = patterns.slice().sort((a, b) => b.findingCount - a.findingCount)[0];

  const ctoSummaryMemo = [
    `CTO Summary Memo — ${audit.ownerName}/${audit.repoName}`,
    `Launch readiness score: ${launchReadiness}/10`,
    `Risk snapshot: ${criticalCount} critical, ${highCount} high findings across ${findings.length} total findings.`,
    `Primary SignalLens pattern: ${topPattern?.label ?? "No dominant pattern detected"}.`,
    `Decision: prioritize top 5 issues in the next sprint and re-run scan before launch milestone.`,
  ].join("\n");

  const founderOnePager = [
    `Founder One-Pager — ${audit.ownerName}/${audit.repoName}`,
    `Can we launch safely now? ${launchReadiness >= 7 ? "Potentially, with targeted fixes." : "Not yet — core risk needs remediation."}`,
    `What could hurt trust fastest: ${issues[0]?.title ?? "No urgent blocker detected"}.`,
    `What to fix first this week: ${issues.slice(0, 3).map((i) => i.title).join("; ") || "No priority issues available."}`,
  ].join("\n");

  const handoffBrief = [
    `Send this to your dev — ${audit.ownerName}/${audit.repoName}`,
    "Objective: reduce launch risk by closing highest-severity findings first.",
    ...issues.slice(0, 5).map((issue, idx) => `${idx + 1}. ${issue.title} (${issue.severity}) — owner: ${issue.owner}.`),
    "Done criteria: issues no longer reproduce in staging and re-scan returns clean for patched areas.",
  ].join("\n");

  const securityQuestionnaireHelper = {
    questions: [
      {
        question: "How do you manage authentication and authorization?",
        answer: "Risk-based answer generated from auth-related findings and access-control checks.",
        evidence: findings.filter((f) => /auth|permission|session|role/i.test(`${f.title} ${f.description}`)).slice(0, 3).map((f) => f.title),
      },
      {
        question: "What controls exist for secrets and sensitive data?",
        answer: "Secret exposure checks and hardcoded credential detection are included in the scan.",
        evidence: findings.filter((f) => /secret|credential|key|token/i.test(`${f.title} ${f.description}`)).slice(0, 3).map((f) => f.title),
      },
      {
        question: "What is your secure SDLC and release control process?",
        answer: "CI/CD posture and operational controls are evaluated with explicit remediation actions.",
        evidence: findings.filter((f) => /ci|cicd|pipeline|deploy|rate limit|backup/i.test(`${f.title} ${f.description}`)).slice(0, 3).map((f) => f.title),
      },
    ],
  };

  const preSalesTechnicalTrustReport = {
    headline: `Technical trust posture for ${audit.ownerName}/${audit.repoName}`,
    launchReadiness,
    strengths: [
      audit.securityScore != null ? `Security score: ${audit.securityScore}/10` : null,
      audit.stabilityScore != null ? `Stability score: ${audit.stabilityScore}/10` : null,
      audit.cicdScore != null ? `CI/CD score: ${audit.cicdScore}/10` : null,
    ].filter(Boolean),
    activeRisks: issues.slice(0, 3).map((issue) => `${issue.title} (${issue.severity})`),
    buyerSafeSummary:
      launchReadiness >= 7
        ? "Core risks are identifiable and being actively remediated with a concrete plan."
        : "Material risks remain; mitigation is in progress with prioritized controls.",
  };

  const jiraCsv = ["Summary,Description,Priority,Labels,Owner,Acceptance Criteria"].concat(
    issues.map((issue) =>
      `"${issue.title.replace(/"/g, '""')}","${issue.scope.replace(/"/g, '""')}","${issue.severity}","codescope-remediation ${issue.category}","${issue.owner}","${issue.acceptanceCriteria.join("; ").replace(/"/g, '""')}"`
    )
  ).join("\n");

  const linearMarkdown = issues
    .map(
      (issue) =>
        `- [ ] ${issue.title}\n  - Priority: ${issue.severity}\n  - Owner: ${issue.owner}\n  - Scope: ${issue.scope}\n  - Acceptance criteria:\n${issue.acceptanceCriteria.map((item) => `    - ${item}`).join("\n")}`
    )
    .join("\n\n");

  return {
    framework: {
      name: "CodeAudit SignalLens",
      positioning: "AI-built products fail in recognizable patterns, and we detect those patterns faster than generic scanners.",
      patterns,
    },
    artifacts: {
      ctoSummaryMemo,
      founderOnePager,
      jiraLinearIssueExport: {
        issues,
        jiraCsv,
        linearMarkdown,
      },
      devHandoffBrief: handoffBrief,
      enterpriseSecurityQuestionnaireHelper: securityQuestionnaireHelper,
      preSalesTechnicalTrustReport,
    },
    generatedAt: new Date().toISOString(),
  };
}
