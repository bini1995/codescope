import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
  const [formData, setFormData] = useState({
    repoUrl: "",
    contactName: "",
    contactEmail: "",
    stack: "",
    deploymentTarget: "",
    biggestConcern: "",
  });
  const [showRepos, setShowRepos] = useState(false);

  const { data: repos } = useQuery<GHRepo[]>({
    queryKey: ["/api/github/repos"],
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const urlParts = formData.repoUrl.replace("https://github.com/", "").split("/");
      const ownerName = urlParts[0] || "unknown";
      const repoName = urlParts[1]?.replace(".git", "") || "unknown";
      const res = await apiRequest("POST", "/api/audits", {
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
      try {
        await apiRequest("POST", `/api/audits/${audit.id}/scan`);
      } catch {}
      navigate(`/audit/${audit.id}`);
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
    "Indie hackers & solo founders",
    "Bootstrapped SaaS teams",
    "AI/ML built MVPs",
    "Vibe-coded platforms",
    "Early-stage startups ready to scale",
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
      name: "Starter",
      price: "$750",
      desc: "Full automated code audit with prioritized findings",
      features: [
        "Full codebase security scan",
        "Executive summary report",
        "Prioritized findings list",
        "Severity-ranked issues",
        "Business impact analysis",
      ],
      cta: "Get Started",
      popular: false,
    },
    {
      name: "Pro",
      price: "$1,500",
      desc: "Everything in Starter plus CI setup and fix PRs",
      features: [
        "All Starter features",
        "CI baseline + GitHub Actions config",
        "Top 2 PR fixes submitted",
        "14-day remediation roadmap",
        "Detailed code evidence",
      ],
      cta: "Go Pro",
      popular: true,
    },
    {
      name: "Premium",
      price: "$3,500",
      desc: "Full-service audit with hands-on remediation",
      features: [
        "All Pro features",
        "5 PR fixes submitted",
        "1:1 review call",
        "Loom walkthrough recording",
        "Priority turnaround (24h)",
      ],
      cta: "Go Premium",
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
            <Button size="sm" onClick={() => document.getElementById("intake-form")?.scrollIntoView({ behavior: "smooth" })} data-testid="button-get-audit">
              Get Audit
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </nav>

      <section className="pt-32 pb-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
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
            Professional codebase audits for AI-built SaaS & vibe-coded startups.
            Find and fix real flaws before they break your product.
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
                title: "Submit Your Repo",
                desc: "Paste your GitHub repository URL or pick from your connected repos. We analyze public and private repositories.",
                icon: <GitFork className="w-5 h-5" />,
              },
              {
                step: "2",
                title: "We Audit Your Code",
                desc: "Security, stability, dependencies, architecture — our scanner fetches your file tree and detects real patterns across 80+ files.",
                icon: <Scan className="w-5 h-5" />,
              },
              {
                step: "3",
                title: "Get Your Report",
                desc: "Receive a prioritized report with severity-ranked findings, code evidence, business impact, fix steps, and a remediation roadmap.",
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

      <section id="pricing" className="pb-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3" data-testid="text-pricing-title">Audit Packages</h2>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Price transparency increases trust. Pick the level of depth you need.
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
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">GitHub Repository URL</label>
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
                  onClick={() => setShowRepos(!showRepos)}
                  data-testid="button-pick-repo"
                  className="flex-shrink-0 text-xs"
                >
                  <GitFork className="w-3.5 h-3.5 mr-1" />
                  Pick
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
