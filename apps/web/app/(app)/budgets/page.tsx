import type { Metadata } from "next";
import { PiggyBank } from "lucide-react";
import { requireActiveWorkspace } from "@/lib/workspace-context";
import { formatMoney } from "@/lib/format-money";
import { getCategoryGroup, type BudgetGroup } from "@/lib/categories";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/layout/empty-state";
import {
  getBudgetGroups,
  getCategoryBreakdownFull,
  getDashboardSummary,
} from "@/features/dashboard/server/service";
import { BudgetGroupBars } from "@/features/dashboard/components/budget-group-bars";

export const metadata: Metadata = { title: "Budgets — WealthPilot" };

const GROUP_ORDER: Extract<BudgetGroup, "needs" | "wants" | "savings">[] = ["needs", "wants", "savings"];

export default async function BudgetsPage() {
  const { workspaceId } = await requireActiveWorkspace();
  const summary = await getDashboardSummary(workspaceId);

  if (!summary.hasTransactions || !summary.currency) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">Budgets</h1>
        <EmptyState
          icon={PiggyBank}
          title="No transactions yet"
          description="Upload a bank statement to see your 50/30/20 budget breakdown here."
          actionLabel="Upload a statement"
          actionHref="/transactions"
        />
      </div>
    );
  }

  const currency = summary.currency;
  const [budget, categories] = await Promise.all([
    getBudgetGroups(workspaceId, currency),
    getCategoryBreakdownFull(workspaceId, currency),
  ]);

  const categoriesByGroup = new Map<string, typeof categories>();
  for (const group of GROUP_ORDER) categoriesByGroup.set(group, []);
  for (const c of categories) {
    const group = getCategoryGroup(c.category);
    if (group === "needs" || group === "wants" || group === "savings") {
      categoriesByGroup.get(group)!.push(c);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Budgets</h1>
        <p className="text-muted-foreground text-sm">
          The 50/30/20 rule: needs, wants, and savings as a share of this month&apos;s income
          ({formatMoney(budget.incomeMinor, currency)}).
        </p>
      </div>

      {budget.incomeMinor === 0 ? (
        <p className="text-muted-foreground text-sm">
          No income recorded this month — the 50/30/20 split needs income to compare against.
        </p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>This month</CardTitle>
          </CardHeader>
          <CardContent>
            <BudgetGroupBars groups={budget.groups} currency={currency} />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {budget.groups.map((g) => {
          const groupCategories = categoriesByGroup.get(g.group) ?? [];
          return (
            <Card key={g.group}>
              <CardHeader>
                <CardTitle>{g.label}</CardTitle>
                <CardDescription>{formatMoney(g.spentMinor, currency)} spent this month</CardDescription>
              </CardHeader>
              <CardContent>
                {groupCategories.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nothing in this group yet.</p>
                ) : (
                  <ul className="flex flex-col gap-2 text-sm">
                    {groupCategories.map((c) => (
                      <li key={c.category} className="flex items-center justify-between gap-2">
                        <span className="truncate">{c.label}</span>
                        <span className="tabular-nums">{formatMoney(c.amountMinor, currency)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-muted-foreground text-xs">
        Configurable per-category limits and threshold alerts land in Phase 7.
      </p>
    </div>
  );
}
