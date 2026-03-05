import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { SCAN_LIMITS, formatRepoSizeLimitMb } from "@shared/scan-limits";
import {
  Shield,
  Zap,
  Wrench,
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
  Video,
  BookOpen,
  Target,
  Rocket,
  Check,
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

  const { data: repos } = useQuery<GHRepo[]>({
    queryKey: ["/api/github/repos"],
    enabled: !!user,
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

  const selectRepo = (repo: GHRepo) => {
    setFormData((prev) => ({
      ...prev,
      repoUrl: repo.url,
      stack: repo.language || prev.stack,
    }));
    setShowRepos(false);
  };

  const handleGithubOAuth = () => {
    window.location.href = "/api/auth/github";
  };

  const handlePickRepo = () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Sign in from the dashboard first, then pick from your connected GitHub repositories.",
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

  const valueBlocks = [
    {
      icon: <Shield className="w-5 h-5" />,
      title: "Security & Data Leakage",
      desc: "Hardcoded secrets, auth holes, exposed uploads, SQL injection, unsafe CORS configurations",
      impact: "Prevent breaches & compliance issues",
    },
    {
      icon: <Zap className="w-5 h-5" />,
      title: "Stability Risks",
      desc: "Broken dependencies, hallucinated libraries, missing lockfiles, version conflicts",
      impact: "Avoid crashes & runtime failures",
    },
    {
      icon: <Wrench className="w-5 h-5" />,
      title: "Maintainability Issues",
      desc: "Mega-files, duplicate code, missing validation, dead code, TODO/HACK patterns",
      impact: "Make your code easier to change",
    },
    {
      icon: <TrendingUp className="w-5 h-5" />,
      title: "Scalability Problems",
      desc: "N+1 queries, missing caching, synchronous bottlenecks, no rate limiting",
      impact: "Prevent slowdowns at growth",
    },
    {
      icon: <GitBranch className="w-5 h-5" />,
      title: "CI/CD Weaknesses",
      desc: "No automated checks, missing GitHub Actions, no branch protection, no deployment safety",
      impact: "Reduce deployment risk",
    },
    {
      icon: <Scan className="w-5 h-5" />,
      title: "Automated Pattern Detection",
      desc: "Pattern-based detection across 80+ files with line-level evidence and severity ranking",
      impact: "Find issues humans miss",
    },
  ];

  const audienceList = [
    "Founders shipping AI-generated apps before launch",
    "Agencies building MVPs across multiple client repos",
    "Small teams post-funding that need reliability now",
    "Teams preparing for enterprise pilots or procurement reviews",
    "Engineering leads doing pre-launch or post-incident hardening",
  ];

  const trustTools = [
    "Semgrep",
    "Gitleaks",
    "NPM Audit",
    "ESLint",
    "GitHub Actions",
    "Pattern Analysis",
  ];

  const pricingTiers = [
    {
      name: "Quick Triage",
      price: "$499",
      desc: "45–60 minute expert triage with top risks and immediate actions",
      features: [
        "45–60 minute expert review session",
        "Top 10 launch-blocking risks identified",
        "Short walkthrough call + prioritized actions",
        "Fast summary delivered within 24 hours",
        "Best for founders needing fast decision support",
      ],
      cta: "Book $499 Triage",
      popular: false,
    },
    {
      name: "Full Audit",
      price: "$1,500",
      desc: "Comprehensive report and remediation roadmap for launch confidence",
      features: [
        "Human-led codebase security + architecture review",
        "Executive summary + business impact analysis",
        "Detailed finding evidence and fix recommendations",
        "14-day prioritized remediation roadmap",
        "Manual intake and follow-up support",
      ],
      cta: "Book $1,500 Audit",
      popular: true,
    },
    {
      name: "Fix Sprint",
      price: "$3,000",
      desc: "Hands-on implementation sprint where we ship PRs for your top issues",
      features: [
        "Everything in Full Audit",
        "Implementation of the highest-priority fixes",
        "Production-ready pull requests with rationale",
        "Before/after risk summary for stakeholders",
        "Ideal when your team needs execution, not just advice",
      ],
      cta: "Start $3,000 Sprint",
      popular: false,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
              <Code2 className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg tracking-tight" data-testid="text-logo">CodeAudit</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <Button variant="ghost" size="sm" onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })} data-testid="link-pricing" className="text-xs sm:text-sm">
              Pricing
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} data-testid="link-dashboard" className="text-xs sm:text-sm">
              Dashboard
            </Button>
            {user && (
              <Button variant="ghost" size="sm" onClick={() => signOut()} data-testid="button-signout" className="text-xs sm:text-sm">
                Sign out
              </Button>
            )}
            <Button size="sm" onClick={() => document.getElementById("intake-form")?.scrollIntoView({ behavior: "smooth" })} data-testid="button-get-audit">
              Get Audit
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </nav>

      {user && (
        <section className="pt-24 pb-4 px-4 sm:px-6">
          <div className="max-w-4xl mx-auto text-sm text-muted-foreground">Signed in as <span className="font-medium text-foreground">{user.email}</span></div>
        </section>
      )}
      <section className="pt-24 pb-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 mb-4">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs text-emerald-300">48h SLA: Your first actionable audit report in 2 business days.</span>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/50 px-3 py-1 mb-6">
            <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />
            <span className="text-xs text-muted-foreground">Built with AI? Vibe-coded? Your code has hidden risks.</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6" data-testid="text-hero-title">
            Audit your codebase for
            <br />
            <span className="bg-gradient-to-r from-primary via-blue-400 to-cyan-400 bg-clip-text text-transparent">
              security, stability & growth risks
            </span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6 leading-relaxed" data-testid="text-hero-subtitle">
            Productized expert audits for AI-built SaaS teams.
            Get fast signal with an instant preview, then expert context and implementation support.
          </p>

          <p className="text-sm text-muted-foreground/70 mb-8">
            Stop guesswork. Know where your code breaks before your users do.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
            <Button size="lg" onClick={() => document.getElementById("intake-form")?.scrollIntoView({ behavior: "smooth" })} data-testid="button-start-audit">
              Start Your Audit
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
            <Button variant="outline" size="lg" onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })} data-testid="button-see-pricing">
              See Pricing
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
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

        {showSampleReport && (
          <div className="mt-3 rounded-md border border-border/40 bg-background/70 p-3" data-testid="sample-report-preview">
            <h4 className="text-sm font-semibold mb-2">Sample Report Preview</h4>
            <div className="grid gap-2 md:grid-cols-2 text-xs">
              <div className="rounded border border-border/30 p-2">
                <p className="font-medium mb-1">Executive Summary</p>
                <p className="text-muted-foreground">Primary launch risk is auth/session hardening and deployment safety checks. Addressing 4 high-impact items in week 1 cuts projected outage/security exposure materially.</p>
              </div>
              <div className="rounded border border-border/30 p-2">
                <p className="font-medium mb-1">Top 3 Existential Risks</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Unprotected admin actions</li>
                  <li>• Missing CI secret scanning</li>
                  <li>• No API rate limiting</li>
                </ul>
              </div>
            </div>
          </div>
        )}
        </div>
      </section>

      <section className="pb-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3" data-testid="text-value-title">What CodeAudit Finds For You</h2>
            <p className="text-muted-foreground text-sm max-w-lg mx-auto">
              We find real risks in your code. Actionable recommendations, not noise.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {valueBlocks.map((f, i) => (
              <div
                key={i}
                data-testid={`card-feature-${i}`}
                className="group relative rounded-md border border-border/40 bg-card/30 p-5 hover-elevate"
              >
                <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center mb-3 text-primary">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-sm mb-1.5">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">{f.desc}</p>
                <p className="text-[11px] text-primary/70 font-medium flex items-center gap-1">
                  <Target className="w-3 h-3" />
                  {f.impact}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3" data-testid="text-how-title">How It Works</h2>
            <p className="text-muted-foreground text-sm">Simple process, powerful results</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Run Instant Scan Preview",
                desc: "Immediately get repo metadata, file tree visibility, 10 heuristic checks, and sample findings.",
                icon: <GitFork className="w-5 h-5" />,
              },
              {
                step: "2",
                title: "Add Expert Review",
                desc: "Upgrade to expert analysis for architecture context, infra risks, and business-priority remediation sequencing.",
                icon: <Scan className="w-5 h-5" />,
              },
              {
                step: "3",
                title: "Ship Fixes Fast",
                desc: "Pick a fix sprint when needed and receive implementation-focused PRs for your highest-risk issues.",
                icon: <FileText className="w-5 h-5" />,
              },
            ].map((item, i) => (
              <div key={i} className="text-center" data-testid={`step-${i}`}>
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
                  {item.icon}
                </div>
                <div className="text-xs text-muted-foreground/60 uppercase tracking-wider mb-1.5">Step {item.step}</div>
                <h3 className="font-semibold text-sm mb-2">{item.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-md border border-border/40 bg-background/40 px-4 py-3 text-xs text-muted-foreground">
            Scan limits: up to <span className="font-medium text-foreground">{SCAN_LIMITS.maxFilesToScan.toLocaleString()} files</span> and <span className="font-medium text-foreground">{formatRepoSizeLimitMb()}</span> repository size per scan.
          </div>

          <div className="flex justify-center mt-8">
            <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground/40">
              <span className="px-3 py-1 rounded border border-border/30">Submit</span>
              <ArrowRight className="w-4 h-4" />
              <span className="px-3 py-1 rounded border border-border/30">We Audit</span>
              <ArrowRight className="w-4 h-4" />
              <span className="px-3 py-1 rounded border border-border/30">Get Report & Remediation</span>
            </div>
          </div>
        </div>
      </section>

      <section className="pb-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-md border border-border/40 bg-card/20 p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div>
                <h2 className="text-xl font-bold mb-3" data-testid="text-audience-title">Perfect For</h2>
                <ul className="space-y-2.5">
                  {audienceList.map((item, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-sm text-foreground/80" data-testid={`audience-item-${i}`}>
                      <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Trusted Workflows Built On</h3>
                <div className="flex flex-wrap gap-2">
                  {trustTools.map((tool, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 rounded-md border border-border/40 bg-background/50 text-xs text-muted-foreground font-medium"
                      data-testid={`trust-tool-${i}`}
                    >
                      {tool}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground/60 mt-3 italic">
                  Powered by industry tools + human-level pattern analysis
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pb-16 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-md border border-border/40 bg-card/20 p-6">
            <h3 className="text-lg font-semibold mb-2" data-testid="text-preview-title">Instant Scan Preview (included before expert upsell)</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Every engagement starts with quick, tangible value so buyers can see risk signal before committing to deeper work.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {[
                "Repository metadata snapshot",
                "File tree + hot spots overview",
                "10 heuristic checks across common failure modes",
                "Sample findings to frame next best action",
              ].map((item, idx) => (
                <div key={idx} className="rounded border border-border/40 bg-background/50 p-3" data-testid={`preview-item-${idx}`}>
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

      <section id="pricing" className="pb-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3" data-testid="text-pricing-title">Choose Your Audit Path</h2>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Productized offers designed for fast decisions and immediate risk reduction.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {pricingTiers.map((tier, i) => (
              <div
                key={i}
                data-testid={`pricing-tier-${tier.name.toLowerCase()}`}
                className={`rounded-md border p-6 flex flex-col ${
                  tier.popular
                    ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                    : "border-border/40 bg-card/30"
                }`}
              >
                {tier.popular && (
                  <div className="text-[10px] uppercase tracking-wider text-primary font-semibold mb-2">
                    Most Popular
                  </div>
                )}
                <h3 className="text-lg font-bold mb-1">{tier.name}</h3>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-3xl font-bold">{tier.price}</span>
                  <span className="text-xs text-muted-foreground">/ audit</span>
                </div>
                <p className="text-xs text-muted-foreground mb-5">{tier.desc}</p>
                <ul className="space-y-2 mb-6 flex-1">
                  {tier.features.map((feature, j) => (
                    <li key={j} className="flex items-start gap-2 text-xs text-foreground/80">
                      <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={tier.popular ? "default" : "outline"}
                  className="w-full"
                  onClick={() => document.getElementById("intake-form")?.scrollIntoView({ behavior: "smooth" })}
                  data-testid={`button-pricing-${tier.name.toLowerCase()}`}
                >
                  {tier.cta}
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-8 px-4 sm:px-6">
        <div className="max-w-xl mx-auto rounded-md border border-emerald-500/30 bg-emerald-500/5 p-4" data-testid="sample-report-callout">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-sm">See a sample report instantly</h3>
              <p className="text-xs text-muted-foreground mt-1">Preview an executive summary, top risks, and a prioritized fix roadmap before connecting your repo.</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setShowSampleReport((prev) => !prev)} data-testid="button-view-sample-report">
              {showSampleReport ? "Hide Sample" : "View Sample"}
            </Button>
          </div>
        </div>
      </section>

      <section className="pb-14 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-lg font-semibold text-center mb-4" data-testid="text-offer-modes">Urgent audit modes</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-md border border-border/40 bg-card/20 p-4" data-testid="card-prelaunch-audit">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Pre-launch Audit</p>
              <p className="text-sm text-foreground/90">For teams shipping soon that need confidence on security, stability, and deployment readiness before release.</p>
            </div>
            <div className="rounded-md border border-border/40 bg-card/20 p-4" data-testid="card-postincident-audit">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Post-incident Audit</p>
              <p className="text-sm text-foreground/90">For teams recovering from outages or security events that need root-cause hardening and remediation priorities.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="intake-form" className="pb-24 px-4 sm:px-6">
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold mb-2" data-testid="text-form-title">Start Your Audit</h2>
            <p className="text-sm text-muted-foreground">Submit your repo. Get your report. Fix what matters first.</p>
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
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Connected Repository</label>
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
              <div className="rounded-md border border-border/40 bg-background max-h-48 overflow-y-auto" data-testid="repo-picker">
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
                      <span className="text-[10px] text-muted-foreground ml-auto flex-shrink-0">{repo.language}</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Your Name</label>
                <Input
                  data-testid="input-contact-name"
                  placeholder="Your name"
                  value={formData.contactName}
                  onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Email</label>
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
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tech Stack</label>
                <Input
                  data-testid="input-stack"
                  placeholder="Next.js / Prisma / Postgres"
                  value={formData.stack}
                  onChange={(e) => setFormData({ ...formData, stack: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Deploy Target (optional)</label>
                <Input
                  data-testid="input-deploy-target"
                  placeholder="Vercel, AWS, Render..."
                  value={formData.deploymentTarget}
                  onChange={(e) => setFormData({ ...formData, deploymentTarget: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Biggest Concern (optional)</label>
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
                  <Button type="button" variant={authMode === "signin" ? "default" : "outline"} onClick={() => setAuthMode("signin")}>Sign In</Button>
                  <Button type="button" variant={authMode === "signup" ? "default" : "outline"} onClick={() => setAuthMode("signup")}>Sign Up</Button>
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
                      toast({ title: "Auth error", description: err.message, variant: "destructive" });
                    }
                  }}
                >
                  {authMode === "signup" ? "Create account" : "Sign in"}
                </Button>
                <Button type="button" variant="outline" className="w-full" onClick={handleGithubOAuth} data-testid="button-github-auth">
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
                  Start Your Audit
                </>
              )}
            </Button>
          </form>
        </div>
      </section>

      <footer className="border-t border-border/30 py-8 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-primary flex items-center justify-center">
              <Code2 className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="text-sm font-medium" data-testid="text-footer-logo">CodeAudit</span>
          </div>
          <p className="text-xs text-muted-foreground">Professional codebase audits for AI-built startups</p>
        </div>
      </footer>
    </div>
  );
}
