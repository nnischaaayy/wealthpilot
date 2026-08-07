import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@wealthpilot/db";
import {
  deleteCategoryBudget,
  listCategoryBudgets,
  sendDueBudgetAlerts,
  upsertCategoryBudget,
} from "@/features/budgets/server/service";
import { EmailClient, type EmailBackend, type EmailMessage } from "@/lib/email";
import { createTestWorkspace, cleanupWorkspace } from "./helpers";

class RecordingEmailBackend implements EmailBackend {
  sent: EmailMessage[] = [];
  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }
}

describe("category budgets (live Postgres)", () => {
  let workspaceId: string;
  let userId: string;
  let accountId: string;

  beforeEach(async () => {
    const ctx = await createTestWorkspace("budgets");
    workspaceId = ctx.workspace.id;
    userId = ctx.user.id;
    accountId = ctx.account.id;

    await prisma.transaction.create({
      data: {
        workspaceId,
        accountId,
        postedAt: new Date(),
        amountMinor: -15000, // spent $150 on dining
        currency: "USD",
        description: "Dinner",
        category: "dining",
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates a budget and computes spend/status against real transactions", async () => {
    await upsertCategoryBudget(workspaceId, userId, "dining", 20000, "USD"); // $200 limit

    const budgets = await listCategoryBudgets(workspaceId);
    expect(budgets).toHaveLength(1);
    expect(budgets[0].category).toBe("dining");
    expect(budgets[0].spentMinor).toBe(15000);
    expect(budgets[0].pct).toBe(75); // 15000/20000
    expect(budgets[0].status).toBe("ok");

    await cleanupWorkspace(workspaceId);
  });

  it("flags warning at >=90% and over at >100%", async () => {
    await upsertCategoryBudget(workspaceId, userId, "dining", 16000, "USD"); // 15000/16000 = 93.75%
    let budgets = await listCategoryBudgets(workspaceId);
    expect(budgets[0].status).toBe("warning");

    await upsertCategoryBudget(workspaceId, userId, "dining", 10000, "USD"); // 15000/10000 = 150%
    budgets = await listCategoryBudgets(workspaceId);
    expect(budgets[0].status).toBe("over");

    await cleanupWorkspace(workspaceId);
  });

  it("upsert updates the existing row instead of creating a duplicate", async () => {
    await upsertCategoryBudget(workspaceId, userId, "dining", 20000, "USD");
    await upsertCategoryBudget(workspaceId, userId, "dining", 30000, "USD");

    const budgets = await listCategoryBudgets(workspaceId);
    expect(budgets).toHaveLength(1);
    expect(budgets[0].limitMinor).toBe(30000);

    await cleanupWorkspace(workspaceId);
  });

  it("deletes a budget and rejects deleting one from another workspace", async () => {
    const budget = await upsertCategoryBudget(workspaceId, userId, "dining", 20000, "USD");

    const other = await createTestWorkspace("budgets-other");
    await expect(deleteCategoryBudget(other.workspace.id, other.user.id, budget.id)).rejects.toThrow();
    await cleanupWorkspace(other.workspace.id);

    await deleteCategoryBudget(workspaceId, userId, budget.id);
    expect(await listCategoryBudgets(workspaceId)).toEqual([]);

    await cleanupWorkspace(workspaceId);
  });

  it("emails at most once per calendar month for an over-limit category", async () => {
    await upsertCategoryBudget(workspaceId, userId, "dining", 10000, "USD"); // over: 15000/10000

    const backend = new RecordingEmailBackend();
    const emailClient = new EmailClient(backend);

    await sendDueBudgetAlerts(workspaceId, "user@example.test", emailClient);
    expect(backend.sent).toHaveLength(1);
    expect(backend.sent[0].to).toBe("user@example.test");
    expect(backend.sent[0].subject).toContain("Dining");

    // Second check in the same month must not send again.
    await sendDueBudgetAlerts(workspaceId, "user@example.test", emailClient);
    expect(backend.sent).toHaveLength(1);

    await cleanupWorkspace(workspaceId);
  });

  it("does not email a category that is within budget", async () => {
    await upsertCategoryBudget(workspaceId, userId, "dining", 20000, "USD"); // ok: 75%

    const backend = new RecordingEmailBackend();
    await sendDueBudgetAlerts(workspaceId, "user@example.test", new EmailClient(backend));
    expect(backend.sent).toHaveLength(0);

    await cleanupWorkspace(workspaceId);
  });
});
