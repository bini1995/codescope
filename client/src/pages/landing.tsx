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
  FileSearch,
  ChevronRight,
  Scan,
  GitFork,
  Lock,
  Globe,
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

  const features = [
    {
      icon: <Shield className="w-5 h-5" />,
      title: "Security Scan",
      desc: "Detects exposed secrets, hardcoded API keys, SQL injection patterns, unsafe CORS, and missing auth middleware",
    },
    {
      icon: <Zap className="w-5 h-5" />,
      title: "Stability Analysis",
      desc: "Finds hallucinated packages, missing lockfiles, version conflicts, and broken import paths",
    },
    {
      icon: <Wrench className="w-5 h-5" />,
      title: "Code Quality",
      desc: "Identifies mega-files, dead code, missing validation, duplicate patterns, and TODO/HACK comments",
    },
    {
      icon: <TrendingUp className="w-5 h-5" />,
      title: "Scalability Check",
      desc: "Spots N+1 queries, missing caching, synchronous bottlenecks, and no rate limiting",
    },
    {
      icon: <GitBranch className="w-5 h-5" />,
      title: "CI/CD Assessment",
      desc: "Checks for GitHub Actions workflows, branch protection, automated testing, and deployment safety",
    },
    {
      icon: <Scan className="w-5 h-5" />,
      title: "Automated Scanning",
      desc: "Pattern-based detection across 80+ files with line-level evidence and actionable fix steps",
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
            <span className="font-semibold text-lg tracking-tight" data-testid="text-logo">CodeScope</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} data-testid="link-dashboard">
              Dashboard
            </Button>
            <Button size="sm" onClick={() => document.getElementById("intake-form")?.scrollIntoView({ behavior: "smooth" })} data-testid="button-get-audit">
              Scan Repo
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </nav>

      <section className="pt-32 pb-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/50 px-3 py-1 mb-6">
            <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />
            <span className="text-xs text-muted-foreground">Built with AI? Your code has hidden risks.</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
            Find what's broken
            <br />
            <span className="bg-gradient-to-r from-primary via-blue-400 to-cyan-400 bg-clip-text text-transparent">
              before your users do
            </span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Automated code audits for AI-generated and fast-shipped codebases.
            Paste your GitHub repo URL, get a full security and quality scan with
            severity-ranked findings and fix steps in minutes.
          </p>

          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Button size="lg" onClick={() => document.getElementById("intake-form")?.scrollIntoView({ behavior: "smooth" })} data-testid="button-start-audit">
              Scan Your Repo
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
            <Button variant="outline" size="lg" onClick={() => navigate("/dashboard")} data-testid="button-view-examples">
              View Example Reports
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </section>

      <section className="pb-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold mb-3">What We Scan For</h2>
            <p className="text-muted-foreground text-sm">Real pattern detection across your entire codebase</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <div
                key={i}
                data-testid={`card-feature-${i}`}
                className="group relative rounded-md border border-border/40 bg-card/30 p-5 hover-elevate"
              >
                <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center mb-3 text-primary">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-sm mb-1.5">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-3">How It Works</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { step: "1", title: "Paste Your Repo", desc: "Enter your GitHub repository URL or pick from your repos. We analyze public and private repos." },
              { step: "2", title: "Automated Scan", desc: "Our scanner fetches your file tree, detects patterns across 80+ files, and identifies real issues with evidence." },
              { step: "3", title: "Get Your Report", desc: "Receive severity-ranked findings with code snippets, business impact, fix steps, and a 14-day remediation plan." },
            ].map((item, i) => (
              <div key={i} className="text-center" data-testid={`step-${i}`}>
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center mx-auto mb-3">
                  {item.step}
                </div>
                <h3 className="font-semibold text-sm mb-1.5">{item.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="intake-form" className="pb-24 px-4 sm:px-6">
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">Scan Your Repository</h2>
            <p className="text-sm text-muted-foreground">Results in minutes, not days</p>
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
                  Scan Repository
                </>
              )}
            </Button>
          </form>
        </div>
      </section>

      <footer className="border-t border-border/30 py-8 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-primary flex items-center justify-center">
              <Code2 className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="text-sm font-medium">CodeScope</span>
          </div>
          <p className="text-xs text-muted-foreground">Automated code audits for the AI era</p>
        </div>
      </footer>
    </div>
  );
}
