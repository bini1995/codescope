export const SEVERITY_CONFIG = {
  critical: { label: "Critical", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", dot: "bg-red-500" },
  high: { label: "High", color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20", dot: "bg-orange-500" },
  medium: { label: "Medium", color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20", dot: "bg-yellow-500" },
  low: { label: "Low", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", dot: "bg-blue-500" },
} as const;

export const CATEGORY_CONFIG = {
  security: { label: "Security", icon: "Shield" },
  stability: { label: "Stability", icon: "Zap" },
  maintainability: { label: "Maintainability", icon: "Wrench" },
  scalability: { label: "Scalability", icon: "TrendingUp" },
  cicd: { label: "CI/CD", icon: "GitBranch" },
} as const;

export const STATUS_CONFIG = {
  pending: { label: "Pending", color: "text-muted-foreground", bg: "bg-muted/50" },
  in_progress: { label: "In Progress", color: "text-blue-400", bg: "bg-blue-500/10" },
  complete: { label: "Complete", color: "text-emerald-400", bg: "bg-emerald-500/10" },
} as const;

export const EFFORT_CONFIG = {
  S: { label: "Small", description: "< 2 hours" },
  M: { label: "Medium", description: "2-8 hours" },
  L: { label: "Large", description: "1-3 days" },
} as const;
