import { SEVERITY_CONFIG } from "@/lib/constants";

interface SeverityBadgeProps {
  severity: string;
  size?: "sm" | "md";
}

export function SeverityBadge({ severity, size = "md" }: SeverityBadgeProps) {
  const config = SEVERITY_CONFIG[severity as keyof typeof SEVERITY_CONFIG];
  if (!config) return null;

  return (
    <span
      data-testid={`badge-severity-${severity}`}
      className={`inline-flex items-center gap-1.5 rounded-md font-medium ${config.bg} ${config.border} border ${config.color} ${
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
