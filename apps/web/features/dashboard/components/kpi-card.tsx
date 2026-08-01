import { ArrowDown, ArrowUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function Sparkline({ points, positive }: { points: number[]; positive: boolean }) {
  const w = 72;
  const h = 28;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = w / (points.length - 1 || 1);
  const coords = points
    .map((p, i) => `${i * step},${h - ((p - min) / range) * h}`)
    .join(" ");

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="shrink-0">
      <polyline
        points={coords}
        fill="none"
        stroke={positive ? "var(--positive)" : "var(--negative)"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function KpiCard({
  label,
  value,
  deltaLabel,
  deltaPositive,
  trend,
}: {
  label: string;
  value: string;
  deltaLabel?: string;
  deltaPositive?: boolean;
  trend?: number[];
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1.5 py-5">
        <span className="text-muted-foreground text-sm">{label}</span>
        <div className="flex items-end justify-between gap-3">
          <span className="text-2xl font-semibold tabular-nums">{value}</span>
          {trend && trend.length > 1 && (
            <Sparkline points={trend} positive={deltaPositive ?? true} />
          )}
        </div>
        {deltaLabel && (
          <span
            className={cn(
              "flex items-center gap-1 text-xs font-medium",
              deltaPositive ? "text-positive" : "text-negative",
            )}
          >
            {deltaPositive ? (
              <ArrowUp className="size-3" aria-hidden="true" />
            ) : (
              <ArrowDown className="size-3" aria-hidden="true" />
            )}
            {deltaLabel}
          </span>
        )}
      </CardContent>
    </Card>
  );
}
