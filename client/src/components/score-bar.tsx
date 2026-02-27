interface ScoreBarProps {
  label: string;
  score: number | null;
  icon: React.ReactNode;
}

function getScoreColor(score: number) {
  if (score <= 3) return { bar: "bg-red-500", text: "text-red-400" };
  if (score <= 5) return { bar: "bg-yellow-500", text: "text-yellow-400" };
  if (score <= 7) return { bar: "bg-blue-500", text: "text-blue-400" };
  return { bar: "bg-emerald-500", text: "text-emerald-400" };
}

export function ScoreBar({ label, score, icon }: ScoreBarProps) {
  const val = score ?? 0;
  const colors = getScoreColor(val);

  return (
    <div className="flex items-center gap-3" data-testid={`score-bar-${label.toLowerCase()}`}>
      <div className="text-muted-foreground w-5 h-5 flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-foreground/80">{label}</span>
          <span className={`text-xs font-bold tabular-nums ${colors.text}`}>{val}/10</span>
        </div>
        <div className="h-1.5 bg-foreground/5 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${colors.bar} transition-all duration-700 ease-out`}
            style={{ width: `${val * 10}%` }}
          />
        </div>
      </div>
    </div>
  );
}
