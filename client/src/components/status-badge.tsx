import { STATUS_CONFIG } from "@/lib/constants";

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
  if (!config) return null;

  return (
    <span
      data-testid={`badge-status-${status}`}
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${config.bg} ${config.color} border border-transparent`}
    >
      {status === "in_progress" && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500" />
        </span>
      )}
      {status === "complete" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
      {status === "pending" && <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />}
      {config.label}
    </span>
  );
}
