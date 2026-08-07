import type { Metadata } from "next";
import Link from "next/link";
import { Download, Upload } from "lucide-react";
import { requireActiveWorkspace } from "@/lib/workspace-context";
import { formatMoney } from "@/lib/format-money";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/layout/empty-state";
import { listTransactions } from "@/features/transactions/server/service";
import {
  getBudgetGroups,
  getCashFlowTrend,
  getCategoryBreakdown,
  getDashboardSummary,
} from "@/features/dashboard/server/service";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { CashFlowChart } from "@/features/dashboard/components/cash-flow-chart";
import { CategoryDonutChart } from "@/features/dashboard/components/category-donut-chart";
import { BudgetGroupBars } from "@/features/dashboard/components/budget-group-bars";
import { RecentTransactionsList } from "@/features/dashboard/components/recent-transactions-list";
import { reconstructNetWorthSeries } from "@/features/dashboard/lib/aggregate";

export const metadata: Metadata = { title: "Dashboard — WealthPilot" };

export default async function DashboardPage() {
  const { workspaceId } = await requireActiveWorkspace();
  const summary = await getDashboardSummary(workspaceId);

  if (!summary.hasTransactions || !summary.currency) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <EmptyState
          icon={Upload}
          title="No transactions yet"
          description="Upload a bank statement to see your net worth, cash flow, and spending here."
          actionLabel="Upload a statement"
          actionHref="/transactions"
        />
      </div>
    );
  }

  const currency = summary.currency;

  const [trend, categories, budget, recent] = await Promise.all([
    getCashFlowTrend(workspaceId, currency, 6),
    getCategoryBreakdown(workspaceId, currency),
    getBudgetGroups(workspaceId, currency),
    listTransactions(workspaceId, { page: 1, pageSize: 10, sort: "date-desc" }),
  ]);

  const thisMonth = trend[trend.length - 1];
  const lastMonth = trend[trend.length - 2];
  const netDelta = thisMonth.netMinor - lastMonth.netMinor;
  const lastMonthSavingsRate =
    lastMonth.incomeMinor > 0 ? Math.round((lastMonth.netMinor / lastMonth.incomeMinor) * 100) : null;

  const netWorthSeries = reconstructNetWorthSeries(trend, summary.netWorthMinor);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={
              <a href="/api/exports/report?format=csv" download>
                <Download className="size-4" />
                CSV
              </a>
            }
          />
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={
              <a href="/api/exports/report?format=pdf" download>
                <Download className="size-4" />
                PDF
              </a>
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Net worth"
          value={formatMoney(summary.netWorthMinor, currency)}
          deltaLabel={`${netDelta >= 0 ? "+" : ""}${formatMoney(netDelta, currency)} this month`}
          deltaPositive={netDelta >= 0}
          trend={netWorthSeries}
        />
        <KpiCard
          label="Cash flow this month"
          value={formatMoney(thisMonth.netMinor, currency)}
          deltaLabel={`${netDelta >= 0 ? "+" : ""}${formatMoney(netDelta, currency)} vs last month`}
          deltaPositive={netDelta >= 0}
        />
        <KpiCard
          label="Savings rate"
          value={summary.savingsRatePct === null ? "—" : `${summary.savingsRatePct}%`}
          deltaLabel={
            summary.savingsRatePct !== null && lastMonthSavingsRate !== null
              ? `${summary.savingsRatePct >= lastMonthSavingsRate ? "+" : ""}${summary.savingsRatePct - lastMonthSavingsRate}pp vs last month`
              : undefined
          }
          deltaPositive={
            summary.savingsRatePct !== null && lastMonthSavingsRate !== null
              ? summary.savingsRatePct >= lastMonthSavingsRate
              : undefined
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cash flow trend</CardTitle>
            <CardDescription>Net income minus expenses, last 6 months.</CardDescription>
          </CardHeader>
          <CardContent>
            <CashFlowChart data={trend} currency={currency} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Spending by category</CardTitle>
            <CardDescription>This month.</CardDescription>
          </CardHeader>
          <CardContent>
            {categories.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">No spending recorded this month.</p>
            ) : (
              <CategoryDonutChart data={categories} currency={currency} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>50/30/20 budget</CardTitle>
          <CardDescription>
            Needs, wants, and savings as a share of this month&apos;s income.{" "}
            <Link href="/budgets" className="text-foreground underline underline-offset-4">
              View details
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {budget.incomeMinor === 0 ? (
            <p className="text-muted-foreground text-sm">
              No income recorded this month — the 50/30/20 split needs income to compare against.
            </p>
          ) : (
            <BudgetGroupBars groups={budget.groups} currency={currency} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <RecentTransactionsList transactions={recent.transactions} />
        </CardContent>
      </Card>
    </div>
  );
}
