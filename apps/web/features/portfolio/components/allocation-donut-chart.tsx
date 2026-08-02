"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { TooltipContentProps } from "recharts";
import { formatMoney } from "@/lib/format-money";
import { ChartDataTable } from "@/features/dashboard/components/chart-data-table";
import type { AllocationSlice } from "@/features/portfolio/lib/analytics";

// Same validated categorical slots as the dashboard's category donut
// (globals.css) — fixed order, "Other"/overflow stays muted, never a
// fabricated extra hue.
const SLOT_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];
const OVERFLOW_COLOR = "var(--muted-foreground)";

function colorFor(index: number) {
  return index < SLOT_COLORS.length ? SLOT_COLORS[index] : OVERFLOW_COLOR;
}

function AllocationTooltip({
  active,
  payload,
  currency,
}: TooltipContentProps & { currency: string }) {
  if (!active || !payload?.length) return null;
  const slice = payload[0].payload as AllocationSlice;

  return (
    <div className="bg-popover text-popover-foreground rounded-md border px-3 py-2 text-xs shadow-md">
      <p className="font-semibold tabular-nums">{formatMoney(slice.valueMinor, currency)}</p>
      <p className="text-muted-foreground">
        {slice.label} &middot; {slice.pct}%
      </p>
    </div>
  );
}

export function AllocationDonutChart({
  data,
  currency,
  caption,
}: {
  data: AllocationSlice[];
  currency: string;
  caption: string;
}) {
  return (
    <div>
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <ResponsiveContainer width="100%" height={200} className="max-w-52">
          <PieChart>
            <Pie
              data={data}
              dataKey="valueMinor"
              nameKey="label"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((d, i) => (
                <Cell key={d.key} fill={colorFor(i)} />
              ))}
            </Pie>
            <Tooltip
              content={(props: TooltipContentProps) => <AllocationTooltip {...props} currency={currency} />}
            />
          </PieChart>
        </ResponsiveContainer>

        <ul className="flex w-full flex-col gap-1.5 text-sm">
          {data.map((d, i) => (
            <li key={d.key} className="flex items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: colorFor(i) }}
                aria-hidden="true"
              />
              <span className="flex-1 truncate">{d.label}</span>
              <span className="text-muted-foreground tabular-nums">{d.pct}%</span>
              <span className="tabular-nums">{formatMoney(d.valueMinor, currency)}</span>
            </li>
          ))}
        </ul>
      </div>

      <ChartDataTable
        caption={caption}
        columns={["Name", "Value", "Share"]}
        rows={data.map((d) => [d.label, formatMoney(d.valueMinor, currency), `${d.pct}%`])}
      />
    </div>
  );
}
