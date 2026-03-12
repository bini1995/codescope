import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreRadar } from "@/components/score-radar";
import { ScoreBar } from "@/components/score-bar";
import { SeverityBadge } from "@/components/severity-badge";
import { StatusBadge } from "@/components/status-badge";
import { FindingCard } from "@/components/finding-card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { SCAN_LIMITS, formatRepoSizeLimitMb } from "@shared/scan-limits";
import {
  Code2,
  ArrowLeft,
  Shield,
  Zap,
  Wrench,
  TrendingUp,
  GitBranch,
  ExternalLink,
  Calendar,
  User,
  Mail,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Scan,
  FolderTree,
  FileCode2,
  Star,
  GitFork,
  Activity,
  Globe,
  Lock,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  CreditCard,
  Unlock,
  FileDown,
  Download,
  Gauge,
} from "lucide-react";
import type { Audit, Finding, RepoMeta, FileTreeItem, ScanLogEntry } from "@shared/schema";
import { useState, useEffect } from "react";

type SeverityFilter = "all" | "critical" | "high" | "medium" | "low";
type CategoryFilter = "all" | "security" | "stability" | "maintainability" | "scalability" | "cicd";

type AuditWithPaid = Audit & { isPaid?: boolean };

type EffortBucket = "1 hour" | "1 day" | "1 week";

type FindingWithPriority = Finding & {
  riskScore: number;
  effortBucket: EffortBucket;
  owner: "Frontend" | "Backend" | "DevOps";
};

const severityWeights: Record<string, number> = {
  critical: 10,
  high: 7,
  medium: 4,
  low: 2,
};

function getEffortBucket(effort: string): EffortBucket {
  if (effort === "S") return "1 hour";
  if (effort === "M") return "1 day";
  return "1 week";
}

function getOwnerSuggestion(finding: Finding): "Frontend" | "Backend" | "DevOps" {
  if (finding.category === "cicd" || finding.filePath?.includes(".github/")) return "DevOps";
  if (finding.filePath?.includes("client/") || finding.filePath?.includes("frontend/"))
    return "Frontend";
  return "Backend";
}

type MiniAuditStatus = "pass" | "fail" | "unknown";

type MiniAuditCheck = {
  key: string;
  title: string;
  owner: "Frontend" | "Backend" | "DevOps";
  status: MiniAuditStatus;
  reason: string;
};

type TicketDraft = {
  finding: FindingWithPriority;
  scope: string;
  acceptanceCriteria: string[];
};

type EnterpriseProspectRejector = {
  headline: string;
  confidenceLabel: string;
  manualReviewPrompt: string;
  objections: Array<{
    title: string;
    reason: string;
    severity: string;
    sampleFindingTitles: string[];
  }>;
};

type FounderSingleAnswer = {
  headline: string;
  launchRecommendation: string;
  portfolioSummary: string;
  lanes: Array<{
    key: string;
    label: string;
    status: "strong" | "watch" | "at_risk";
    summary: string;
    signalCount: number;
    sampleFindingTitles: string[];
  }>;
};

function findSignal(findings: Finding[], terms: string[]) {
  const lowerTerms = terms.map((t) => t.toLowerCase());
  return findings.find((f) => {
    const corpus = `${f.title} ${f.description} ${f.fixSteps} ${f.filePath ?? ""}`.toLowerCase();
    return lowerTerms.some((term) => corpus.includes(term));
  });
}

function buildMiniAuditChecks(findings: Finding[]): MiniAuditCheck[] {
  const checks = [
    {
      key: "rate-limit",
      title: "Rate limiting in API edge",
      owner: "Backend" as const,
      terms: ["rate limit", "throttle"],
    },
    {
      key: "csp",
      title: "Content-Security-Policy headers",
      owner: "Frontend" as const,
      terms: ["content-security-policy", "csp"],
    },
    {
      key: "session",
      title: "Secure session cookie flags",
      owner: "Backend" as const,
      terms: ["session cookie", "secure cookie", "httponly", "samesite"],
    },
    {
      key: "secret-scan",
      title: "Secret scanning in CI/CD",
      owner: "DevOps" as const,
      terms: ["secret scanning", "gitleaks", "secret", "github actions"],
    },
    {
      key: "backups",
      title: "Backups + restore runbook",
      owner: "DevOps" as const,
      terms: ["backup", "restore", "rpo", "rto"],
    },
  ];

  return checks.map((check) => {
    const hit = findSignal(findings, check.terms);
    if (!hit) {
      return {
        key: check.key,
        title: check.title,
        owner: check.owner,
        status: "unknown" as const,
        reason: "No explicit signal found in this scan. Verify manually.",
      };
    }

    return {
      key: check.key,
      title: check.title,
      owner: check.owner,
      status: hit.severity === "low" ? ("pass" as const) : ("fail" as const),
      reason:
        hit.severity === "low"
          ? `Observed low-risk signal in finding: ${hit.title}`
          : `Gap detected in finding: ${hit.title}`,
    };
  });
}

