import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { SCAN_LIMITS, formatRepoSizeLimitMb } from "@shared/scan-limits";
import { trackCtaClick } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import {
  Shield,
  Zap,
  TrendingUp,
  GitBranch,
  ArrowRight,
  Code2,
  AlertTriangle,
  ChevronRight,
  Scan,
  GitFork,
  Lock,
  Globe,
  CheckCircle2,
  Users,
  FileText,
  Download,
  Video,
  BookOpen,
  Rocket,
  Check,
  Sparkles,
  Gauge,
  Timer,
  ShieldCheck,
  Linkedin,
  Twitter,
  Github,
  Menu,
} from "lucide-react";

type GHRepo = {
  fullName: string;
  name: string;
  owner: string;
  url: string;
  description: string | null;
  language: string | null;
  isPrivate: boolean;
  updatedAt: string;
};

type RepoCheckPreview = {
  fullName: string;
  stars: number;
  forks: number;
  language: string | null;
  openIssues: number;
  defaultBranch: string;
  businessContext: string;
};

type MarketingComparison = { name: string; bestFor: string };
type SampleReport = { title: string; focus: string };
type AuditType = { key: string; label: string; outcome: string };

const STRIPE_PAYMENT_LINKS = {
  instantSignal: "https://buy.stripe.com/8x28wQ3N87f0bQIfYY",
  guidedReview: "https://buy.stripe.com/cNi7sM8bseDsaME4gg",
  fullAudit: "https://buy.stripe.com/9AQ3co6Zo9ng4kocMN",
  remediationSprint: "https://buy.stripe.com/4gw4gsfFYfHw8wA5kl",
} as const;

