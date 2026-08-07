import { describe, expect, it } from "vitest";
import { prisma } from "@wealthpilot/db";
import { buildPeriodReport } from "@/features/exports/server/report";
import { createTestWorkspace, cleanupWorkspace } from "./helpers";

describe("buildPeriodReport (live Postgres)", () => {
  it("returns null for a workspace with no transactions", async () => {
    const { workspace } = await createTestWorkspace("exports-empty");
    try {
      expect(await buildPeriodReport(workspace.id)).toBeNull();
    } finally {
      await cleanupWorkspace(workspace.id);
    }
  });

  it("aggregates KPIs, budget groups, and categories from real transactions", async () => {
    const { workspace, account } = await createTestWorkspace("exports");
    try {
      await prisma.transaction.createMany({
        data: [
          {
            workspaceId: workspace.id,
            accountId: account.id,
            postedAt: new Date(),
            amountMinor: 300_000,
            currency: "USD",
            description: "Salary",
            category: "income",
          },
          {
            workspaceId: workspace.id,
            accountId: account.id,
            postedAt: new Date(),
            amountMinor: -100_000,
            currency: "USD",
            description: "Rent",
            category: "housing",
          },
          {
            workspaceId: workspace.id,
            accountId: account.id,
            postedAt: new Date(),
            amountMinor: -30_000,
            currency: "USD",
            description: "Dinner",
            category: "dining",
          },
        ],
      });

      const report = await buildPeriodReport(workspace.id);
      expect(report).not.toBeNull();
      expect(report!.currency).toBe("USD");
      expect(report!.monthIncomeMinor).toBe(300_000);
      expect(report!.monthExpensesMinor).toBe(130_000);
      expect(report!.monthNetMinor).toBe(170_000);
      expect(report!.categories.map((c) => c.label)).toEqual(
        expect.arrayContaining(["Housing", "Dining"]),
      );
      const needsGroup = report!.budgetGroups.find((g) => g.label === "Needs");
      expect(needsGroup?.spentMinor).toBe(100_000);
    } finally {
      await cleanupWorkspace(workspace.id);
    }
  });
});
