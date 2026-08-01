import { Check, TriangleAlert } from "lucide-react";
import { formatMoney } from "@/lib/format-money";
import { cn } from "@/lib/utils";
import type { BudgetGroupSummary } from "@/features/dashboard/server/service";

export function BudgetGroupBars({
  groups,
  currency,
}: {
  groups: BudgetGroupSummary[];
  currency: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => {
        const pct = g.actualPct ?? 0;
        const overTarget = g.actualPct !== null && g.actualPct > g.targetPct;
        const fillPct = Math.min(100, pct);

        return (
          <div key={g.group} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                {g.label} <span className="text-muted-foreground font-normal">· target {g.targetPct}%</span>
              </span>
              <span
                className={cn(
                  "flex items-center gap-1 font-medium tabular-nums",
                  overTarget ? "text-negative" : "text-positive",
                )}
              >
                {overTarget ? (
                  <TriangleAlert className="size-3.5" aria-hidden="true" />
                ) : (
                  <Check className="size-3.5" aria-hidden="true" />
                )}
                {g.actualPct === null ? "—" : `${g.actualPct}%`}
              </span>
            </div>
            <div className="bg-muted h-2 w-full overflow-hidden rounded-full" role="presentation">
              <div
                className={cn("h-full rounded-full", overTarget ? "bg-negative" : "bg-positive")}
                style={{ width: `${fillPct}%` }}
              />
            </div>
            <span className="text-muted-foreground text-xs tabular-nums">
              {formatMoney(g.spentMinor, currency)} spent this month
            </span>
          </div>
        );
      })}
    </div>
  );
}