export default function Landing() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user, signIn, signUp, signOut } = useAuth();
  const [formData, setFormData] = useState({
    repoUrl: "",
    contactName: "",
    contactEmail: "",
    stack: "",
    deploymentTarget: "",
    biggestConcern: "",
  });
  const [showRepos, setShowRepos] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authForm, setAuthForm] = useState({ fullName: "", email: "", password: "" });
  const [showSampleReport, setShowSampleReport] = useState(false);
  const [previewRepoUrl, setPreviewRepoUrl] = useState("");

  const { data: repos } = useQuery<GHRepo[]>({
    queryKey: ["/api/github/repos"],
    enabled: !!user,
  });

  const { data: comparisonData } = useQuery<{ comparison: MarketingComparison[] }>({
    queryKey: ["/api/marketing/comparison"],
  });
  const { data: sampleReportsData } = useQuery<{ reports: SampleReport[] }>({
    queryKey: ["/api/marketing/sample-reports"],
  });
  const { data: auditTypeData } = useQuery<{ auditTypes: AuditType[] }>({
    queryKey: ["/api/marketing/audit-types"],
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Please sign in before creating an audit");
      const urlParts = formData.repoUrl.replace("https://github.com/", "").split("/");
      const ownerName = urlParts[0] || "unknown";
      const repoName = urlParts[1]?.replace(".git", "") || "unknown";
      const res = await apiRequest("POST", "/api/submit-audit", {
        ...formData,
        ownerName,
        repoName,
        status: "pending",
      });
      return res.json();
    },
    onSuccess: async (audit) => {
      queryClient.invalidateQueries({ queryKey: ["/api/audits"] });
      toast({ title: "Audit Created", description: "Starting scan..." });
      navigate(`/audit/${audit.auditId}`);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const repoPreviewMutation = useMutation({
    mutationFn: async (repoUrl: string) => {
      const response = await apiRequest("POST", "/api/marketing/repo-check", { repoUrl });
      return (await response.json()) as RepoCheckPreview;
    },
    onError: () => {
      toast({
        title: "Preview queued",
        description: "We’ll email your preview in 2 hours while we verify repository access.",
      });
    },
  });

  const selectRepo = (repo: GHRepo) => {
    setFormData((prev) => ({
      ...prev,
      repoUrl: repo.url,
      stack: repo.language || prev.stack,
    }));
    setShowRepos(false);
  };

  const handleGithubOAuth = () => {
    trackCtaClick("GitHub OAuth", "hero");
    window.location.href = "/api/auth/github";
  };

  const handleCtaClick = (ctaName: string, location: string, onClick?: () => void) => {
    trackCtaClick(ctaName, location);
    onClick?.();
  };

  const handlePickRepo = () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description:
          "Sign in from the dashboard first, then pick from your connected GitHub repositories.",
      });
      navigate("/dashboard");
      return;
    }

    if (!repos || repos.length === 0) {
      toast({
        title: "No repositories found",
        description: "Connect your GitHub account on the dashboard to load repositories.",
      });
      navigate("/dashboard");
      return;
    }

    setShowRepos((prev) => !prev);
  };

  const handleInstantPreview = () => {
    if (!previewRepoUrl.trim()) {
      toast({ title: "Repo URL required", description: "Paste a GitHub repo URL to run the preview." });
      return;
    }

    handleCtaClick("Try Instant Preview", "hero_preview", () => {
      repoPreviewMutation.mutate(previewRepoUrl.trim());
    });
  };

  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
  };

  const navItems: Array<{ label: string; onClick: () => void; testId: string }> = [
    {
      label: "How It Works",
      onClick: () => handleCtaClick("How It Works", "top_nav", () => scrollToSection("how-it-works")),
      testId: "link-how-it-works",
    },
    {
      label: "Pricing",
      onClick: () => handleCtaClick("Pricing", "top_nav", () => scrollToSection("pricing")),
      testId: "link-pricing",
    },
    {
      label: "Sample Report",
      onClick: () => handleCtaClick("Sample Report", "top_nav", () => scrollToSection("sample-report")),
      testId: "link-sample-report",
    },
    {
      label: "Blog",
      onClick: () =>
        handleCtaClick("Blog", "top_nav", () => {
          toast({ title: "Blog coming soon", description: "We’re publishing technical breakdowns soon." });
        }),
      testId: "link-blog",
    },
    {
      label: "Login",
      onClick: () => handleCtaClick("Login", "top_nav", () => navigate("/dashboard")),
      testId: "link-login",
    },
  ];

  const valueBlocks = [
    {
      icon: <Shield className="w-5 h-5" />,
      title: "Security",
      findings: [
        { label: "Hardcoded secrets or leaked credentials", severity: "high" },
        { label: "Auth and permission boundary gaps", severity: "high" },
        { label: "Unsafe upload and CORS defaults", severity: "medium" },
      ],
      impact: "Prevent breaches and customer trust loss",
    },
    {
      icon: <Zap className="w-5 h-5" />,
      title: "Stability",
      findings: [
        { label: "Broken dependencies and lockfile drift", severity: "high" },
        { label: "Hallucinated packages and dead imports", severity: "medium" },
        { label: "Missing validation and runtime guardrails", severity: "medium" },
      ],
      impact: "Avoid crashes during launch week",
    },
    {
      icon: <TrendingUp className="w-5 h-5" />,
      title: "Scalability",
      findings: [
        { label: "N+1 query hotspots and sync bottlenecks", severity: "high" },
        { label: "No caching on high-traffic paths", severity: "medium" },
        { label: "Missing rate limits and abuse controls", severity: "low" },
      ],
      impact: "Keep performance stable as traffic grows",
    },
    {
      icon: <GitBranch className="w-5 h-5" />,
      title: "CI/CD",
      findings: [
        { label: "No branch protections or deploy checks", severity: "high" },
        { label: "Missing security scans in pipelines", severity: "medium" },
        { label: "Weak rollback and incident readiness", severity: "low" },
      ],
      impact: "Reduce bad deploys and production incidents",
    },
  ] as const;

  const audienceList = [
    "Founders preparing for launch week and first real users",
    "Teams entering investor or enterprise diligence",
    "Startups stabilizing after a fast AI-built MVP",
    "Founders hiring their first engineer and handing off the codebase",
    "Companies inheriting code after agency or freelancer delivery",
  ];

  const notForList = [
    "Teams expecting a one-click scan to replace security ownership",
    "Companies wanting a compliance certificate without remediation work",
    "Projects that cannot share any repository access under any model",
  ];

  const whatWeCheck = [
    "Authentication, authorization, and tenant boundary failures",
    "Secret leaks, unsafe file handling, and data exposure paths",
    "Dependency and supply-chain risk in packages and build workflows",
    "CI/CD and deployment guardrails (tests, branch controls, rollback safety)",
    "Scalability and abuse paths: rate limits, queueing, and hot spots",
    "Code quality drift from AI-assisted implementation patterns",
  ];

  const deliveryArtifacts = [
    "Executive launch-risk summary (for founders and leadership)",
    "Technical findings with file-level evidence and severity",
    "Prioritized remediation plan with immediate next actions",
    "Issue list export suitable for Jira/Linear handoff",
    "Compliance-ready appendix mapped to SOC 2, NIST CSF 2.0, and EU AI Act controls",
  ];

  const methodologyLenses = [
    {
      title: "Security Lens",
      detail:
        "Identity boundaries, secrets, supply-chain risk, and abuse surfaces that can trigger incidents or customer trust loss.",
      checks: ["AuthZ/AuthN gaps", "Secret leakage", "Unsafe defaults", "Threat exposure paths"],
    },
    {
      title: "Quality Lens",
      detail:
        "Code health and delivery reliability checks that reveal hidden maintenance drag and brittle release workflows.",
      checks: ["Dependency drift", "Test confidence depth", "CI/CD controls", "Operational guardrails"],
    },
    {
      title: "Logic Lens",
      detail:
        "Business-rule correctness analysis focused on AI-generated implementation drift and high-cost edge cases.",
      checks: ["Spec-to-code drift", "Duplicated rules", "Failure-mode handling", "State/flow consistency"],
    },
  ];

  const complianceAlignments = [
    {
      standard: "SOC 2 readiness",
      value: "Maps findings to security, availability, and change-management evidence expected in buyer diligence.",
    },
    {
      standard: "NIST CSF 2.0 alignment",
      value: "Translates findings into Govern, Protect, Detect, Respond, and Recover actions for practical risk governance.",
    },
    {
      standard: "EU AI Act risk posture (2026)",
      value: "Highlights documentation, traceability, and control gaps that can slow procurement and expansion in regulated markets.",
    },
  ];

  const sampleReportSlices = [
    {
      title: "Founder Blockers",
      description: "High-confidence blockers that can delay launch, sales, or investor diligence if unresolved.",
      items: [
        "Public admin mutation route lacks authorization checks",
        "No incident rollback gate in production deployment workflow",
        "Customer data export endpoint has no abuse throttling",
      ],
      badge: "Launch-critical",
      badgeTone: "text-red-300 border-red-500/40 bg-red-500/10",
    },
    {
      title: "Technical Debt",
      description: "Non-blocking issues that compound risk and engineering cost if left unattended.",
      items: [
        "Duplicate validation logic across services causing policy drift",
        "Flaky integration tests around asynchronous checkout retries",
        "Inconsistent error models across API handlers and workers",
      ],
      badge: "Stability drag",
      badgeTone: "text-amber-300 border-amber-500/40 bg-amber-500/10",
    },
  ];

  const urgencyOffers = [
    {
      title: "Pre-launch readiness audit",
      detail: "Find launch blockers before customers, press, or partners hit your product.",
    },
    {
      title: "Post-MVP stabilization audit",
      detail: "Clean up vibe-coded shortcuts and reduce incidents before you scale.",
    },
    {
      title: "Investor / enterprise diligence audit",
      detail: "Prepare technical risk answers for fundraise, procurement, and security reviews.",
    },
  ];

  const aiFailurePatterns = [
    {
      pattern: "Hallucination Surface",
      detail: "Invented packages, APIs, and implementation assumptions that quietly fail in prod.",
    },
    {
      pattern: "Auth & Permission Fragility",
      detail: "Access checks that look present but miss key routes, roles, or tenant boundaries.",
    },
    {
      pattern: "Dependency Sprawl",
      detail: "Bloated or conflicting dependency trees that increase exploit and outage risk.",
    },
    {
      pattern: "Duplicated Business Logic",
      detail: "Same rules copied across controllers and services, causing drift and defects.",
    },
    {
      pattern: "Dead Routes & Ghost Features",
      detail: "Unreachable endpoints, abandoned flows, and UI paths no one can complete.",
    },
    {
      pattern: "Prompt-to-Production Drift",
      detail: "Code diverges from intended prompts and specs, creating hidden behavior gaps.",
    },
    {
      pattern: "Missing Operational Controls",
      detail: "No rate limits, weak observability, and absent rollback/guardrail mechanisms.",
    },
    {
      pattern: "Shallow Test Confidence",
      detail: "Tests pass happy paths only and miss auth, edge-case, and failure-mode behavior.",
    },
    {
      pattern: "Insecure Tutorial Defaults",
      detail: "Copied starter patterns leave weak CORS, secret handling, and unsafe file flows.",
    },
    {
      pattern: "Pseudo-Architecture",
      detail: "Looks modular in diagrams but breaks under real load, concurrency, or retries.",
    },
  ];

  const internalArtifacts = [
    {
      title: "CTO Summary Memo",
      detail: "Executive technical risk brief for leadership alignment and fast prioritization.",
    },
    {
      title: "Founder One-Pager",
      detail:
        "Business-language snapshot of launch blockers, confidence level, and next decisions.",
    },
    {
      title: "Jira / Linear Issue Export",
      detail:
        "Ready-to-import ticket payloads with severity, owner suggestion, and acceptance criteria.",
    },
    {
      title: '"Send This to Your Dev" Handoff Brief',
      detail: "Copy-ready implementation brief so non-technical stakeholders can delegate clearly.",
    },
    {
      title: "Enterprise Security Questionnaire Helper",
      detail:
        "Mapped responses and evidence pointers to accelerate security reviews and procurement.",
    },
    {
      title: "Pre-sales Technical Trust Report",
      detail:
        "Customer-facing trust artifact to support technical objections and close deals faster.",
    },
  ];

  const poweredByTools = ["Semgrep", "Gitleaks", "ESLint"];

  const testimonials = [
    {
      quote:
        "Found 7 launch blockers in 45 minutes — saved us from a bad launch.",
      name: "Beta Founder A",
      role: "Founder, AI fintech startup",
    },
    {
      quote:
        "The prioritized fix plan turned a chaotic codebase into a clear two-week execution sprint.",
      name: "Beta Founder B",
      role: "CEO, AI healthcare startup",
    },
    {
      quote:
        "We caught auth and secrets issues before customer rollout, and our team fixed them the same week.",
      name: "Beta Engineering Lead",
      role: "CTO, AI workflow startup",
    },
  ];

  const featuredIn = [
    "YC Startup School",
    "Founder Slack Security Circle",
    "Build in Public Weekly",
  ];

  const competitorComparison = comparisonData?.comparison ?? [
    {
      name: "Semgrep",
      bestFor: "Continuous security scanning in engineering-heavy organizations.",
    },
    {
      name: "Snyk",
      bestFor: "Broad security platform across code, open source, containers, and IaC.",
    },
    { name: "SonarQube Cloud", bestFor: "Ongoing quality gates and code verification in CI." },
    { name: "CodeRabbit", bestFor: "PR-time AI review workflows and inline feedback." },
  ];
  const sampleReports = sampleReportsData?.reports ?? [];
  const auditTypes = auditTypeData?.auditTypes ?? [];

  const pricingTiers = [
    {
      name: "Basic Triage",
      price: "$99",
      desc: "Low-friction entry point with expert-prioritized risk signal before a full audit",
      features: [
        "Automated scan snapshot in hours, not days",
        "One-file free security scan available before purchase",
        "Top launch blockers preview (counts + category)",
        "Clear upgrade trigger: unlock exact file-level remediation plan",
        "Best entry point before investing in expert review",
        'Example output: "4 launch blockers, 11 medium-risk issues, weak auth boundaries"',
      ],
      cta: "Start $99 Basic Triage",
      popular: false,
      paymentLink: STRIPE_PAYMENT_LINKS.instantSignal,
    },
    {
      name: "Guided Review",
      price: "$499",
      desc: "Expert-guided review that turns signal into a concrete fix sequence",
      features: [
        "45–60 minute expert review session",
        "Top launch blockers mapped to business and engineering impact",
        "Short walkthrough call + prioritized what-to-do-first plan",
        "Fast summary delivered within 24 hours",
        "Best for teams deciding whether to escalate to full audit",
      ],
      cta: "Book $499 Review",
      popular: true,
      paymentLink: STRIPE_PAYMENT_LINKS.guidedReview,
    },
    {
      name: "Full Audit",
      price: "$1,500",
      desc: "Comprehensive report and remediation roadmap for launch confidence",
      features: [
        "Human-led codebase security + architecture review",
        "Launch blocker map + business impact analysis",
        "Detailed finding evidence and fix recommendations",
        "14-day prioritized remediation roadmap",
        "Buyer/investor-ready technical risk memo",
      ],
      cta: "Book $1,500 Audit",
      popular: false,
      paymentLink: STRIPE_PAYMENT_LINKS.fullAudit,
    },
    {
      name: "Remediation Sprint",
      price: "$3,000–$5,000",
      desc: "Hands-on implementation sprint where we ship fixes for your highest-risk issues",
      features: [
        "Everything in Full Audit",
        "Implementation of highest-priority fixes",
        "Production-ready pull requests with rationale",
        "Before/after engineering maturity scorecard",
        "Ideal when your team needs execution, not just advice",
      ],
      cta: "Start Remediation Sprint",
      popular: false,
      paymentLink: STRIPE_PAYMENT_LINKS.remediationSprint,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
              <Code2 className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg tracking-tight" data-testid="text-logo">
              CodeAudit
            </span>
          </div>
          <NavigationMenu className="hidden sm:flex">
            <NavigationMenuList>
              {navItems.map((item) => (
                <NavigationMenuItem key={item.label}>
                  <NavigationMenuLink
                    className={cn(navigationMenuTriggerStyle(), "cursor-pointer")}
                    onClick={item.onClick}
                    data-testid={item.testId}
                  >
                    {item.label}
                  </NavigationMenuLink>
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>

          <Sheet>
            <SheetTrigger asChild className="sm:hidden">
              <Button size="icon" variant="ghost" aria-label="Open navigation menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px]">
              <div className="pt-8 flex flex-col gap-2">
                {navItems.map((item) => (
                  <Button
                    key={item.label}
                    variant="ghost"
                    className="justify-start"
                    onClick={item.onClick}
                    data-testid={`mobile-${item.testId}`}
                  >
                    {item.label}
                  </Button>
                ))}
                {user && (
                  <Button
                    variant="ghost"
                    className="justify-start"
                    onClick={() => handleCtaClick("Sign out", "top_nav_mobile", () => signOut())}
                    data-testid="mobile-button-signout"
                  >
                    Sign out
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>

      {user && (
        <section className="pt-24 pb-4 px-4 sm:px-6">
          <div className="max-w-6xl mx-auto text-sm text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{user.email}</span>
          </div>
        </section>
      )}
      <section className="relative overflow-hidden pt-24 pb-20 px-4 sm:px-6">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.2),_transparent_45%),radial-gradient(circle_at_80%_20%,_rgba(59,130,246,0.15),_transparent_40%)]" />
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, rgba(148,163,184,0.06) 0px, rgba(148,163,184,0.06) 1px, transparent 1px, transparent 34px)",
            }}
          />
        </div>

        <div className="relative max-w-4xl xl:max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 mb-4">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs text-emerald-300">
              48h SLA: Your first decision-ready risk plan in 2 business days.
            </span>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 mb-4">
            <Timer className="w-3.5 h-3.5 text-amber-300" />
            <span className="text-xs text-amber-200">
              Only 8 audit slots left this month · Next available: March 18
            </span>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/50 px-3 py-1 mb-6">
            <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />
            <span className="text-xs text-muted-foreground">
              Built with AI? Vibe-coded? Your code has hidden risks.
            </span>
          </div>

          <h1
            className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6"
            data-testid="text-hero-title"
          >
            Get clarity on
            <br />
            <span className="bg-gradient-to-r from-primary via-blue-400 to-cyan-400 bg-clip-text text-transparent">
              what matters first
            </span>
          </h1>

          <p
            className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6 leading-relaxed"
            data-testid="text-hero-subtitle"
          >
            Audits packaged around moments of urgency, not generic checklists. Translate code risk
            into launch risk, revenue risk, and operational risk.
          </p>

          <p className="text-sm text-muted-foreground/70 mb-2">
            Don’t buy a list of issues. Buy clarity on what to do next.
          </p>

          <p className="text-sm text-amber-300 mb-8" data-testid="text-hero-offer-line">
            First 10 customers: $99 Basic Triage (normally $499) • Delivered in &lt;24h
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-7">
            <Button size="lg" asChild data-testid="button-start-audit">
              <a
                href={STRIPE_PAYMENT_LINKS.instantSignal}
                target="_blank"
                rel="noreferrer"
                onClick={() => handleCtaClick("Start $99 Basic Triage", "hero")}
              >
                Start $99 Basic Triage
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </a>
            </Button>
            <Button variant="outline" size="lg" asChild data-testid="button-guided-review">
              <a
                href={STRIPE_PAYMENT_LINKS.guidedReview}
                target="_blank"
                rel="noreferrer"
                onClick={() => handleCtaClick("Book $499 Review", "hero")}
              >
                Book $499 Review
                <ChevronRight className="w-4 h-4 ml-1" />
              </a>
            </Button>
          </div>

          <p className="text-xs text-muted-foreground mb-6" data-testid="text-hero-trust-line">
            Trusted by 12 AI startups • 48-hour SLA • 100% money-back on Triage if we find nothing
          </p>

          <div className="mx-auto mb-10 max-w-3xl rounded-md border border-border/40 bg-card/30 px-4 py-3">
            <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
              <p>
                Average audit finds{" "}
                <span className="font-semibold text-foreground">17 critical risks</span>
              </p>
              <p>
                <span className="font-semibold text-foreground">86% of AI codebases</span> have
                hidden secrets
              </p>
            </div>
          </div>

          <div className="mx-auto mb-12 max-w-2xl rounded-md border border-cyan-500/30 bg-slate-950/60 p-4 text-left shadow-[0_0_40px_rgba(14,116,144,0.2)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-300/80">Try Instant Preview</p>
              <Sparkles className="h-4 w-4 text-cyan-300/80" />
            </div>

            <div className="mb-3 flex flex-col gap-2 sm:flex-row">
              <Input
                value={previewRepoUrl}
                onChange={(event) => setPreviewRepoUrl(event.target.value)}
                placeholder="https://github.com/your-org/your-repo"
                className="border-cyan-400/30 bg-slate-950/70 text-cyan-100 placeholder:text-cyan-100/40"
                data-testid="input-instant-preview-repo"
              />
              <Button
                type="button"
                onClick={handleInstantPreview}
                disabled={repoPreviewMutation.isPending}
                className="sm:w-auto"
                data-testid="button-instant-preview-submit"
              >
                {repoPreviewMutation.isPending ? "Checking..." : "Run Preview"}
              </Button>
            </div>

            {repoPreviewMutation.data ? (
              <div className="space-y-1.5 font-mono text-xs text-cyan-100/80" data-testid="instant-preview-result">
                <p>$ scan {repoPreviewMutation.data.fullName}</p>
                <p className="text-cyan-200">
                  ✓ {repoPreviewMutation.data.language || "Mixed"} codebase • {repoPreviewMutation.data.defaultBranch} branch
                </p>
                <p className="text-cyan-200">
                  ✓ {repoPreviewMutation.data.stars.toLocaleString()} stars • {repoPreviewMutation.data.forks.toLocaleString()} forks
                </p>
                <p className="text-amber-200">! {repoPreviewMutation.data.businessContext}</p>
              </div>
            ) : (
              <div className="space-y-1.5 font-mono text-xs text-cyan-100/80" data-testid="instant-preview-placeholder">
                <p>$ upload repo github.com/acme/ai-assistant</p>
                <p className="text-cyan-200">✓ Secret scan initialized</p>
                <p className="text-cyan-200">✓ Dependency risk graph generated</p>
                <p className="text-amber-200">! We’ll email you the preview in 2 hours if live fetch is unavailable</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground/60 flex-wrap">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500/60" />
              Secrets & auth vulnerabilities
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500/60" />
              Broken dependencies
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500/60" />
              Scalability bottlenecks
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500/60" />
              Missing CI/CD
            </span>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="pb-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3" data-testid="text-value-title">
              What CodeAudit Decides For You
            </h2>
            <p className="text-muted-foreground text-sm max-w-lg mx-auto">
              AI-built products fail in familiar ways. We highlight the issues most likely to block
              launch.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {valueBlocks.map((f, i) => (
              <div
                key={i}
                data-testid={`card-feature-${i}`}
                className="group relative rounded-md border border-border/40 bg-card/30 p-5 hover-elevate"
              >
                <div className="mb-4 flex items-center gap-2">
                  <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center text-primary">
                    {f.icon}
                  </div>
                  <h3 className="font-semibold text-base">{f.title}</h3>
                </div>

                <ul className="space-y-2.5 mb-4">
                  {f.findings.map((finding) => (
                    <li key={finding.label} className="flex items-start gap-2 text-xs">
                      <span
                        className={`mt-1.5 h-2 w-2 rounded-full ${
                          finding.severity === "high"
                            ? "bg-red-500"
                            : finding.severity === "medium"
                              ? "bg-orange-400"
                              : "bg-emerald-400"
                        }`}
                      />
                      <span className="text-muted-foreground">{finding.label}</span>
                    </li>
                  ))}
                </ul>

                <p className="text-[11px] text-primary/70 font-medium">{f.impact}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-md border border-border/40 bg-card/20 p-6 sm:p-8">
            <div className="text-center mb-8">
              <p
                className="text-xs uppercase tracking-wider text-primary/80 mb-2"
                data-testid="text-framework-kicker"
              >
                CodeAudit SignalLens™
              </p>
              <h2
                className="text-2xl sm:text-3xl font-bold mb-3"
                data-testid="text-framework-title"
              >
                Our proprietary AI-built repo failure framework
              </h2>
              <p
                className="text-sm text-muted-foreground max-w-2xl mx-auto"
                data-testid="text-framework-subtitle"
              >
                SignalLens turns recurring AI-build failure patterns into a prioritized remediation
                plan.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {aiFailurePatterns.map((item) => (
                <div
                  key={item.pattern}
                  className="rounded-md border border-border/40 bg-background/60 p-4"
                >
                  <p className="text-sm font-semibold mb-1">{item.pattern}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="pb-16 px-4 sm:px-6" data-testid="section-methodology">
        <div className="max-w-6xl mx-auto rounded-md border border-primary/20 bg-primary/5 p-6 sm:p-8">
          <div className="text-center mb-8">
            <p className="text-xs uppercase tracking-wider text-primary/80 mb-2">Methodology</p>
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">
              Multi-Layer Analysis: Security + Quality + Logic
            </h2>
            <p className="text-sm text-muted-foreground max-w-3xl mx-auto">
              Our SignalLens workflow combines three explicit lenses so audits catch technical risks
              and business-impact blockers that generic scanners often miss.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {methodologyLenses.map((lens) => (
              <div key={lens.title} className="rounded-md border border-border/40 bg-background/70 p-4">
                <p className="text-sm font-semibold mb-1">{lens.title}</p>
                <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{lens.detail}</p>
                <ul className="space-y-1.5 text-xs text-foreground/80">
                  {lens.checks.map((check) => (
                    <li key={check} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <span>{check}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="pb-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3" data-testid="text-how-title">
              How It Works
            </h2>
            <p className="text-muted-foreground text-sm">
              From findings to clear action in 3 steps
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                step: "1",
                title: "Instant Scan",
                desc: "Upload your repo URL and instantly receive repo metadata, file tree visibility, heuristic checks, and an early risk signal.",
                icon: <Zap className="w-5 h-5" />,
              },
              {
                step: "2",
                title: "Expert Review",
                desc: "We map technical findings to launch blockers, compliance gaps, and business risk with clear severity and ownership.",
                icon: <Users className="w-5 h-5" />,
              },
              {
                step: "3",
                title: "Ship Fixes",
                desc: "Get a prioritized sprint plan plus implementation-ready recommendations so your team can ship the highest-impact fixes fast.",
                icon: <Rocket className="w-5 h-5" />,
              },
            ].map((item, i) => (
              <div key={i} className="relative" data-testid={`step-${i}`}>
                <div className="rounded-md border border-border/40 bg-card/30 p-5 h-full text-center hover-elevate">
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
                    {item.icon}
                  </div>
                  <div className="text-xs text-muted-foreground/60 uppercase tracking-wider mb-1.5">
                    Step {item.step}
                  </div>
                  <h3 className="font-semibold text-sm mb-2">{item.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
                {i < 2 && (
                  <ArrowRight className="hidden md:block w-4 h-4 text-muted-foreground/40 absolute -right-2.5 top-1/2 -translate-y-1/2" />
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-md border border-border/40 bg-card/20 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-primary/80 mb-1">
                  Quick Walkthrough
                </p>
                <h3 className="text-sm sm:text-base font-semibold">
                  12-second demo: submit your GitHub repo and get an instant risk snapshot
                </h3>
              </div>
              <Video className="w-4 h-4 text-primary mt-0.5" />
            </div>
            <img
              src="https://media.giphy.com/media/ZVik7pBtu9dNS/giphy.gif"
              alt="Animated demo of uploading a repository and getting the instant CodeAudit preview"
              className="w-full max-h-64 object-cover rounded-md border border-border/40"
              loading="lazy"
              data-testid="img-how-it-works-demo"
            />
          </div>

          <div className="mt-5 rounded-md border border-border/40 bg-background/40 px-4 py-3 text-xs text-muted-foreground">
            Scan limits: up to{" "}
            <span className="font-medium text-foreground">
              {SCAN_LIMITS.maxFilesToScan.toLocaleString()} files
            </span>{" "}
            and <span className="font-medium text-foreground">{formatRepoSizeLimitMb()}</span>{" "}
            repository size per scan.
          </div>

          <div className="flex justify-center mt-8">
            <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground/40">
              <span className="px-3 py-1 rounded border border-border/30">Submit</span>
              <ArrowRight className="w-4 h-4" />
              <span className="px-3 py-1 rounded border border-border/30">We Audit</span>
              <ArrowRight className="w-4 h-4" />
              <span className="px-3 py-1 rounded border border-border/30">Get Decision Plan</span>
            </div>
          </div>
        </div>
      </section>

      <section className="pb-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-md border border-border/40 bg-card/20 p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div>
                <h2 className="text-xl font-bold mb-3" data-testid="text-audience-title">
                  Perfect For
                </h2>
                <ul className="space-y-2.5">
                  {audienceList.map((item, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-2.5 text-sm text-foreground/80"
                      data-testid={`audience-item-${i}`}
                    >
                      <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                  As seen in
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {featuredIn.map((source, i) => (
                    <span
                      key={source}
                      className="px-3 py-1.5 rounded-md border border-border/40 bg-background/50 text-xs text-muted-foreground font-medium"
                      data-testid={`featured-source-${i}`}
                    >
                      {source}
                    </span>
                  ))}
                </div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                  Powered By
                </h3>
                <div className="flex flex-wrap gap-2">
                  {poweredByTools.map((tool, i) => (
                    <span
                      key={tool}
                      className="px-3 py-1.5 rounded-md border border-border/40 bg-background/50 text-xs text-muted-foreground font-medium"
                      data-testid={`powered-by-tool-${i}`}
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pb-16 px-4 sm:px-6" data-testid="section-testimonials">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <p className="text-xs uppercase tracking-wider text-primary/80 mb-2">Social proof</p>
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">
              Trusted by early-stage teams shipping fast
            </h2>
            <p className="text-sm text-muted-foreground">
              Feedback from founders and product teams using CodeAudit during launch prep.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {testimonials.map((item, i) => (
              <div
                key={item.name}
                className="rounded-md border border-border/40 bg-card/20 p-5"
                data-testid={`testimonial-${i}`}
              >
                <p className="text-sm text-foreground/90 leading-relaxed mb-4">“{item.quote}”</p>
                <div>
                  <p className="text-sm font-semibold">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-14 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div
            className="rounded-md border border-border/40 bg-card/20 p-5"
            data-testid="card-what-we-check"
          >
            <h3 className="text-base font-semibold mb-2">What we check</h3>
            <ul className="space-y-2 text-xs text-muted-foreground">
              {whatWeCheck.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div
            className="rounded-md border border-border/40 bg-card/20 p-5"
            data-testid="card-deliverables"
          >
            <h3 className="text-base font-semibold mb-2">Exact deliverables</h3>
            <ul className="space-y-2 text-xs text-muted-foreground">
              {deliveryArtifacts.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="pb-16 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-md border border-border/40 bg-card/20 p-6">
            <h3 className="text-lg font-semibold mb-2" data-testid="text-preview-title">
              Instant scan vs expert audit
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Start with low-friction signal, then move to expert-led remediation when the risk is
              real.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <div
                className="rounded border border-border/40 bg-background/50 p-3"
                data-testid="instant-scan-breakdown"
              >
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  Free 1-file scan + $99 Basic Triage
                </p>
                <p className="text-xs text-foreground/80 mb-2">
                  Automated urgency signal with issue counts and risk themes for fast first validation.
                </p>
                <p className="text-[11px] text-muted-foreground">Turnaround: typically same day.</p>
              </div>
              <div
                className="rounded border border-border/40 bg-background/50 p-3"
                data-testid="expert-audit-breakdown"
              >
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  $499+ Expert Audit
                </p>
                <p className="text-xs text-foreground/80 mb-2">
                  Human review with exact evidence, sequencing, and fix plan.
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Turnaround: 24–48h for guided review, deeper for full audit.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {[
                "Repository metadata snapshot",
                "File tree + hot spots overview",
                "10 heuristic checks across common failure modes",
                "Sample findings mapped to next best decision",
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="rounded border border-border/40 bg-background/50 p-3"
                  data-testid={`preview-item-${idx}`}
                >
                  <div className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5" />
                    <span>{item}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="pb-14 px-4 sm:px-6" data-testid="section-risk-cost">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4">
          <div className="rounded-md border border-red-500/30 bg-red-500/5 p-5">
            <p className="text-xs uppercase tracking-wider text-red-300 mb-2">
              ROI calculator: risk cost framing
            </p>
            <h3 className="text-lg font-semibold mb-2">The Cost of a Hallucinated Dependency</h3>
            <p className="text-sm text-muted-foreground mb-4">
              One malicious AI-suggested package can become a six-figure incident. If a compromised dependency
              exfiltrates credentials, triggers downtime, or leaks customer data, the total impact can exceed
              $100,000 before legal, remediation, and reputational damage are fully counted.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {[
                "Incident response + engineering fire drill: $20k–$40k",
                "Customer notifications, legal review, and reporting: $15k–$30k",
                "Revenue impact from downtime and churn: $30k–$60k",
                "Trust and procurement delays after breach disclosure: hard to quantify",
              ].map((item) => (
                <div key={item} className="rounded border border-red-400/20 bg-background/60 p-3">
                  {item}
                </div>
              ))}
            </div>
            <p className="text-sm mt-4">
              Compared to a <span className="font-semibold">$499–$3,000 audit</span>, proactive review is usually
              the cheaper decision.
            </p>
          </div>

          <div className="rounded-md border border-primary/30 bg-primary/5 p-5">
            <p className="text-xs uppercase tracking-wider text-primary/80 mb-2">Human verification guarantee</p>
            <h3 className="text-base font-semibold mb-2">Not just another scanner output</h3>
            <p className="text-sm text-muted-foreground mb-3">
              <span className="font-semibold text-foreground">
                Every audit is verified by a Senior Engineer, not just another AI.
              </span>{" "}
              You get expert judgment on exploitability, business impact, and what to fix first.
            </p>
            <div className="rounded border border-border/40 bg-background/60 p-3 text-xs text-muted-foreground">
              Automated tooling powers speed; expert signature provides confidence for founder, CTO, and buyer conversations.
            </div>
            <Button
              className="w-full mt-4"
              variant="outline"
              onClick={() => handleCtaClick("Try Free 1-File Scan", "risk_cost", handleInstantPreview)}
              data-testid="button-free-one-file-scan"
            >
              Try Free 1-File Scan
            </Button>
          </div>
        </div>
      </section>

      <section id="pricing" className="pb-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3" data-testid="text-pricing-title">
              Choose Your Decision Path
            </h2>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Productized offers designed to turn technical risk into an executable plan.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-6">
            {pricingTiers.map((tier, i) => (
              <div
                key={i}
                data-testid={`pricing-tier-${tier.name.toLowerCase()}`}
                className={`relative rounded-md border p-5 flex flex-col ${
                  tier.popular
                    ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                    : "border-border/40 bg-card/30"
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-2.5 left-4 inline-flex items-center rounded-full border border-primary/40 bg-primary px-2.5 py-1 text-[10px] uppercase tracking-wider text-primary-foreground font-semibold shadow-sm">
                    Most Popular
                  </div>
                )}
                <h3 className="text-base font-bold mb-1 mt-2">{tier.name}</h3>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-2xl font-bold">{tier.price}</span>
                  <span className="text-xs text-muted-foreground">/ audit</span>
                </div>
                <p className="text-xs text-muted-foreground mb-5 flex-1">{tier.desc}</p>
                <Button
                  variant={tier.popular ? "default" : "outline"}
                  className="w-full"
                  asChild
                  data-testid={`button-pricing-${tier.name.toLowerCase()}`}
                >
                  <a
                    href={tier.paymentLink}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => handleCtaClick(tier.cta, "pricing")}
                  >
                    {tier.cta}
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </a>
                </Button>
              </div>
            ))}
          </div>

          <div
            className="rounded-md border border-border/40 bg-card/20 overflow-x-auto"
            data-testid="pricing-comparison-table"
          >
            <table className="w-full min-w-[680px] text-xs">
              <thead>
                <tr className="border-b border-border/40 bg-background/40">
                  <th className="text-left px-4 py-3 font-semibold">Included</th>
                  {pricingTiers.map((tier) => (
                    <th key={tier.name} className="text-center px-3 py-3 font-semibold">
                      {tier.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    label: "Automated instant scan preview",
                    includes: [true, true, true, true],
                  },
                  {
                    label: "Expert review session",
                    includes: [false, true, true, true],
                  },
                  {
                    label: "Detailed evidence + fix recommendations",
                    includes: [false, true, true, true],
                  },
                  {
                    label: "14-day prioritized roadmap",
                    includes: [false, true, true, true],
                  },
                  {
                    label: "Buyer/investor-ready technical risk memo",
                    includes: [false, false, true, true],
                  },
                  {
                    label: "Implementation pull requests",
                    includes: [false, false, false, true],
                  },
                ].map((row) => (
                  <tr key={row.label} className="border-b border-border/30 last:border-b-0">
                    <td className="px-4 py-3 text-foreground/90">{row.label}</td>
                    {row.includes.map((enabled, idx) => (
                      <td key={`${row.label}-${idx}`} className="px-3 py-3 text-center">
                        {enabled ? (
                          <Check className="w-4 h-4 text-emerald-500 mx-auto" />
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p
            className="text-center text-xs text-muted-foreground mt-4"
            data-testid="text-pricing-note"
          >
            14-day money-back on all plans.
          </p>

          <div
            className="mt-8 rounded-md border border-border/40 bg-card/20 p-5"
            data-testid="pricing-faq"
          >
            <h3 className="text-sm font-semibold mb-3">Pricing FAQ</h3>
            <div className="space-y-3 text-xs">
              <div>
                <p className="font-medium">Can I cancel?</p>
                <p className="text-muted-foreground mt-1">
                  Yes. You can cancel anytime before work begins for a full cancellation. If work
                  has started, we scope any partial refund based on completed milestones.
                </p>
              </div>
              <div>
                <p className="font-medium">What file size limits apply?</p>
                <p className="text-muted-foreground mt-1">
                  Scans currently support up to {SCAN_LIMITS.maxFilesToScan.toLocaleString()} files
                  and {formatRepoSizeLimitMb()} repository size per submission.
                </p>
              </div>
              <div>
                <p className="font-medium">What is your refund policy?</p>
                <p className="text-muted-foreground mt-1">
                  If we cannot deliver the agreed audit artifact, you receive a full refund. For
                  completed deliverables, refunds are reviewed case-by-case within 14 days.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="sample-report" className="pb-12 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto space-y-4">
          <div
            className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-4"
            data-testid="sample-report-callout"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-sm">See a sample decision memo instantly</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Preview a launch blocker map, top risks, and a prioritized remediation sprint plan
                  before connecting your repo.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  handleCtaClick("View Sample", "sample_report", () =>
                    setShowSampleReport((prev) => !prev)
                  )
                }
                data-testid="button-view-sample-report"
                aria-expanded={showSampleReport}
              >
                {showSampleReport ? "Hide Sample" : "View Sample"}
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                className="text-xs"
                asChild
                data-testid="button-download-sample-report"
              >
                <a href="/sample-audit-report.pdf" download>
                  <Download className="w-3.5 h-3.5 mr-1" />
                  Download Sample Audit PDF
                </a>
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Includes severity rubric, evidence format, and remediation sequencing used in paid audits.
              </p>
            </div>
          </div>
          <div
            className={`grid transition-all duration-300 ease-out ${showSampleReport ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
            data-testid="sample-report-preview"
          >
            <div className="overflow-hidden">
              <div className="rounded-xl border border-border/50 bg-card/40 p-4 sm:p-6 shadow-lg shadow-primary/5">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Live Demo Snapshot</p>
                    <h4 className="text-base sm:text-lg font-semibold">
                      SaaS Launch Risk Decision Brief
                    </h4>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
                    <Sparkles className="w-3.5 h-3.5" />
                    Decision-ready output
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="text-xs"
                    onClick={() =>
                      handleCtaClick("View Full Sample Report PDF", "sample_report_preview", () =>
                        window.open("/sample-audit-report.pdf", "_blank", "noopener,noreferrer")
                      )
                    }
                    data-testid="button-view-full-sample-report"
                  >
                    <FileText className="w-3.5 h-3.5 mr-1" />
                    View Full Sample Report (PDF)
                  </Button>
                </div>

                <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4">
                  <div className="rounded-lg border border-border/40 bg-background/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                      Risk Heatmap
                    </p>
                    <div className="space-y-3">
                      {[
                        { label: "Authentication", score: 86, tone: "bg-red-500" },
                        { label: "CI/CD Integrity", score: 71, tone: "bg-amber-500" },
                        { label: "API Abuse Protection", score: 63, tone: "bg-yellow-500" },
                        { label: "Data Exposure", score: 29, tone: "bg-emerald-500" },
                      ].map((item) => (
                        <div key={item.label}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span>{item.label}</span>
                            <span className="font-medium">{item.score}/100</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                            <div
                              className={`h-full ${item.tone}`}
                              style={{ width: `${item.score}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-lg border border-border/40 bg-background/70 p-3 text-xs">
                      <p className="font-semibold mb-2">Top Findings This Week</p>
                      <ul className="space-y-2 text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <ShieldCheck className="w-3.5 h-3.5 text-red-400 mt-0.5" /> Unprotected
                          admin mutation endpoint.
                        </li>
                        <li className="flex items-start gap-2">
                          <Gauge className="w-3.5 h-3.5 text-amber-400 mt-0.5" /> No API rate
                          limiting on public routes.
                        </li>
                        <li className="flex items-start gap-2">
                          <Timer className="w-3.5 h-3.5 text-cyan-400 mt-0.5" /> Missing rollout
                          checks in CI workflow.
                        </li>
                      </ul>
                    </div>
                    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
                      <p className="font-semibold mb-1">Remediation sprint plan</p>
                      <p className="text-muted-foreground">
                        Day 1 patch auth + rate limits. Day 2 add CI policy gates. Day 3 verify with
                        regression + security smoke checks.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {sampleReportSlices.map((slice) => (
                    <div key={slice.title} className="rounded-lg border border-border/40 bg-background/60 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">{slice.title}</p>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${slice.badgeTone}`}
                        >
                          {slice.badge}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{slice.description}</p>
                      <ul className="space-y-1.5 text-xs text-foreground/90">
                        {slice.items.map((item) => (
                          <li key={item} className="flex items-start gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pb-12 px-4 sm:px-6" data-testid="section-compliance-alignment">
        <div className="max-w-6xl mx-auto rounded-md border border-border/40 bg-card/20 p-5 sm:p-6">
          <div className="mb-4">
            <p className="text-xs uppercase tracking-wider text-primary/80 mb-2">Compliance alignment</p>
            <h3 className="text-lg font-semibold mb-1">
              Audit output designed for security questionnaires and 2026 AI regulation pressure
            </h3>
            <p className="text-xs text-muted-foreground">
              We do not issue compliance certifications. We provide evidence-ready findings and control mappings that accelerate SOC 2, NIST, and EU AI Act readiness workstreams.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {complianceAlignments.map((item) => (
              <div key={item.standard} className="rounded border border-border/40 bg-background/50 p-3">
                <p className="text-xs font-semibold mb-1">{item.standard}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-12 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            className="rounded-md border border-border/40 bg-card/20 p-4"
            data-testid="who-its-for"
          >
            <h3 className="text-sm font-semibold mb-2">Who this is for</h3>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              {audienceList.slice(0, 4).map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
          <div
            className="rounded-md border border-border/40 bg-card/20 p-4"
            data-testid="who-its-not-for"
          >
            <h3 className="text-sm font-semibold mb-2">Who this is not for</h3>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              {notForList.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="pb-14 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <h3
            className="text-lg font-semibold text-center mb-2"
            data-testid="text-urgency-offers-title"
          >
            Start with the fastest urgent offers
          </h3>
          <p className="text-center text-xs text-muted-foreground mb-5">
            Urgency beats curiosity. Sell a painful moment and a clear readiness outcome.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
            {urgencyOffers.map((offer) => (
              <div key={offer.title} className="rounded-md border border-border/40 bg-card/20 p-4">
                <p className="text-sm font-medium mb-1">{offer.title}</p>
                <p className="text-xs text-muted-foreground">{offer.detail}</p>
              </div>
            ))}
          </div>

          <h3 className="text-lg font-semibold text-center mb-2" data-testid="text-offer-modes">
            Dual-mode output for founders and engineers
          </h3>
          <p className="text-center text-xs text-muted-foreground mb-5">
            Sell clarity to the founder, and execution detail to the engineering team.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              className="rounded-md border border-border/40 bg-card/20 p-4"
              data-testid="card-prelaunch-audit"
            >
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Founder Mode
              </p>
              <p className="text-sm text-foreground/90 mb-3">
                Business-first decisions for non-expert startup buyers.
              </p>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li>• Can we safely launch now?</li>
                <li>• What could break customer trust?</li>
                <li>• What would scare investors, acquirers, or enterprise buyers?</li>
                <li>• What is the minimum fix set before onboarding real customers?</li>
              </ul>
            </div>
            <div
              className="rounded-md border border-border/40 bg-card/20 p-4"
              data-testid="card-postincident-audit"
            >
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Engineering Mode
              </p>
              <p className="text-sm text-foreground/90 mb-3">
                Delivery-ready implementation detail for technical teams.
              </p>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li>• Exact files and reproducible evidence</li>
                <li>• Severity, fix steps, and acceptance criteria</li>
                <li>• Likely owner and estimated effort</li>
                <li>• Prioritized sequencing for remediation sprints</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="pb-16 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-6">
            <h3 className="text-lg font-semibold mb-2" data-testid="text-artifacts-title">
              Artifacts your team can use immediately
            </h3>
            <p className="text-xs text-muted-foreground max-w-2xl mx-auto">
              We do not just deliver findings. We deliver internal assets that remove meetings and
              speed execution across leadership, product, engineering, and sales.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {internalArtifacts.map((artifact) => (
              <div
                key={artifact.title}
                className="rounded-md border border-border/40 bg-card/20 p-4"
                data-testid={`artifact-card-${artifact.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
              >
                <p className="text-sm font-medium mb-1">{artifact.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{artifact.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-12 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div
            className="rounded-md border border-border/40 bg-card/20 p-5"
            data-testid="sample-report-gallery"
          >
            <h3 className="text-base font-semibold mb-2">Sample report gallery</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Preview report styles before connecting your repo.
            </p>
            <div className="space-y-2">
              {sampleReports.map((report) => (
                <div key={report.title} className="rounded border border-border/30 p-2">
                  <p className="text-xs font-medium">{report.title}</p>
                  <p className="text-xs text-muted-foreground">{report.focus}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-md border border-border/40 bg-card/20 p-5" data-testid="modes">
            <h3 className="text-base font-semibold mb-2">Founder mode + engineering mode</h3>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>
                • Founder mode: clear launch/sell decision with top business-critical fixes first.
              </li>
              <li>
                • Engineering mode: exact files, fix sequence, owner, and acceptance criteria.
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="pb-12 px-4 sm:px-6">
        <div
          className="max-w-6xl mx-auto rounded-md border border-border/40 bg-card/20 p-5"
          data-testid="audit-types-use-cases"
        >
          <h3 className="text-base font-semibold mb-2">Audit types by use case</h3>
          <div className="grid md:grid-cols-2 gap-2">
            {auditTypes.map((auditType) => (
              <div key={auditType.key} className="rounded border border-border/30 p-3">
                <p className="text-xs font-medium">{auditType.label}</p>
                <p className="text-xs text-muted-foreground">{auditType.outcome}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-12 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div
            className="rounded-md border border-border/40 bg-card/20 p-5"
            data-testid="privacy-promise"
          >
            <h3 className="text-base font-semibold mb-2">Data handling & privacy promise</h3>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>• Private repositories are processed only for the agreed audit scope.</li>
              <li>• Access is limited to audit workflows and removed after engagement handoff.</li>
              <li>• Findings are shared only with approved contacts on your project.</li>
              <li>• We can work from temporary access tokens and least-privilege settings.</li>
            </ul>
          </div>
          <div
            className="rounded-md border border-primary/30 bg-primary/5 p-5"
            data-testid="vs-scanners"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <h3 className="text-base font-semibold">Comparison: where we fit vs common tools</h3>
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={() => navigate("/comparison")}
              >
                View full page
              </Button>
            </div>
            <div className="space-y-3">
              {competitorComparison.map((competitor) => (
                <div
                  key={competitor.name}
                  className="rounded-md border border-border/40 bg-background/30 p-3"
                >
                  <p className="text-xs font-semibold">{competitor.name}</p>
                  <p className="text-xs text-muted-foreground">{competitor.bestFor}</p>
                </div>
              ))}
            </div>
            <p className="text-xs font-semibold mt-4 mb-2">
              Our wedge (why founders choose CodeScope):
            </p>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>• Better for founder-led or lean teams that cannot triage endless dashboards.</li>
              <li>• Better for AI-generated MVPs with hidden architecture and reliability debt.</li>
              <li>• Better prioritization with business context, not just severity labels.</li>
              <li>
                • Better answer to: “What should we fix first before launch or a buyer review?”
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section id="intake-form" className="pb-24 px-4 sm:px-6">
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold mb-2" data-testid="text-form-title">
              Start Your Decision Plan
            </h2>
            <p className="text-sm text-muted-foreground">
              Submit your repo. Get launch-risk clarity. Fix what matters first.
            </p>
          </div>

          <form
            data-testid="form-submit-audit"
            onSubmit={(e) => {
              e.preventDefault();
              submitMutation.mutate();
            }}
            className="space-y-4 rounded-md border border-border/40 bg-card/30 p-6"
          >
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Connected Repository
              </label>
              <div className="flex gap-2">
                <Input
                  data-testid="input-repo-url"
                  placeholder="https://github.com/your-org/your-repo"
                  value={formData.repoUrl}
                  onChange={(e) => setFormData({ ...formData, repoUrl: e.target.value })}
                  required
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handlePickRepo}
                  data-testid="button-pick-repo"
                  className="flex-shrink-0 text-xs"
                >
                  <GitFork className="w-3.5 h-3.5 mr-1" />
                  Connect repo
                </Button>
              </div>
            </div>

            {showRepos && repos && repos.length > 0 && (
              <div
                className="rounded-md border border-border/40 bg-background max-h-48 overflow-y-auto"
                data-testid="repo-picker"
              >
                {repos.map((repo) => (
                  <button
                    key={repo.fullName}
                    type="button"
                    onClick={() => selectRepo(repo)}
                    className="w-full text-left px-3 py-2 text-sm hover-elevate flex items-center gap-2 border-b border-border/20 last:border-0"
                    data-testid={`repo-option-${repo.name}`}
                  >
                    {repo.isPrivate ? (
                      <Lock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <Globe className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className="font-medium truncate">{repo.fullName}</span>
                    {repo.language && (
                      <span className="text-[10px] text-muted-foreground ml-auto flex-shrink-0">
                        {repo.language}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Your Name
                </label>
                <Input
                  data-testid="input-contact-name"
                  placeholder="Your name"
                  value={formData.contactName}
                  onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Email
                </label>
                <Input
                  data-testid="input-contact-email"
                  type="email"
                  placeholder="you@company.com"
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Tech Stack
                </label>
                <Input
                  data-testid="input-stack"
                  placeholder="Next.js / Prisma / Postgres"
                  value={formData.stack}
                  onChange={(e) => setFormData({ ...formData, stack: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Deploy Target (optional)
                </label>
                <Input
                  data-testid="input-deploy-target"
                  placeholder="Vercel, AWS, Render..."
                  value={formData.deploymentTarget}
                  onChange={(e) => setFormData({ ...formData, deploymentTarget: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Biggest Concern (optional)
              </label>
              <Textarea
                data-testid="input-biggest-concern"
                placeholder="What keeps you up at night about this codebase?"
                rows={2}
                value={formData.biggestConcern}
                onChange={(e) => setFormData({ ...formData, biggestConcern: e.target.value })}
                className="resize-none"
              />
            </div>

            {!user && (
              <div className="rounded-md border border-border/50 bg-background/40 p-3">
                <p className="text-xs text-muted-foreground mb-3">
                  Sign in or create an account to submit this intake form.
                </p>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <Button
                    type="button"
                    variant={authMode === "signin" ? "default" : "outline"}
                    onClick={() => setAuthMode("signin")}
                  >
                    Sign In
                  </Button>
                  <Button
                    type="button"
                    variant={authMode === "signup" ? "default" : "outline"}
                    onClick={() => setAuthMode("signup")}
                  >
                    Sign Up
                  </Button>
                </div>
                {authMode === "signup" && (
                  <Input
                    className="mb-2"
                    placeholder="Full name"
                    value={authForm.fullName}
                    onChange={(e) => setAuthForm((prev) => ({ ...prev, fullName: e.target.value }))}
                  />
                )}
                <Input
                  className="mb-2"
                  placeholder="Email"
                  type="email"
                  value={authForm.email}
                  onChange={(e) => setAuthForm((prev) => ({ ...prev, email: e.target.value }))}
                />
                <Input
                  className="mb-2"
                  placeholder="Password"
                  type="password"
                  value={authForm.password}
                  onChange={(e) => setAuthForm((prev) => ({ ...prev, password: e.target.value }))}
                />
                <Button
                  type="button"
                  className="w-full mb-2"
                  onClick={async () => {
                    try {
                      if (authMode === "signup") {
                        await signUp(authForm);
                      } else {
                        await signIn({ email: authForm.email, password: authForm.password });
                      }
                      toast({ title: "Welcome", description: "You are now signed in." });
                    } catch (err: any) {
                      toast({
                        title: "Auth error",
                        description: err.message,
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  {authMode === "signup" ? "Create account" : "Sign in"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleGithubOAuth}
                  data-testid="button-github-auth"
                >
                  Sign in with GitHub
                </Button>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={submitMutation.isPending}
              data-testid="button-submit-audit"
            >
              {submitMutation.isPending ? (
                <>
                  <span className="animate-spin mr-2">
                    <Scan className="w-4 h-4" />
                  </span>
                  Starting Scan...
                </>
              ) : (
                <>
                  <Scan className="w-4 h-4 mr-1.5" />
                  Start Your Decision Plan
                </>
              )}
            </Button>
          </form>
        </div>
      </section>

      <footer
        className="border-t border-border/30 py-10 px-4 sm:px-6 bg-card/20"
        data-testid="footer-landing"
      >
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-border/30">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-primary flex items-center justify-center">
                <Code2 className="w-3 h-3 text-primary-foreground" />
              </div>
              <span className="text-sm font-medium" data-testid="text-footer-logo">
                CodeAudit
              </span>
            </div>
            <a
              href="mailto:hello@codeauditapp.com"
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
              data-testid="footer-email"
            >
              hello@codeauditapp.com
            </a>
          </div>

          <div className="pt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <nav aria-label="Footer links">
              <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                <li>
                  <a
                    href="https://github.com/codeauditapp/codescope/blob/main/docs/privacy-policy.md"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-primary transition-colors"
                    data-testid="footer-link-privacy"
                  >
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a
                    href="/docs/terms"
                    className="hover:text-primary transition-colors"
                    data-testid="footer-link-terms"
                  >
                    Terms
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:hello@codeauditapp.com"
                    className="hover:text-primary transition-colors"
                    data-testid="footer-link-contact"
                  >
                    Contact
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/codeauditapp/codescope"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-primary transition-colors"
                    data-testid="footer-link-github"
                  >
                    GitHub
                  </a>
                </li>
              </ul>
            </nav>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>© {new Date().getFullYear()} CodeAudit</p>
              <p>Made with ❤️ in Brooklyn</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
