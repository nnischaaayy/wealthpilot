"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { TooltipContentProps } from "recharts";
import { formatMoney } from "@/lib/format-money";
import { ChartDataTable } from "@/features/dashboard/components/chart-data-table";
import type { CategorySlice } from "@/features/dashboard/lib/aggregate";

// Fixed-order categorical slots (validated — see globals.css); "Other" is
// muted, never a fabricated 6th hue.
const SLOT_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];
const OTHER_COLOR = "var(--muted-foreground)";

function colorFor(slice: CategorySlice, index: number) {
  return slice.category === "other" ? OTHER_COLOR : SLOT_COLORS[index % SLOT_COLORS.length];
}

function DonutTooltip({
  active,
  payload,
  currency,
  total,
}: TooltipContentProps & { currency: string; total: number }) {
  if (!active || !payload?.length) return null;
  const slice = payload[0].payload as CategorySlice;
  const pct = total > 0 ? Math.round((slice.amountMinor / total) * 100) : 0;

  return (
    <div className="bg-popover text-popover-foreground rounded-md border px-3 py-2 text-xs shadow-md">
      <p className="font-semibold tabular-nums">{formatMoney(slice.amountMinor, currency)}</p>
      <p className="text-muted-foreground">
        {slice.label} &middot; {pct}%
      </p>
    </div>
  );
}

export function CategoryDonutChart({ data, currency }: { data: CategorySlice[]; currency: string }) {
  const total = data.reduce((sum, d) => sum + d.amountMinor, 0);

  return (
    <div>
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <ResponsiveContainer width="100%" height={200} className="max-w-52">
          <PieChart>
            <Pie
              data={data}
              dataKey="amountMinor"
              nameKey="label"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((d, i) => (
                <Cell key={d.category} fill={colorFor(d, i)} />
              ))}
            </Pie>
            <Tooltip
              content={(props: TooltipContentProps) => (
                <DonutTooltip {...props} currency={currency} total={total} />
              )}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Custom legend — swatch carries identity, text stays in text tokens (never the series color). */}
        <ul className="flex w-full flex-col gap-1.5 text-sm">
          {data.map((d, i) => {
            const pct = total > 0 ? Math.round((d.amountMinor / total) * 100) : 0;
            return (
              <li key={d.category} className="flex items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: colorFor(d, i) }}
                  aria-hidden="true"
                />
                <span className="flex-1 truncate">{d.label}</span>
                <span className="text-muted-foreground tabular-nums">{pct}%</span>
                <span className="tabular-nums">{formatMoney(d.amountMinor, currency)}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <ChartDataTable
        caption="Spending by category this month"
        columns={["Category", "Amount", "Share"]}
        rows={data.map((d) => [
          d.label,
          formatMoney(d.amountMinor, currency),
          `${total > 0 ? Math.round((d.amountMinor / total) * 100) : 0}%`,
        ])}
      />
    </div>
  );
}
