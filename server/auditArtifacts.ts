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

type EnterpriseObjection = {
  title: string;
  reason: string;
  severity: string;
  sampleFindingTitles: string[];
};

type CrossFunctionalLane = {
  key:
    | "code_risk"
    | "reliability_risk"
    | "operational_risk"
    | "maintainability_risk"
    | "cost_inefficiency"
    | "launch_readiness_risk";
  label: string;
  status: "strong" | "watch" | "at_risk";
  summary: string;
  signalCount: number;
  sampleFindingTitles: string[];
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
    terms: [
      "rate limit",
      "backup",
      "monitor",
      "observability",
      "logging",
      "rollback",
      "ci",
      "cicd",
    ],
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

const ENTERPRISE_REJECTION_SIGNALS: Array<{
  title: string;
  reason: string;
  terms: string[];
}> = [
  {
    title: "Access controls look brittle under customer data boundaries",
    reason: "Enterprise buyers will block rollout if tenant and admin boundaries are unclear.",
    terms: ["auth", "permission", "role", "tenant", "admin", "session", "access control"],
  },
  {
    title: "No durable operational controls for incident response",
    reason:
      "Security reviews flag teams that cannot prove restore, rollback, or alerting readiness.",
    terms: ["backup", "restore", "rollback", "monitor", "observability", "rate limit", "runbook"],
  },
  {
    title: "Release pipeline cannot prove software supply-chain hygiene",
    reason:
      "Procurement security checklists reject repos without dependable CI/CD and secret controls.",
    terms: [
      "cicd",
      "pipeline",
      "secret",
      "lockfile",
      "dependency",
      "supply chain",
      "github actions",
    ],
  },
  {
    title: "Core reliability path likely fails under traffic spikes",
    reason: "Prospects running pilots expect evidence that the app survives real production load.",
    terms: ["timeout", "n+1", "bottleneck", "queue", "outage", "scalability", "synchronous"],
  },
];

const severityWeight: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

function getOwnerSuggestion(finding: Pick<Finding, "category" | "filePath">): Owner {
  if (finding.category === "cicd" || finding.filePath?.includes(".github/")) return "DevOps";
  if (finding.filePath?.includes("client/") || finding.filePath?.includes("frontend/"))
    return "Frontend";
  return "Backend";
}

function calculateLaunchReadiness(audit: Audit) {
  const security = audit.securityScore ?? 0;
  const stability = audit.stabilityScore ?? 0;
  const operability = Math.round(
    ((audit.maintainabilityScore ?? 0) + (audit.scalabilityScore ?? 0) + (audit.cicdScore ?? 0)) / 3
  );
  return Math.round(security * 0.4 + stability * 0.35 + operability * 0.25);
}

function toIssues(findings: Finding[]): ArtifactIssue[] {
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

function buildEnterpriseProspectRejector(findings: Finding[]) {
  const objections: EnterpriseObjection[] = ENTERPRISE_REJECTION_SIGNALS.map((signal) => {
    const matches = findings.filter((finding) => {
      const corpus =
        `${finding.title} ${finding.description} ${finding.businessImpact} ${finding.fixSteps} ${finding.filePath ?? ""}`.toLowerCase();
      return signal.terms.some((term) => corpus.includes(term.toLowerCase()));
    });

    const strongestMatch = matches
      .slice()
      .sort((a, b) => (severityWeight[b.severity] ?? 0) - (severityWeight[a.severity] ?? 0))[0];

    return {
      title: signal.title,
      reason: signal.reason,
      severity: strongestMatch?.severity ?? "low",
      sampleFindingTitles: matches.slice(0, 3).map((match) => match.title),
    };
  })
    .filter((item) => item.sampleFindingTitles.length > 0)
    .sort((a, b) => (severityWeight[b.severity] ?? 0) - (severityWeight[a.severity] ?? 0));

  const topObjections = objections.slice(0, 3);

  return {
    headline:
      topObjections.length > 0
        ? "What an enterprise prospect would likely reject first"
        : "No enterprise-blocking rejection signal was strongly detected in this scan",
    confidenceLabel: topObjections.length >= 2 ? "moderate confidence" : "low confidence",
    objections: topObjections,
    manualReviewPrompt:
      "Treat this as a semi-manual callout: validate these themes in architecture review and customer security questionnaires.",
  };
}

function findingMatchesTerms(finding: Finding, terms: string[]) {
  const corpus =
    `${finding.title} ${finding.description} ${finding.businessImpact} ${finding.fixSteps} ${finding.filePath ?? ""}`.toLowerCase();
  return terms.some((term) => corpus.includes(term.toLowerCase()));
}

function laneStatus(signalCount: number, scoreHint?: number): "strong" | "watch" | "at_risk" {
  if (scoreHint != null && scoreHint <= 4) return "at_risk";
  if (scoreHint != null && scoreHint <= 7) return "watch";
  if (signalCount >= 3) return "at_risk";
  if (signalCount >= 1) return "watch";
  return "strong";
}

function buildStartupStageBenchmark(audit: Audit, launchReadiness: number) {
  const avgScore = Math.round(
    ((audit.securityScore ?? 0) +
      (audit.stabilityScore ?? 0) +
      (audit.maintainabilityScore ?? 0) +
      (audit.scalabilityScore ?? 0) +
      (audit.cicdScore ?? 0)) / 5
  );
  const stage = avgScore >= 8 ? "top quartile" : avgScore >= 6 ? "mid pack" : "below peer baseline";
  return {
    stage,
    benchmarkScore: avgScore,
    launchReadiness,
    summary:
      avgScore >= 8
        ? "Operating above similar-stage startup baseline; keep momentum with preventive controls."
        : avgScore >= 6
        ? "Near similar-stage startup baseline; focused remediation can move you into top quartile quickly."
        : "Below similar-stage startup baseline; resolving top blockers is likely required before launch or diligence.",
  };
}

function buildFounderSingleAnswer(audit: Audit, findings: Finding[], launchReadiness: number) {
  const lanes: CrossFunctionalLane[] = [
    {
      key: "code_risk",
      label: "Code risk",
      summary: "Defect and exploit surface in application code paths.",
      signalCount: findings.filter((f) => ["security", "stability"].includes(f.category)).length,
      sampleFindingTitles: findings
        .filter((f) => ["security", "stability"].includes(f.category))
        .slice(0, 3)
        .map((f) => f.title),
      status: laneStatus(
        findings.filter((f) => ["security", "stability"].includes(f.category)).length,
        audit.securityScore ?? undefined
      ),
    },
    {
      key: "reliability_risk",
      label: "Reliability risk",
      summary: "Likelihood of downtime, latency spikes, and user-visible breakage.",
      signalCount: findings.filter((f) =>
        findingMatchesTerms(f, ["timeout", "outage", "retry", "queue", "crash", "availability"])
      ).length,
      sampleFindingTitles: findings
        .filter((f) =>
          findingMatchesTerms(f, ["timeout", "outage", "retry", "queue", "crash", "availability"])
        )
        .slice(0, 3)
        .map((f) => f.title),
      status: laneStatus(
        findings.filter((f) =>
          findingMatchesTerms(f, ["timeout", "outage", "retry", "queue", "crash", "availability"])
        ).length,
        audit.stabilityScore ?? undefined
      ),
    },
    {
      key: "operational_risk",
      label: "Operational risk",
      summary: "Readiness of monitoring, rollback, backups, and release controls.",
      signalCount: findings.filter((f) =>
        findingMatchesTerms(f, [
          "monitor",
          "observability",
          "backup",
          "restore",
          "rollback",
          "rate limit",
          "cicd",
          "pipeline",
        ])
      ).length,
      sampleFindingTitles: findings
        .filter((f) =>
          findingMatchesTerms(f, [
            "monitor",
            "observability",
            "backup",
            "restore",
            "rollback",
            "rate limit",
            "cicd",
            "pipeline",
          ])
        )
        .slice(0, 3)
        .map((f) => f.title),
      status: laneStatus(
        findings.filter((f) =>
          findingMatchesTerms(f, [
            "monitor",
            "observability",
            "backup",
            "restore",
            "rollback",
            "rate limit",
            "cicd",
            "pipeline",
          ])
        ).length,
        audit.cicdScore ?? undefined
      ),
    },
    {
      key: "maintainability_risk",
      label: "Maintainability risk",
      summary: "How quickly the team can change code without regressions or rewrite pressure.",
      signalCount: findings.filter((f) =>
        findingMatchesTerms(f, [
          "duplicate",
          "drift",
          "dead code",
          "unreachable",
          "missing tests",
          "coverage",
        ])
      ).length,
      sampleFindingTitles: findings
        .filter((f) =>
          findingMatchesTerms(f, [
            "duplicate",
            "drift",
            "dead code",
            "unreachable",
            "missing tests",
            "coverage",
          ])
        )
        .slice(0, 3)
        .map((f) => f.title),
      status: laneStatus(
        findings.filter((f) =>
          findingMatchesTerms(f, [
            "duplicate",
            "drift",
            "dead code",
            "unreachable",
            "missing tests",
            "coverage",
          ])
        ).length,
        audit.maintainabilityScore ?? undefined
      ),
    },
    {
      key: "cost_inefficiency",
      label: "Cost inefficiency",
      summary: "Hidden infrastructure and engineering cost drag as traffic grows.",
      signalCount: findings.filter((f) =>
        findingMatchesTerms(f, [
          "n+1",
          "bottleneck",
          "synchronous",
          "query",
          "scalability",
          "memory",
          "cpu",
          "overfetch",
        ])
      ).length,
      sampleFindingTitles: findings
        .filter((f) =>
          findingMatchesTerms(f, [
            "n+1",
            "bottleneck",
            "synchronous",
            "query",
            "scalability",
            "memory",
            "cpu",
            "overfetch",
          ])
        )
        .slice(0, 3)
        .map((f) => f.title),
      status: laneStatus(
        findings.filter((f) =>
          findingMatchesTerms(f, [
            "n+1",
            "bottleneck",
            "synchronous",
            "query",
            "scalability",
            "memory",
            "cpu",
            "overfetch",
          ])
        ).length,
        audit.scalabilityScore ?? undefined
      ),
    },
    {
      key: "launch_readiness_risk",
      label: "Launch-readiness risk",
      summary: "Overall probability of a rough launch without targeted remediation.",
      signalCount: findings.filter((f) => severityWeight[f.severity] >= 3).length,
      sampleFindingTitles: findings
        .filter((f) => severityWeight[f.severity] >= 3)
        .slice(0, 3)
        .map((f) => f.title),
      status: laneStatus(
        findings.filter((f) => severityWeight[f.severity] >= 3).length,
        launchReadiness
      ),
    },
  ];

  const atRiskCount = lanes.filter((lane) => lane.status === "at_risk").length;
  const watchCount = lanes.filter((lane) => lane.status === "watch").length;

  return {
    headline:
      "One sane answer across code, reliability, ops, maintainability, cost, and launch readiness",
    launchRecommendation:
      atRiskCount >= 2 || launchReadiness < 7
        ? "Do not launch as-is. Close at-risk lanes first, then re-run audit before release."
        : "Launch is plausible with focused mitigation on watch lanes and tight post-launch monitoring.",
    portfolioSummary: `SignalLens found ${atRiskCount} at-risk lanes and ${watchCount} watch lanes from ${findings.length} findings.`,
    lanes,
  };
}

function detectFailurePatterns(findings: Finding[]) {
  return PATTERN_DEFINITIONS.map((pattern) => {
    const matchedFindings = findings.filter((finding) => {
      const corpus =
        `${finding.title} ${finding.description} ${finding.fixSteps} ${finding.businessImpact} ${finding.filePath ?? ""}`.toLowerCase();
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
    `What to fix first this week: ${
      issues
        .slice(0, 3)
        .map((i) => i.title)
        .join("; ") || "No priority issues available."
    }`,
  ].join("\n");

  const handoffBrief = [
    `Send this to your dev — ${audit.ownerName}/${audit.repoName}`,
    "Objective: reduce launch risk by closing highest-severity findings first.",
    ...issues
      .slice(0, 5)
      .map(
        (issue, idx) => `${idx + 1}. ${issue.title} (${issue.severity}) — owner: ${issue.owner}.`
      ),
    "Done criteria: issues no longer reproduce in staging and re-scan returns clean for patched areas.",
  ].join("\n");

  const securityQuestionnaireHelper = {
    questions: [
      {
        question: "How do you manage authentication and authorization?",
        answer: "Risk-based answer generated from auth-related findings and access-control checks.",
        evidence: findings
          .filter((f) => /auth|permission|session|role/i.test(`${f.title} ${f.description}`))
          .slice(0, 3)
          .map((f) => f.title),
      },
      {
        question: "What controls exist for secrets and sensitive data?",
        answer:
          "Secret exposure checks and hardcoded credential detection are included in the scan.",
        evidence: findings
          .filter((f) => /secret|credential|key|token/i.test(`${f.title} ${f.description}`))
          .slice(0, 3)
          .map((f) => f.title),
      },
      {
        question: "What is your secure SDLC and release control process?",
        answer:
          "CI/CD posture and operational controls are evaluated with explicit remediation actions.",
        evidence: findings
          .filter((f) =>
            /ci|cicd|pipeline|deploy|rate limit|backup/i.test(`${f.title} ${f.description}`)
          )
          .slice(0, 3)
          .map((f) => f.title),
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

  const jiraCsv = ["Summary,Description,Priority,Labels,Owner,Acceptance Criteria"]
    .concat(
      issues.map(
        (issue) =>
          `"${issue.title.replace(/"/g, '""')}","${issue.scope.replace(/"/g, '""')}","${issue.severity}","codescope-remediation ${issue.category}","${issue.owner}","${issue.acceptanceCriteria.join("; ").replace(/"/g, '""')}"`
      )
    )
    .join("\n");

  const linearMarkdown = issues
    .map(
      (issue) =>
        `- [ ] ${issue.title}\n  - Priority: ${issue.severity}\n  - Owner: ${issue.owner}\n  - Scope: ${issue.scope}\n  - Acceptance criteria:\n${issue.acceptanceCriteria.map((item) => `    - ${item}`).join("\n")}`
    )
    .join("\n\n");

  const enterpriseProspectRejector = buildEnterpriseProspectRejector(findings);
  const founderSingleAnswer = buildFounderSingleAnswer(audit, findings, launchReadiness);
  const startupStageBenchmark = buildStartupStageBenchmark(audit, launchReadiness);

  return {
    framework: {
      name: "CodeAudit SignalLens",
      positioning:
        "AI-built products fail in recognizable patterns, and we detect those patterns faster than generic scanners.",
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
      enterpriseProspectRejector,
      founderSingleAnswer,
      startupStageBenchmark,
    },
    generatedAt: new Date().toISOString(),
  };
}
