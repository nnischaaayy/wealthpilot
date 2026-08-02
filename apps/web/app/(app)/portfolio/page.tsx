import type { Metadata } from "next";
import { LineChart, Plus } from "lucide-react";
import { requireActiveWorkspace } from "@/lib/workspace-context";
import { formatMoney } from "@/lib/format-money";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/layout/empty-state";
import { listAccountsForWorkspace } from "@/features/accounts/server/service";
import { listHoldings, getPortfolioAnalytics } from "@/features/portfolio/server/service";
import { getRiskLabel } from "@/features/portfolio/lib/analytics";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { AllocationDonutChart } from "@/features/portfolio/components/allocation-donut-chart";
import { PortfolioHoldingsTable } from "@/features/portfolio/components/portfolio-holdings-table";
import { HoldingEditDialog } from "@/features/portfolio/components/holding-edit-dialog";

export const metadata: Metadata = { title: "Portfolio — WealthPilot" };

export default async function PortfolioPage() {
  const { workspaceId } = await requireActiveWorkspace();

  const [accounts, holdings, analytics] = await Promise.all([
    listAccountsForWorkspace(workspaceId),
    listHoldings(workspaceId),
    getPortfolioAnalytics(workspaceId),
  ]);

  const addButton = (
    <Button disabled={accounts.length === 0}>
      <Plus className="size-4" />
      Add holding
    </Button>
  );

  if (!analytics.hasHoldings) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">Portfolio</h1>
          {accounts.length > 0 && <HoldingEditDialog accounts={accounts} trigger={addButton} />}
        </div>
        <EmptyState
          icon={LineChart}
          title="No holdings yet"
          description={
            accounts.length === 0
              ? "Add an account on the Transactions page first, then add your holdings here."
              : "Add your stocks, funds, or crypto to see allocation, performance, and a risk score."
          }
          actionLabel={accounts.length === 0 ? "Go to Transactions" : undefined}
          actionHref={accounts.length === 0 ? "/transactions" : undefined}
        />
      </div>
    );
  }

  const currency = analytics.currency!;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Portfolio</h1>
        <HoldingEditDialog accounts={accounts} trigger={addButton} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Total value" value={formatMoney(analytics.summary.totalValueMinor, currency)} />
        <KpiCard
          label="Total gain/loss"
          value={formatMoney(analytics.summary.totalGainLossMinor, currency)}
          deltaLabel={analytics.summary.totalGainLossPct !== null ? `${analytics.summary.totalGainLossPct}%` : undefined}
          deltaPositive={analytics.summary.totalGainLossMinor >= 0}
        />
        <KpiCard
          label="Risk score"
          value={analytics.summary.riskScore !== null ? `${analytics.summary.riskScore} / 10` : "—"}
          deltaLabel={getRiskLabel(analytics.summary.riskScore)}
        />
      </div>

      {!analytics.summary.hasLivePricing && (
        <p className="text-muted-foreground text-xs">
          Value and gain/loss are estimated at cost basis for holdings without a manually-entered
          current price. Edit a holding to add one.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Allocation by holding</CardTitle>
            <CardDescription>Share of portfolio value.</CardDescription>
          </CardHeader>
          <CardContent>
            <AllocationDonutChart
              data={analytics.allocationByHolding}
              currency={currency}
              caption="Portfolio allocation by holding"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Allocation by asset class</CardTitle>
            <CardDescription>Diversification across asset types.</CardDescription>
          </CardHeader>
          <CardContent>
            <AllocationDonutChart
              data={analytics.allocationByAssetClass}
              currency={currency}
              caption="Portfolio allocation by asset class"
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Holdings</CardTitle>
        </CardHeader>
        <CardContent>
          <PortfolioHoldingsTable holdings={holdings} analytics={analytics.holdings} accounts={accounts} />
        </CardContent>
      </Card>
    </div>
  );
}
