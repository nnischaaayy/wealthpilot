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
});
