import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Code2,
  Plus,
  ArrowLeft,
  Calendar,
  ExternalLink,
  Shield,
  Zap,
  Wrench,
  TrendingUp,
  GitBranch,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScoreBar } from "@/components/score-bar";
import type { Audit } from "@shared/schema";
import { useState } from "react";

export default function Dashboard() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");

  const { data: audits, isLoading } = useQuery<Audit[]>({
    queryKey: ["/api/audits"],
  });

  const filtered = audits?.filter(
    (a) =>
      a.repoName.toLowerCase().includes(search.toLowerCase()) ||
      a.ownerName.toLowerCase().includes(search.toLowerCase()) ||
      a.contactName.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: audits?.length ?? 0,
    critical: audits?.filter((a) => (a.securityScore ?? 10) <= 3).length ?? 0,
    complete: audits?.filter((a) => a.status === "complete").length ?? 0,
    pending: audits?.filter((a) => a.status === "pending").length ?? 0,
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Link href="/" data-testid="link-home">
              <div className="flex items-center gap-2 hover-elevate rounded-md px-1 py-0.5">
                <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
                  <Code2 className="w-4 h-4 text-primary-foreground" />
                </div>
                <span className="font-semibold text-lg tracking-tight">CodeScope</span>
              </div>
            </Link>
            <span className="text-border">/</span>
            <span className="text-sm text-muted-foreground">Dashboard</span>
          </div>
          <Button size="sm" onClick={() => navigate("/")} data-testid="button-new-audit">
            <Plus className="w-3.5 h-3.5 mr-1" />
            New Audit
          </Button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: "Total Audits", value: stats.total, color: "text-foreground" },
            { label: "Critical Risk", value: stats.critical, color: "text-red-400" },
            { label: "Completed", value: stats.complete, color: "text-emerald-400" },
            { label: "Pending", value: stats.pending, color: "text-muted-foreground" },
          ].map((s, i) => (
            <div
              key={i}
              data-testid={`stat-${s.label.toLowerCase().replace(" ", "-")}`}
              className="rounded-md border border-border/40 bg-card/30 p-4"
            >
              <div className="text-xs text-muted-foreground mb-1">{s.label}</div>
              <div className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              data-testid="input-search-audits"
              placeholder="Search audits..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-36 rounded-md" />
            ))}
          </div>
        ) : filtered && filtered.length > 0 ? (
          <div className="space-y-3">
            {filtered.map((audit) => (
              <button
                key={audit.id}
                data-testid={`card-audit-${audit.id}`}
                onClick={() => navigate(`/audit/${audit.id}`)}
                className="w-full text-left rounded-md border border-border/40 bg-card/30 p-5 hover-elevate transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <h3 className="font-semibold text-base">
                        {audit.ownerName}/{audit.repoName}
                      </h3>
                      <StatusBadge status={audit.status} />
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(audit.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <span>{audit.stack}</span>
                      {audit.deploymentTarget && <span>{audit.deploymentTarget}</span>}
                      <span>{audit.contactName}</span>
                    </div>

                    {audit.status !== "pending" && (
                      <div className="grid grid-cols-5 gap-3 max-w-lg">
                        <ScoreBar label="Security" score={audit.securityScore} icon={<Shield className="w-full h-full" />} />
                        <ScoreBar label="Stability" score={audit.stabilityScore} icon={<Zap className="w-full h-full" />} />
                        <ScoreBar label="Maintain" score={audit.maintainabilityScore} icon={<Wrench className="w-full h-full" />} />
                        <ScoreBar label="Scale" score={audit.scalabilityScore} icon={<TrendingUp className="w-full h-full" />} />
                        <ScoreBar label="CI/CD" score={audit.cicdScore} icon={<GitBranch className="w-full h-full" />} />
                      </div>
                    )}
                  </div>

                  <ExternalLink className="w-4 h-4 text-muted-foreground/40 flex-shrink-0 mt-1" />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="w-12 h-12 rounded-md bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <FileSearchIcon className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="font-medium mb-1">No audits found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {search ? "Try a different search term" : "Submit your first repo for review"}
            </p>
            {!search && (
              <Button size="sm" onClick={() => navigate("/")} data-testid="button-submit-first">
                Submit a Repo
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FileSearchIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <circle cx="11.5" cy="14.5" r="2.5" />
      <path d="M13.3 16.3 15 18" />
    </svg>
  );
}
