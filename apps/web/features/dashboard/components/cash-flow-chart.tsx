"use client";

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipContentProps } from "recharts";
import { formatMoney } from "@/lib/format-money";
import { ChartDataTable } from "@/features/dashboard/components/chart-data-table";
import type { CashFlowPoint } from "@/features/dashboard/lib/aggregate";

function formatCompact(amountMinor: number, currency: string) {
  const value = amountMinor / 100;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function CashFlowTooltip({
  active,
  payload,
  currency,
}: TooltipContentProps & { currency: string }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as CashFlowPoint;

  return (
    <div className="bg-popover text-popover-foreground rounded-md border px-3 py-2 text-xs shadow-md">
      <p className="text-muted-foreground mb-1 font-medium">{point.label}</p>
      <div className="grid gap-0.5">
        <p>
          <span className="font-semibold tabular-nums">{formatMoney(point.incomeMinor, currency)}</span>{" "}
          <span className="text-muted-foreground">income</span>
        </p>
        <p>
          <span className="font-semibold tabular-nums">{formatMoney(-point.expensesMinor, currency)}</span>{" "}
          <span className="text-muted-foreground">expenses</span>
        </p>
        <p>
          <span className="font-semibold tabular-nums">{formatMoney(point.netMinor, currency)}</span>{" "}
          <span className="text-muted-foreground">net</span>
        </p>
      </div>
    </div>
  );
}

export function CashFlowChart({ data, currency }: { data: CashFlowPoint[]; currency: string }) {
  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={56}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            tickFormatter={(v: number) => formatCompact(v, currency)}
          />
          <ReferenceLine y={0} stroke="var(--border)" />
          <Tooltip
            content={(props: TooltipContentProps) => <CashFlowTooltip {...props} currency={currency} />}
            cursor={{ fill: "var(--muted)" }}
          />
          <Bar dataKey="netMinor" radius={[4, 4, 4, 4]} maxBarSize={28}>
            {data.map((d) => (
              <Cell key={d.month} fill={d.netMinor >= 0 ? "var(--positive)" : "var(--negative)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <ChartDataTable
        caption="Net cash flow by month"
        columns={["Month", "Income", "Expenses", "Net"]}
        rows={data.map((d) => [
          d.label,
          formatMoney(d.incomeMinor, currency),
          formatMoney(-d.expensesMinor, currency),
          formatMoney(d.netMinor, currency),
        ])}
      />
    </div>
  );
}
