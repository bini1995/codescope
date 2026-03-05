import type { Audit } from "@shared/schema";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";

interface ScoreRadarProps {
  audit: Audit;
  size?: number;
}

function getScoreColor(score: number) {
  if (score <= 3) return "#ef4444";
  if (score <= 5) return "#f59e0b";
  if (score <= 7) return "#3b82f6";
  return "#22c55e";
}

export function ScoreRadar({ audit, size = 220 }: ScoreRadarProps) {
  const data = [
    { metric: "Security", score: audit.securityScore ?? 0 },
    { metric: "Stability", score: audit.stabilityScore ?? 0 },
    { metric: "CI/CD", score: audit.cicdScore ?? 0 },
    { metric: "Scale", score: audit.scalabilityScore ?? 0 },
    { metric: "Maintain", score: audit.maintainabilityScore ?? 0 },
  ];

  const avgScore = data.reduce((sum, item) => sum + item.score, 0) / data.length;
  const scoreColor = getScoreColor(avgScore);

  return (
    <div className="relative" data-testid="score-radar" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="currentColor" strokeOpacity={0.15} />
          <PolarAngleAxis
            dataKey="metric"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontWeight: 500 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 10]}
            tickCount={6}
            tick={false}
            axisLine={false}
          />
          <Radar
            dataKey="score"
            stroke={scoreColor}
            fill={scoreColor}
            fillOpacity={0.18}
            strokeWidth={2}
            dot={{ r: 3.5, fill: scoreColor, strokeWidth: 0 }}
          />
        </RadarChart>
      </ResponsiveContainer>

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <div className="text-2xl font-bold" style={{ color: scoreColor }}>
            {avgScore.toFixed(1)}
          </div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Vibe-Code Score</div>
        </div>
      </div>
    </div>
  );
}