function launchReadinessScore(audit: AuditWithPaid) {
  const security = audit.securityScore ?? 0;
  const stability = audit.stabilityScore ?? 0;
  const operability = Math.round(
    ((audit.maintainabilityScore ?? 0) + (audit.scalabilityScore ?? 0) + (audit.cicdScore ?? 0)) / 3
  );
  const score = Math.round(security * 0.4 + stability * 0.35 + operability * 0.25);
  return { score, security, stability, operability };
}

export default function AuditDetail() {
  const [, params] = useRoute("/audit/:id");
  const auditId = params?.id;
  const { toast } = useToast();
  const searchString = useSearch();

  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [showFileTree, setShowFileTree] = useState(false);
  const [showScanLog, setShowScanLog] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleGeneratePdf = async () => {
    setIsGeneratingPdf(true);
    try {
      window.print();
      toast({
        title: "Print dialog opened",
        description: 'Choose "Save as PDF" in your browser to export this report.',
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const {
    data: audit,
    isLoading: auditLoading,
    error: auditError,
  } = useQuery<AuditWithPaid>({
    queryKey: ["/api/audits", auditId],
    enabled: !!auditId,
    refetchInterval: (query) => {
      const data = query.state.data as AuditWithPaid | undefined;
      return data?.status === "in_progress" ? 3000 : false;
    },
  });

  const { data: findings, isLoading: findingsLoading } = useQuery<Finding[]>({
    queryKey: ["/api/audits", auditId, "findings"],
    enabled: !!auditId,
    refetchInterval: () => {
      return audit?.status === "in_progress" ? 5000 : false;
    },
  });

  const { data: businessAssets } = useQuery<{
    artifacts?: {
      enterpriseProspectRejector?: EnterpriseProspectRejector;
      founderSingleAnswer?: FounderSingleAnswer;
    };
  }>({
    queryKey: ["/api/audits", auditId, "business-assets"],
    enabled: !!auditId && audit?.status === "complete",
  });

  useEffect(() => {
    if (searchString?.includes("payment=success") && auditId) {
      apiRequest("POST", `/api/audits/${auditId}/verify-payment`)
        .then((res) => res.json())
        .then((data) => {
          if (data.paid) {
            toast({
              title: "Payment Successful",
              description: "Full remediation details are now unlocked.",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/audits", auditId] });
            queryClient.invalidateQueries({ queryKey: ["/api/audits", auditId, "findings"] });
            window.history.replaceState({}, "", `/audit/${auditId}`);
          }
        })
        .catch(() => {});
    }
  }, [searchString, auditId]);

  const scanMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/audits/${auditId}/scan`);
    },
    onSuccess: () => {
      toast({ title: "Scan Started", description: "Analyzing your repository..." });
      queryClient.invalidateQueries({ queryKey: ["/api/audits", auditId] });
    },
    onError: (err: Error) => {
      toast({ title: "Scan Failed", description: err.message, variant: "destructive" });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/audits/${auditId}/checkout`);
      return await res.json();
    },
    onSuccess: (data) => {
      if (data.alreadyPaid) {
        toast({ title: "Already Unlocked", description: "This audit is already fully unlocked." });
        queryClient.invalidateQueries({ queryKey: ["/api/audits", auditId] });
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (err: Error) => {
      toast({ title: "Checkout Failed", description: err.message, variant: "destructive" });
    },
  });

  const filteredFindings = findings?.filter((f) => {
    if (severityFilter !== "all" && f.severity !== severityFilter) return false;
    if (categoryFilter !== "all" && f.category !== categoryFilter) return false;
    return true;
  });

  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const sortedFindings = filteredFindings
    ?.slice()
    .sort(
      (a, b) =>
        (severityOrder[a.severity as keyof typeof severityOrder] ?? 4) -
        (severityOrder[b.severity as keyof typeof severityOrder] ?? 4)
    );

  const findingCounts = {
    critical: findings?.filter((f) => f.severity === "critical").length ?? 0,
    high: findings?.filter((f) => f.severity === "high").length ?? 0,
    medium: findings?.filter((f) => f.severity === "medium").length ?? 0,
    low: findings?.filter((f) => f.severity === "low").length ?? 0,
  };
  const findingsWithPriority: FindingWithPriority[] = (findings ?? []).map((f) => {
    const weight = severityWeights[f.severity] ?? 1;
    const effortBucket = getEffortBucket(f.effort);
    const effortDivisor = effortBucket === "1 hour" ? 1 : effortBucket === "1 day" ? 2 : 3;
    return {
      ...f,
      effortBucket,
      owner: getOwnerSuggestion(f),
      riskScore: Math.max(1, Math.round((weight * 10) / effortDivisor)),
    };
  });

  const topExistentialRisks = findingsWithPriority
    .slice()
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 3);

  const quickestHighReduction = findingsWithPriority
    .filter((f) => f.effortBucket === "1 hour" || f.effortBucket === "1 day")
    .slice()
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 5);

  const byEffort = {
    "1 hour": findingsWithPriority.filter((f) => f.effortBucket === "1 hour"),
    "1 day": findingsWithPriority.filter((f) => f.effortBucket === "1 day"),
    "1 week": findingsWithPriority.filter((f) => f.effortBucket === "1 week"),
  };

  const miniAuditChecks = buildMiniAuditChecks(findings ?? []);
  const miniAuditSummary = {
    pass: miniAuditChecks.filter((c) => c.status === "pass").length,
    fail: miniAuditChecks.filter((c) => c.status === "fail").length,
    unknown: miniAuditChecks.filter((c) => c.status === "unknown").length,
  };

  const enterpriseRejector = businessAssets?.artifacts?.enterpriseProspectRejector;
  const founderSingleAnswer = businessAssets?.artifacts?.founderSingleAnswer;

  const ticketDrafts: TicketDraft[] = quickestHighReduction.map((finding) => ({
    finding,
    scope: `${finding.owner} team updates ${finding.filePath ?? "affected service"} and related tests.`,
    acceptanceCriteria: [
      `${finding.title} is no longer reproducible in QA/staging.`,
      `Automated test coverage added/updated for this failure mode.`,
      `Re-scan result no longer returns finding ${finding.id}.`,
    ],
  }));

  const ninetyDayOutlook =
    topExistentialRisks.length > 0
      ? `If unchanged for 90 days, the highest likelihood failures are: ${topExistentialRisks
          .map((risk) => risk.title.toLowerCase())
          .join(
            ", "
          )}. This creates outsized risk for customer trust, uptime, and delivery velocity.`
      : "No critical degradation projected in 90 days from current findings.";

  const downloadFile = (name: string, content: string, type = "text/plain") => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportLinear = () => {
    const payload = ticketDrafts
      .map(
        (ticket) =>
          `- [ ] ${ticket.finding.title}
  - Priority: ${ticket.finding.severity}
  - Owner: ${ticket.finding.owner}
  - Scope: ${ticket.scope}
  - Acceptance criteria:
${ticket.acceptanceCriteria.map((item) => `    - ${item}`).join("\n")}`
      )
      .join("\n\n");
    downloadFile(
      `${audit?.repoName || "audit-report"}-linear-backlog.md`,
      payload || "No prioritized issues available"
    );
  };

  const handleExportJira = () => {
    const rows = ["Summary,Description,Priority,Labels,Owner,Acceptance Criteria"].concat(
      ticketDrafts.map(
        (ticket) =>
          `"${ticket.finding.title}","${ticket.scope.replace(/"/g, '""')}","${ticket.finding.severity}","codescope-remediation ${ticket.finding.category}","${ticket.finding.owner}","${ticket.acceptanceCriteria.join("; ").replace(/"/g, '""')}"`
      )
    );
    downloadFile(
      `${audit?.repoName || "audit-report"}-jira-backlog.csv`,
      rows.join("\n"),
      "text/csv"
    );
  };

  const remediationPlan = audit?.remediationPlan as Array<{
    phase: string;
    days: string;
    tasks: string[];
  }> | null;

  const repoMeta = audit?.repoMeta as RepoMeta | null;
  const fileTree = audit?.fileTree as FileTreeItem[] | null;
  const scanLog = audit?.scanLog as ScanLogEntry[] | null;
  const isPaid = audit?.isPaid ?? false;

  if (auditLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <Skeleton className="h-8 w-64 mb-6" />
          <Skeleton className="h-64 mb-6" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (auditError || !audit) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">
            {auditError ? "Failed to Load Audit" : "Audit Not Found"}
          </h2>
          <p className="text-muted-foreground mb-4">
            {auditError
              ? "There was an error loading this audit. Please try again."
              : "This audit doesn't exist or has been removed."}
          </p>
          <Link href="/dashboard">
            <Button size="sm" data-testid="button-back-dashboard">
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const isScanning = audit.status === "in_progress";
  const isComplete = audit.status === "complete";

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" data-testid="link-back-dashboard">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
                  <Code2 className="w-3.5 h-3.5 text-primary-foreground" />
                </div>
                <span className="font-semibold tracking-tight">CodeAudit</span>
              </div>
            </Link>
            <span className="text-border">/</span>
            <span className="text-sm text-muted-foreground truncate">
              {audit.ownerName}/{audit.repoName}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isComplete && !isPaid && (
              <Button
                size="sm"
                onClick={() => checkoutMutation.mutate()}
                disabled={checkoutMutation.isPending}
                className="bg-amber-500 hover:bg-amber-600 text-black font-medium"
                data-testid="button-unlock-nav"
              >
                {checkoutMutation.isPending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Unlock className="w-3.5 h-3.5 mr-1" />
                    Unlock Fixes — $49
                  </>
                )}
              </Button>
            )}
            {isPaid && (
              <span
                className="flex items-center gap-1.5 text-xs text-emerald-400 px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20"
                data-testid="badge-unlocked"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Unlocked
              </span>
            )}
            <Button
              variant={isScanning ? "secondary" : "default"}
              size="sm"
              onClick={() => scanMutation.mutate()}
              disabled={isScanning || scanMutation.isPending}
              data-testid="button-run-scan"
            >
              {isScanning ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Scan className="w-3.5 h-3.5 mr-1" />
                  {audit.scannedAt ? "Re-Scan" : "Run Scan"}
                </>
              )}
            </Button>
            <a
              href={audit.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="link-repo-external"
            >
              <Button variant="outline" size="sm">
                <ExternalLink className="w-3.5 h-3.5 mr-1" />
                Repo
              </Button>
            </a>
          </div>
        </div>
      </nav>

      <div
        className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6 print:px-0"
        id="audit-report-content"
      >
        {isComplete && (
          <div
            className="rounded-md border border-border/40 bg-card/30 p-4 flex items-center justify-between gap-3 print:hidden"
            data-testid="section-report-actions"
          >
            <div>
              <h2 className="font-semibold text-sm">Audit Report</h2>
              <p className="text-xs text-muted-foreground">
                Download this report as a PDF for stakeholders.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleGeneratePdf}
              disabled={isGeneratingPdf}
              data-testid="button-generate-pdf"
            >
              <FileDown className="w-3.5 h-3.5 mr-1.5" />
              {isGeneratingPdf ? "Preparing..." : "Generate PDF"}
            </Button>
          </div>
        )}

        {isComplete && isPaid && (
          <div className="grid gap-4 md:grid-cols-2" data-testid="section-executive-summary">
            <div className="rounded-md border border-border/40 bg-card/30 p-4">
              <h2 className="font-semibold text-sm mb-2">Executive Summary (One-Page)</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {audit.executiveSummary ||
                  `This codebase shows ${findingCounts.critical} critical and ${findingCounts.high} high-risk issues requiring immediate focus. The fastest risk reduction comes from resolving configuration and auth-adjacent findings first, then tightening CI/CD controls. The roadmap below prioritizes changes that materially reduce outage and breach probability without stalling feature delivery.`}
              </p>
            </div>
            <div className="rounded-md border border-border/40 bg-card/30 p-4">
              <h2 className="font-semibold text-sm mb-2">What breaks in 90 days if unchanged</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{ninetyDayOutlook}</p>
            </div>
            {founderSingleAnswer && (
              <div
                className="rounded-md border border-primary/30 bg-primary/5 p-4 md:col-span-2"
                data-testid="section-founder-single-answer"
              >
                <h2 className="font-semibold text-sm mb-1">{founderSingleAnswer.headline}</h2>
                <p className="text-xs text-muted-foreground mb-1">
                  {founderSingleAnswer.portfolioSummary}
                </p>
                <p className="text-sm mb-3">{founderSingleAnswer.launchRecommendation}</p>
                <div className="grid md:grid-cols-2 gap-2">
                  {founderSingleAnswer.lanes.map((lane) => (
                    <div
                      key={lane.key}
                      className="rounded border border-border/30 bg-background/40 p-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="font-medium">{lane.label}</p>
                        <span
                          className={`uppercase text-[10px] ${
                            lane.status === "strong"
                              ? "text-emerald-400"
                              : lane.status === "watch"
                                ? "text-yellow-400"
                                : "text-red-400"
                          }`}
                        >
                          {lane.status.replace("_", " ")}
                        </span>
                      </div>
                      <p className="text-muted-foreground">{lane.summary}</p>
                      <p className="text-muted-foreground mt-1">Signals: {lane.signalCount}</p>
                      {lane.sampleFindingTitles.length > 0 && (
                        <p className="text-muted-foreground">
                          Examples: {lane.sampleFindingTitles.join("; ")}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {enterpriseRejector && enterpriseRejector.objections.length > 0 && (
              <div
                className="rounded-md border border-red-500/30 bg-red-500/5 p-4 md:col-span-2"
                data-testid="section-enterprise-rejector"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h2 className="font-semibold text-sm">{enterpriseRejector.headline}</h2>
                  <span className="text-[10px] uppercase tracking-wider text-red-300">
                    {enterpriseRejector.confidenceLabel}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  {enterpriseRejector.manualReviewPrompt}
                </p>
                <div className="space-y-2">
                  {enterpriseRejector.objections.map((objection) => (
                    <div
                      key={objection.title}
                      className="rounded border border-border/30 bg-background/40 p-2 text-xs"
                    >
                      <p className="font-medium text-sm">{objection.title}</p>
                      <p className="text-muted-foreground">{objection.reason}</p>
                      <p className="text-muted-foreground mt-1">
                        Signals: {objection.sampleFindingTitles.join("; ")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div
              className="rounded-md border border-border/40 bg-card/30 p-4 md:col-span-2"
              data-testid="section-launch-readiness-score"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <h2 className="font-semibold text-sm">Launch Readiness Score</h2>
                <span className="text-lg font-semibold flex items-center gap-1">
                  <Gauge className="w-4 h-4 text-primary" />
                  {launchReadinessScore(audit).score}/100
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                Composite formula: 40% security + 35% stability + 25% operability
                (maintainability/scalability/CI-CD blend).
              </p>
              <div className="grid md:grid-cols-3 gap-2 text-xs">
                <div className="border border-border/30 rounded p-2">
                  Security: {launchReadinessScore(audit).security}
                </div>
                <div className="border border-border/30 rounded p-2">
                  Stability: {launchReadinessScore(audit).stability}
                </div>
                <div className="border border-border/30 rounded p-2">
                  Operability: {launchReadinessScore(audit).operability}
                </div>
              </div>
            </div>
            <div
              className="rounded-md border border-border/40 bg-card/30 p-4 md:col-span-2"
              data-testid="section-cloud-mini-audit"
            >
              <h2 className="font-semibold text-sm mb-2">CI/CD + Cloud Posture Mini-Audit</h2>
              <p className="text-xs text-muted-foreground mb-3">
                Fast checks for launch blockers: rate limiting, CSP, session cookies, secret
                scanning, and backups.
              </p>
              <div className="grid gap-2">
                {miniAuditChecks.map((check) => (
                  <div
                    key={check.key}
                    className="border border-border/30 rounded p-2 text-xs flex items-start justify-between gap-2"
                  >
                    <div>
                      <p className="font-medium">{check.title}</p>
                      <p className="text-muted-foreground">{check.reason}</p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`uppercase text-[10px] ${check.status === "pass" ? "text-emerald-400" : check.status === "fail" ? "text-red-400" : "text-yellow-400"}`}
                      >
                        {check.status}
                      </span>
                      <p className="text-muted-foreground">{check.owner}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Pass: {miniAuditSummary.pass} • Fail: {miniAuditSummary.fail} • Unknown:{" "}
                {miniAuditSummary.unknown}
              </p>
            </div>
            <div
              className="rounded-md border border-border/40 bg-card/30 p-4 md:col-span-2"
              data-testid="section-ai-to-ticket"
            >
              <h2 className="font-semibold text-sm mb-2">AI-to-ticket remediation backlog</h2>
              <p className="text-xs text-muted-foreground mb-3">
                Generated, scoped tasks with owner suggestions and acceptance criteria for immediate
                sprint planning.
              </p>
              <div className="space-y-2">
                {ticketDrafts.slice(0, 3).map((ticket) => (
                  <div
                    key={ticket.finding.id}
                    className="border border-border/30 rounded p-2 text-xs"
                  >
                    <p className="font-medium text-sm">{ticket.finding.title}</p>
                    <p className="text-muted-foreground mb-1">{ticket.scope}</p>
                    <ul className="space-y-0.5">
                      {ticket.acceptanceCriteria.map((criterion) => (
                        <li key={criterion} className="text-foreground/80">
                          • {criterion}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-md border border-border/40 bg-card/30 p-4 md:col-span-2">
              <h2 className="font-semibold text-sm mb-2">Top 3 Existential Risks</h2>
              <div className="space-y-2">
                {topExistentialRisks.map((risk) => (
                  <div
                    key={risk.id}
                    className="text-sm flex items-center justify-between gap-2 border border-border/30 rounded p-2"
                  >
                    <span>{risk.title}</span>
                    <span className="text-xs text-muted-foreground">
                      Risk score {risk.riskScore}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-md border border-border/40 bg-card/30 p-4 md:col-span-2">
              <h2 className="font-semibold text-sm mb-2">
                Fastest fixes with highest risk reduction
              </h2>
              <div className="grid gap-2 md:grid-cols-2">
                {quickestHighReduction.map((fix) => (
                  <div key={fix.id} className="border border-border/30 rounded p-2 text-xs">
                    <p className="font-medium text-sm">{fix.title}</p>
                    <p className="text-muted-foreground">
                      {fix.effortBucket} • {fix.owner} • score {fix.riskScore}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-md border border-border/40 bg-card/30 p-4 md:col-span-2">
              <h2 className="font-semibold text-sm mb-2">Prioritized remediation by effort</h2>
              <div className="grid md:grid-cols-3 gap-3">
                {(["1 hour", "1 day", "1 week"] as const).map((bucket) => (
                  <div key={bucket} className="border border-border/30 rounded p-3">
                    <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                      {bucket}
                    </h3>
                    <ul className="space-y-1">
                      {byEffort[bucket].slice(0, 4).map((item) => (
                        <li key={item.id} className="text-xs text-foreground/80">
                          • {item.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-md border border-border/40 bg-card/30 p-4 md:col-span-2 flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportJira}
                data-testid="button-export-jira"
              >
                <Download className="w-3.5 h-3.5 mr-1" /> Export Jira CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportLinear}
                data-testid="button-export-linear"
              >
                <Download className="w-3.5 h-3.5 mr-1" /> Export Linear Markdown
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <h1 className="text-2xl font-bold" data-testid="text-audit-title">
                {audit.ownerName}/{audit.repoName}
              </h1>
              <StatusBadge status={audit.status} />
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap mb-4">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {new Date(audit.createdAt).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                {audit.contactName}
              </span>
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />
                {audit.contactEmail}
              </span>
            </div>

            {repoMeta && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap mb-3">
                <span className="flex items-center gap-1">
                  {repoMeta.isPrivate ? (
                    <Lock className="w-3 h-3" />
                  ) : (
                    <Globe className="w-3 h-3" />
                  )}
                  {repoMeta.isPrivate ? "Private" : "Public"}
                </span>
                <span className="flex items-center gap-1">
                  <Star className="w-3 h-3" />
                  {repoMeta.stars}
                </span>
                <span className="flex items-center gap-1">
                  <GitFork className="w-3 h-3" />
                  {repoMeta.forks}
                </span>
                {repoMeta.lastPush && (
                  <span className="flex items-center gap-1">
                    <Activity className="w-3 h-3" />
                    Last push: {new Date(repoMeta.lastPush).toLocaleDateString()}
                  </span>
                )}
                {Object.keys(repoMeta.languages).length > 0 && (
                  <span>{Object.keys(repoMeta.languages).slice(0, 4).join(", ")}</span>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <span className="px-2 py-0.5 rounded bg-muted/50">{audit.stack}</span>
              {audit.deploymentTarget && (
                <span className="px-2 py-0.5 rounded bg-muted/50">{audit.deploymentTarget}</span>
              )}
            </div>
          </div>

          {isComplete && audit.securityScore != null && (
            <div className="flex-shrink-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Vibe-Code Score
                </p>
                <ScoreRadar audit={audit} size={200} />
              </div>
            </div>
          )}
        </div>

        {isScanning && (
          <div
            className="rounded-md border border-blue-500/20 bg-blue-500/5 p-5"
            data-testid="section-scanning"
          >
            <div className="flex items-center gap-2 mb-3">
              <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
              <h2 className="font-semibold text-sm text-blue-400">Scan In Progress</h2>
            </div>
            <p className="text-xs text-blue-100/80 mb-3">
              Queue-backed scan limits: {SCAN_LIMITS.maxFilesToScan.toLocaleString()} files and{" "}
              {formatRepoSizeLimitMb()} repository size.
            </p>
            {scanLog && scanLog.length > 0 && (
              <div className="space-y-1">
                {scanLog.map((entry, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span
                      className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        entry.status === "ok"
                          ? "bg-emerald-500"
                          : entry.status === "warn"
                            ? "bg-yellow-500"
                            : "bg-red-500"
                      }`}
                    />
                    <span className="text-muted-foreground font-mono">{entry.step}</span>
                    <span className="text-foreground/70">{entry.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {audit.executiveSummary && (
          <div
            className="rounded-md border border-border/40 bg-card/30 p-5"
            data-testid="section-executive-summary"
          >
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              <h2 className="font-semibold text-sm">Executive Summary</h2>
            </div>
            <p className="text-sm text-foreground/80 leading-relaxed">{audit.executiveSummary}</p>
          </div>
        )}

        {isComplete && audit.securityScore != null && (
          <div
            className="rounded-md border border-border/40 bg-card/30 p-5"
            data-testid="section-scores"
          >
            <h2 className="font-semibold text-sm mb-4">Risk Assessment</h2>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
              <ScoreBar
                label="Security"
                score={audit.securityScore}
                icon={<Shield className="w-full h-full" />}
              />
              <ScoreBar
                label="Stability"
                score={audit.stabilityScore}
                icon={<Zap className="w-full h-full" />}
              />
              <ScoreBar
                label="Maintainability"
                score={audit.maintainabilityScore}
                icon={<Wrench className="w-full h-full" />}
              />
              <ScoreBar
                label="Scalability"
                score={audit.scalabilityScore}
                icon={<TrendingUp className="w-full h-full" />}
              />
              <ScoreBar
                label="CI/CD"
                score={audit.cicdScore}
                icon={<GitBranch className="w-full h-full" />}
              />
            </div>
          </div>
        )}

        {isComplete && !isPaid && findings && findings.length > 0 && (
          <div
            className="rounded-md border border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-amber-600/10 p-6"
            data-testid="section-paywall"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="w-5 h-5 text-amber-400" />
                  <h2 className="font-semibold text-lg text-amber-50">Unlock Full Remediation</h2>
                </div>
                <p className="text-sm text-amber-200/70 max-w-lg">
                  We found <strong className="text-amber-200">{findings.length} issues</strong> in
                  your codebase. Unlock this audit to get step-by-step fix instructions, code
                  evidence, and a 14-day remediation roadmap tailored to your repository.
                </p>
                <div className="flex items-center gap-4 mt-3 text-xs text-amber-300/60">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Fix steps for every finding
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Code evidence & snippets
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    14-day remediation roadmap
                  </span>
                </div>
              </div>
              <Button
                onClick={() => checkoutMutation.mutate()}
                disabled={checkoutMutation.isPending}
                className="bg-amber-500 hover:bg-amber-600 text-black font-semibold px-6 py-5 text-base flex-shrink-0"
                data-testid="button-unlock-cta"
              >
                {checkoutMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 mr-2" />
                    Unlock — $49
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {fileTree && fileTree.length > 0 && (
          <div
            className="rounded-md border border-border/40 bg-card/30"
            data-testid="section-file-tree"
          >
            <button
              onClick={() => setShowFileTree(!showFileTree)}
              className="w-full text-left p-4 flex items-center justify-between"
              data-testid="button-toggle-file-tree"
            >
              <div className="flex items-center gap-2">
                <FolderTree className="w-4 h-4 text-muted-foreground" />
                <h2 className="font-semibold text-sm">Repository Files</h2>
                <span className="text-xs text-muted-foreground">
                  ({fileTree.filter((f) => f.type === "file").length} files)
                </span>
              </div>
              {showFileTree ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
            {showFileTree && (
              <div className="border-t border-border/30 p-4 max-h-72 overflow-y-auto">
                <div className="space-y-0.5 font-mono text-xs">
                  {fileTree
                    .filter((f) => f.type === "file")
                    .sort((a, b) => a.path.localeCompare(b.path))
                    .slice(0, 200)
                    .map((file, i) => (
                      <div key={i} className="flex items-center gap-2 py-0.5 text-foreground/70">
                        <FileCode2 className="w-3 h-3 text-muted-foreground/50 flex-shrink-0" />
                        <span className="truncate">{file.path}</span>
                        {file.size && (
                          <span className="text-muted-foreground/40 ml-auto flex-shrink-0">
                            {file.size > 1024
                              ? `${(file.size / 1024).toFixed(1)}KB`
                              : `${file.size}B`}
                          </span>
                        )}
                      </div>
                    ))}
                  {fileTree.filter((f) => f.type === "file").length > 200 && (
                    <div className="text-muted-foreground pt-2">
                      ... and {fileTree.filter((f) => f.type === "file").length - 200} more files
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {findings && findings.length > 0 && (
          <div data-testid="section-findings">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-sm">Findings</h2>
                <span className="text-xs text-muted-foreground">({findings.length} total)</span>
                {!isPaid && (
                  <span className="flex items-center gap-1 text-[10px] text-amber-400 px-1.5 py-0.5 rounded bg-amber-500/10">
                    <Lock className="w-2.5 h-2.5" />
                    Fixes locked
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs flex-wrap">
                {Object.entries(findingCounts).map(([sev, count]) =>
                  count > 0 ? (
                    <button
                      key={sev}
                      data-testid={`button-filter-${sev}`}
                      onClick={() =>
                        setSeverityFilter(severityFilter === sev ? "all" : (sev as SeverityFilter))
                      }
                      className={`flex items-center gap-1 transition-opacity ${
                        severityFilter !== "all" && severityFilter !== sev ? "opacity-40" : ""
                      }`}
                    >
                      <SeverityBadge severity={sev} size="sm" />
                      <span className="text-muted-foreground ml-0.5">{count}</span>
                    </button>
                  ) : null
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 mb-4 flex-wrap">
              {(
                ["all", "security", "stability", "maintainability", "scalability", "cicd"] as const
              ).map((cat) => (
                <Button
                  key={cat}
                  variant={categoryFilter === cat ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setCategoryFilter(cat)}
                  data-testid={`button-category-${cat}`}
                  className="text-xs h-7"
                >
                  {cat === "all"
                    ? "All"
                    : cat === "cicd"
                      ? "CI/CD"
                      : cat.charAt(0).toUpperCase() + cat.slice(1)}
                </Button>
              ))}
            </div>

            <div className="space-y-2">
              {findingsLoading ? (
                [1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-md" />)
              ) : sortedFindings && sortedFindings.length > 0 ? (
                sortedFindings.map((finding, i) => (
                  <FindingCard key={finding.id} finding={finding} index={i} isPaid={isPaid} />
                ))
              ) : (
                <div className="text-center py-10 text-sm text-muted-foreground">
                  No findings match the current filters
                </div>
              )}
            </div>
          </div>
        )}

        {isPaid && remediationPlan && remediationPlan.length > 0 && (
          <div
            className="rounded-md border border-border/40 bg-card/30 p-5"
            data-testid="section-remediation"
          >
            <h2 className="font-semibold text-sm mb-5">Remediation Roadmap</h2>
            <div className="space-y-4">
              {remediationPlan.map((phase, i) => (
                <div key={i} className="flex gap-4" data-testid={`remediation-phase-${i}`}>
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        i === 0
                          ? "bg-red-500/10 text-red-400"
                          : i === 1
                            ? "bg-yellow-500/10 text-yellow-400"
                            : "bg-emerald-500/10 text-emerald-400"
                      }`}
                    >
                      {i === 0 ? (
                        <AlertTriangle className="w-3.5 h-3.5" />
                      ) : i === 1 ? (
                        <Clock className="w-3.5 h-3.5" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                    </div>
                    {i < remediationPlan.length - 1 && (
                      <div className="w-px flex-1 bg-border/40 mt-2" />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium text-sm">{phase.phase}</h3>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        {phase.days}
                      </span>
                    </div>
                    <ul className="space-y-1.5">
                      {phase.tasks.map((task, j) => (
                        <li key={j} className="flex items-start gap-2 text-xs text-foreground/70">
                          <span className="w-1 h-1 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                          {task}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isPaid && isComplete && findings && findings.length > 0 && (
          <div
            className="rounded-md border border-border/40 bg-card/30 p-5 relative overflow-hidden"
            data-testid="section-remediation-locked"
          >
            <div className="absolute inset-0 backdrop-blur-sm bg-background/60 z-10 flex flex-col items-center justify-center">
              <Lock className="w-8 h-8 text-amber-400 mb-3" />
              <h3 className="font-semibold text-sm mb-1">Remediation Roadmap Locked</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Unlock to see your 14-day fix plan
              </p>
              <Button
                onClick={() => checkoutMutation.mutate()}
                disabled={checkoutMutation.isPending}
                className="bg-amber-500 hover:bg-amber-600 text-black font-medium"
                size="sm"
                data-testid="button-unlock-roadmap"
              >
                <Unlock className="w-3.5 h-3.5 mr-1.5" />
                Unlock — $49
              </Button>
            </div>
            <h2 className="font-semibold text-sm mb-5">Remediation Roadmap</h2>
            <div className="space-y-4 opacity-30">
              {[
                { phase: "Phase 1: Critical Fixes", days: "Day 1-2" },
                { phase: "Phase 2: Stabilize", days: "Day 3-7" },
                { phase: "Phase 3: Harden", days: "Day 8-14" },
              ].map((phase, i) => (
                <div key={i} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center flex-shrink-0">
                      <div className="w-3 h-3 rounded bg-muted" />
                    </div>
                    {i < 2 && <div className="w-px flex-1 bg-border/20 mt-2" />}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-3 w-32 rounded bg-muted/50" />
                      <div className="h-2.5 w-16 rounded bg-muted/30" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="h-2.5 w-3/4 rounded bg-muted/30" />
                      <div className="h-2.5 w-1/2 rounded bg-muted/30" />
                      <div className="h-2.5 w-2/3 rounded bg-muted/30" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {scanLog && scanLog.length > 0 && isComplete && (
          <div
            className="rounded-md border border-border/40 bg-card/30"
            data-testid="section-scan-log"
          >
            <button
              onClick={() => setShowScanLog(!showScanLog)}
              className="w-full text-left p-4 flex items-center justify-between"
              data-testid="button-toggle-scan-log"
            >
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-muted-foreground" />
                <h2 className="font-semibold text-sm">Scan Log</h2>
                <span className="text-xs text-muted-foreground">({scanLog.length} steps)</span>
              </div>
              {showScanLog ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
            {showScanLog && (
              <div className="border-t border-border/30 p-4 space-y-1.5">
                {scanLog.map((entry, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span
                      className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        entry.status === "ok"
                          ? "bg-emerald-500"
                          : entry.status === "warn"
                            ? "bg-yellow-500"
                            : "bg-red-500"
                      }`}
                    />
                    <span className="text-muted-foreground font-mono w-24 flex-shrink-0">
                      {entry.step}
                    </span>
                    <span className="text-foreground/70">{entry.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {audit.biggestConcern && (
          <div
            className="rounded-md border border-border/40 bg-card/30 p-5"
            data-testid="section-concern"
          >
            <h2 className="font-semibold text-sm mb-2">Client's Biggest Concern</h2>
            <p className="text-sm text-muted-foreground italic">"{audit.biggestConcern}"</p>
          </div>
        )}

        {audit.status === "pending" && !isScanning && (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Scan className="w-7 h-7 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Ready to Scan</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Click the button below to start an automated security and quality scan of this
              repository. We'll fetch the file tree, analyze code patterns, and generate findings.
            </p>
            <Button
              onClick={() => scanMutation.mutate()}
              disabled={scanMutation.isPending}
              data-testid="button-start-scan-cta"
            >
              <Scan className="w-4 h-4 mr-1.5" />
              Start Scan
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
