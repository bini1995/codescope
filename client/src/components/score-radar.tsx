import type { Audit } from "@shared/schema";

interface ScoreRadarProps {
  audit: Audit;
  size?: number;
}

const categories = [
  { key: "securityScore", label: "Security", angle: -90 },
  { key: "stabilityScore", label: "Stability", angle: -18 },
  { key: "cicdScore", label: "CI/CD", angle: 54 },
  { key: "scalabilityScore", label: "Scale", angle: 126 },
  { key: "maintainabilityScore", label: "Maintain", angle: 198 },
] as const;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function getScoreColor(score: number) {
  if (score <= 3) return "#ef4444";
  if (score <= 5) return "#f59e0b";
  if (score <= 7) return "#3b82f6";
  return "#22c55e";
}

export function ScoreRadar({ audit, size = 220 }: ScoreRadarProps) {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.38;
  const rings = [0.25, 0.5, 0.75, 1];

  const scores = categories.map((cat) => {
    const val = (audit[cat.key] as number | null) ?? 0;
    return { ...cat, value: val };
  });

  const dataPoints = scores.map((s) => {
    const r = (s.value / 10) * maxR;
    return polarToCartesian(cx, cy, r, s.angle);
  });

  const pathD = dataPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

  const avgScore = scores.reduce((sum, s) => sum + s.value, 0) / scores.length;

  return (
    <div className="relative" data-testid="score-radar">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {rings.map((ring, i) => {
          const r = ring * maxR;
          const pts = categories.map((cat) => polarToCartesian(cx, cy, r, cat.angle));
          const d = pts.map((p, j) => `${j === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
          return (
            <path
              key={i}
              d={d}
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.08}
              strokeWidth={1}
            />
          );
        })}

        {categories.map((cat) => {
          const edge = polarToCartesian(cx, cy, maxR, cat.angle);
          return (
            <line
              key={cat.key}
              x1={cx}
              y1={cy}
              x2={edge.x}
              y2={edge.y}
              stroke="currentColor"
              strokeOpacity={0.06}
              strokeWidth={1}
            />
          );
        })}

        <defs>
          <linearGradient id="radarFill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={getScoreColor(avgScore)} stopOpacity={0.25} />
            <stop offset="100%" stopColor={getScoreColor(avgScore)} stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <path d={pathD} fill="url(#radarFill)" stroke={getScoreColor(avgScore)} strokeWidth={2} strokeOpacity={0.6} />

        {dataPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3.5} fill={getScoreColor(scores[i].value)} />
        ))}

        {scores.map((s) => {
          const labelR = maxR + 18;
          const pos = polarToCartesian(cx, cy, labelR, s.angle);
          return (
            <text
              key={s.key}
              x={pos.x}
              y={pos.y}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-muted-foreground"
              fontSize={10}
              fontWeight={500}
            >
              {s.label}
            </text>
          );
        })}
      </svg>

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <div className="text-2xl font-bold" style={{ color: getScoreColor(avgScore) }}>
            {avgScore.toFixed(1)}
          </div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Score</div>
        </div>
      </div>
    </div>
  );
}
