import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@wealthpilot/db";
import { listAccountsForWorkspace } from "@/features/accounts/server/service";
import {
  confirmMapping,
  listTransactions,
  updateTransactionCategory,
  uploadStatement,
} from "@/features/transactions/server/service";
import { getDashboardSummary, getCategoryBreakdown } from "@/features/dashboard/server/service";
import { listWorkspacesForUser } from "@/features/workspace/server/service";
import {
  createHolding,
  deleteHolding,
  getPortfolioAnalytics,
  listHoldings,
  updateHolding,
} from "@/features/portfolio/server/service";
import { deleteCategoryBudget, listCategoryBudgets, upsertCategoryBudget } from "@/features/budgets/server/service";
import { createTestWorkspace, cleanupWorkspace } from "./helpers";

// Every one of these exercises the same threat model: workspace A's context
// (its id, or a user who is only a member of A) must never see or mutate
// workspace B's data, even when handed a valid B-owned id. See
// architecture.md §14 — this is the automated cross-tenant-leak suite the
// testing plan (§15) requires running on every PR.
describe("tenant isolation (live Postgres)", () => {
  let a: Awaited<ReturnType<typeof createTestWorkspace>>;
  let b: Awaited<ReturnType<typeof createTestWorkspace>>;
  let bTransactionId: string;
  let bHoldingId: string;
  let bCategoryBudgetId: string;

  beforeAll(async () => {
    a = await createTestWorkspace("tenant-a");
    b = await createTestWorkspace("tenant-b");

    const outcome = await uploadStatement(
      b.workspace.id,
      b.account.id,
      "b-statement.csv",
      Buffer.from(
        ["Date,Narration,Amount", "01/03/2025,B SECRET MERCHANT,-500.00", "02/03/2025,B SALARY,20000.00"].join(
          "\n",
        ),
      ),
      randomUUID(),
    );
    const transaction = await prisma.transaction.findFirstOrThrow({
      where: { workspaceId: b.workspace.id, description: "B SECRET MERCHANT" },
    });
    bTransactionId = transaction.id;
    expect(outcome.status).toBe("done"); // sanity check the fixture uploaded

    const bHolding = await createHolding(b.workspace.id, b.user.id, {
      accountId: b.account.id,
      symbol: "BSECRET",
      quantity: 5,
      costBasis: 200,
      assetClass: "equity",
    });
    bHoldingId = bHolding.id;

    const bBudget = await upsertCategoryBudget(b.workspace.id, b.user.id, "dining", 20000, "USD");
    bCategoryBudgetId = bBudget.id;
  });

  afterAll(async () => {
    await cleanupWorkspace(a.workspace.id);
    await cleanupWorkspace(b.workspace.id);
    await prisma.$disconnect();
  });

  it("listAccountsForWorkspace never returns another workspace's accounts", async () => {
    const accounts = await listAccountsForWorkspace(a.workspace.id);
    expect(accounts.find((acc) => acc.id === b.account.id)).toBeUndefined();
  });

  it("listTransactions never returns another workspace's transactions", async () => {
    const { transactions, total } = await listTransactions(a.workspace.id, {
      page: 1,
      pageSize: 50,
      sort: "date-desc",
    });
    expect(total).toBe(0);
    expect(transactions.find((t) => t.id === bTransactionId)).toBeUndefined();
  });

  it("updateTransactionCategory rejects a transaction id from another workspace", async () => {
    await expect(
      updateTransactionCategory(a.workspace.id, bTransactionId, "shopping", false),
    ).rejects.toThrow();

    const untouched = await prisma.transaction.findUniqueOrThrow({ where: { id: bTransactionId } });
    expect(untouched.category).not.toBe("shopping");
  });

  it("confirmMapping rejects an upload job id from another workspace", async () => {
    const bJob = await uploadStatement(
      b.workspace.id,
      b.account.id,
      "ambiguous.csv",
      Buffer.from("Ref,Notes\nA1,text"),
      randomUUID(),
    );
    expect(bJob.status).toBe("mapping_required");

    await expect(
      confirmMapping(a.workspace.id, bJob.jobId, {
        dateColumn: 0,
        descriptionColumn: 1,
        amountColumn: 1,
        dateFormat: "day-first",
      }),
    ).rejects.toThrow();
  });

  it("getDashboardSummary for workspace A excludes workspace B's amounts", async () => {
    const summary = await getDashboardSummary(a.workspace.id);
    // A has no accounts/transactions of its own — B's ₹19,500 net must not leak in.
    expect(summary.hasTransactions).toBe(false);
    expect(summary.netWorthMinor).toBe(0);
  });

  it("getCategoryBreakdown (groupBy query) stays scoped to the requesting workspace", async () => {
    const breakdown = await getCategoryBreakdown(a.workspace.id, "USD");
    expect(breakdown).toEqual([]);
  });

  it("listWorkspacesForUser only returns workspaces the user is a member of", async () => {
    const workspaces = await listWorkspacesForUser(a.user.id);
    expect(workspaces.find((w) => w.id === b.workspace.id)).toBeUndefined();
    expect(workspaces.find((w) => w.id === a.workspace.id)).toBeDefined();
  });

  it("listHoldings never returns another workspace's holdings", async () => {
    const holdings = await listHoldings(a.workspace.id);
    expect(holdings.find((h) => h.id === bHoldingId)).toBeUndefined();
  });

  it("createHolding rejects an account id from another workspace", async () => {
    await expect(
      createHolding(a.workspace.id, a.user.id, {
        accountId: b.account.id,
        symbol: "HACK",
        quantity: 1,
        costBasis: 1,
        assetClass: "equity",
      }),
    ).rejects.toThrow();
  });

  it("updateHolding rejects a holding id from another workspace", async () => {
    await expect(
      updateHolding(a.workspace.id, a.user.id, bHoldingId, {
        accountId: a.account.id,
        symbol: "HACKED",
        quantity: 1,
        costBasis: 1,
        assetClass: "equity",
      }),
    ).rejects.toThrow();

    const untouched = await prisma.holding.findUniqueOrThrow({ where: { id: bHoldingId } });
    expect(untouched.symbol).toBe("BSECRET");
  });

  it("deleteHolding rejects a holding id from another workspace", async () => {
    await expect(deleteHolding(a.workspace.id, a.user.id, bHoldingId)).rejects.toThrow();

    const stillThere = await prisma.holding.findUnique({ where: { id: bHoldingId } });
    expect(stillThere).not.toBeNull();
  });

  it("getPortfolioAnalytics for workspace A excludes workspace B's holdings", async () => {
    const analytics = await getPortfolioAnalytics(a.workspace.id);
    expect(analytics.hasHoldings).toBe(false);
    expect(analytics.holdings).toEqual([]);
  });

  it("listCategoryBudgets never returns another workspace's budgets", async () => {
    const budgets = await listCategoryBudgets(a.workspace.id);
    expect(budgets.find((budget) => budget.id === bCategoryBudgetId)).toBeUndefined();
  });

  it("deleteCategoryBudget rejects a budget id from another workspace", async () => {
    await expect(
      deleteCategoryBudget(a.workspace.id, a.user.id, bCategoryBudgetId),
    ).rejects.toThrow();

    const stillThere = await prisma.categoryBudget.findUnique({ where: { id: bCategoryBudgetId } });
    expect(stillThere).not.toBeNull();
  });
});
