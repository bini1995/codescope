import { useState } from "react";
import { ChevronDown, ChevronUp, FileCode2, Clock, Lock } from "lucide-react";
import { SeverityBadge } from "./severity-badge";
import { CATEGORY_CONFIG, EFFORT_CONFIG } from "@/lib/constants";
import type { Finding } from "@shared/schema";

interface FindingCardProps {
  finding: Finding;
  index: number;
  isPaid?: boolean;
}

export function FindingCard({ finding, index, isPaid = true }: FindingCardProps) {
  const [expanded, setExpanded] = useState(false);
  const category = CATEGORY_CONFIG[finding.category as keyof typeof CATEGORY_CONFIG];
  const effort = EFFORT_CONFIG[finding.effort as keyof typeof EFFORT_CONFIG];

  return (
    <div
      data-testid={`finding-card-${finding.id}`}
      className="group border border-border/50 rounded-md bg-card/30 transition-colors"
    >
      <button
        data-testid={`button-toggle-finding-${finding.id}`}
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-4 py-3 flex items-start gap-3"
      >
        <span className="text-xs text-muted-foreground/50 font-mono mt-0.5 w-5 flex-shrink-0 tabular-nums">
          #{index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <SeverityBadge severity={finding.severity} size="sm" />
            {category && (
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {category.label}
              </span>
            )}
          </div>
          <h4 className="text-sm font-medium text-foreground leading-tight">
            {finding.title}
          </h4>
          {finding.filePath && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <FileCode2 className="w-3 h-3 text-muted-foreground/60" />
              <span className="text-[11px] text-muted-foreground font-mono">
                {finding.filePath}
                {finding.lineStart && `:${finding.lineStart}`}
                {finding.lineEnd && finding.lineEnd !== finding.lineStart && `-${finding.lineEnd}`}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
          {!isPaid && (
            <span className="flex items-center gap-1 text-[10px] text-amber-400">
              <Lock className="w-3 h-3" />
            </span>
          )}
          {effort && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="w-3 h-3" />
              {effort.description}
            </span>
          )}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-border/30 pt-3 ml-8">
          <div>
            <h5 className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 font-medium">
              Description
            </h5>
            <p className="text-sm text-foreground/80 leading-relaxed">{finding.description}</p>
          </div>

          {isPaid && finding.codeSnippet && (
            <div>
              <h5 className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 font-medium">
                Evidence
              </h5>
              <pre className="text-xs font-mono bg-black/30 dark:bg-black/40 rounded-md p-3 overflow-x-auto text-foreground/70 border border-border/20">
                <code>{finding.codeSnippet}</code>
              </pre>
            </div>
          )}

          {!isPaid && (
            <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-3">
              <div className="flex items-center gap-2 text-xs text-amber-400">
                <Lock className="w-3.5 h-3.5" />
                <span className="font-medium">Code evidence locked</span>
              </div>
            </div>
          )}

          <div>
            <h5 className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 font-medium">
              Business Impact
            </h5>
            <p className="text-sm text-foreground/80 leading-relaxed">{finding.businessImpact}</p>
          </div>

          {isPaid ? (
            <div>
              <h5 className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 font-medium">
                How to Fix
              </h5>
              <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
                {finding.fixSteps}
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <h5 className="text-xs font-medium text-amber-400">Fix Steps Locked</h5>
              </div>
              <p className="text-xs text-amber-400/70">
                Unlock this audit to see step-by-step fix instructions for this finding.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
