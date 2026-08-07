import "server-only";
import { prisma } from "@wealthpilot/db";
import type { CategoryBudget } from "@wealthpilot/db";
import { getCategoryLabel } from "@/lib/categories";
import { getMonthRange, monthKey } from "@/lib/date-range";
import { EmailClient } from "@/lib/email";

export type BudgetAlertStatus = "ok" | "warning" | "over";

export interface CategoryBudgetWithSpend {
  id: string;
  category: string;
  label: string;
  limitMinor: number;
  currency: string;
  spentMinor: number;
  pct: number;
  status: BudgetAlertStatus;
}

const WARNING_THRESHOLD_PCT = 90;

function statusFor(pct: number): BudgetAlertStatus {
  if (pct > 100) return "over";
  if (pct >= WARNING_THRESHOLD_PCT) return "warning";
  return "ok";
}

async function budgetsWithSpend(
  workspaceId: string,
): Promise<{ row: CategoryBudget; spentMinor: number; pct: number; status: BudgetAlertStatus }[]> {
  const budgets = await prisma.categoryBudget.findMany({
    where: { workspaceId },
    orderBy: { category: "asc" },
  });
  if (budgets.length === 0) return [];

  const { start, end } = getMonthRange(0);
  const spend = await prisma.transaction.groupBy({
    by: ["category"],
    where: {
      workspaceId,
      amountMinor: { lt: 0 },
      postedAt: { gte: start, lt: end },
      category: { in: budgets.map((b) => b.category) },
    },
    _sum: { amountMinor: true },
  });
  const spendByCategory = new Map(spend.map((s) => [s.category, Math.abs(s._sum.amountMinor ?? 0)]));

  return budgets.map((row) => {
    const spentMinor = spendByCategory.get(row.category) ?? 0;
    const pct = row.limitMinor > 0 ? Math.round((spentMinor / row.limitMinor) * 100) : 0;
    return { row, spentMinor, pct, status: statusFor(pct) };
  });
}

export async function listCategoryBudgets(workspaceId: string): Promise<CategoryBudgetWithSpend[]> {
  const withSpend = await budgetsWithSpend(workspaceId);
  return withSpend.map(({ row, spentMinor, pct, status }) => ({
    id: row.id,
    category: row.category,
    label: getCategoryLabel(row.category),
    limitMinor: row.limitMinor,
    currency: row.currency,
    spentMinor,
    pct,
    status,
  }));
}

export async function upsertCategoryBudget(
  workspaceId: string,
  actorUserId: string,
  category: string,
  limitMinor: number,
  currency: string,
): Promise<CategoryBudget> {
  return prisma.$transaction(async (tx) => {
    const budget = await tx.categoryBudget.upsert({
      where: { workspaceId_category: { workspaceId, category } },
      update: { limitMinor, currency },
      create: { workspaceId, category, limitMinor, currency },
    });
    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId,
        action: "category_budget.set",
        entityType: "CategoryBudget",
        entityId: budget.id,
        metadataJson: { category, limitMinor },
      },
    });
    return budget;
  });
}

export async function deleteCategoryBudget(
  workspaceId: string,
  actorUserId: string,
  id: string,
): Promise<void> {
  const existing = await prisma.categoryBudget.findFirst({ where: { id, workspaceId } });
  if (!existing) throw new Error("Budget not found in this workspace.");

  await prisma.$transaction(async (tx) => {
    await tx.categoryBudget.delete({ where: { id } });
    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId,
        action: "category_budget.delete",
        entityType: "CategoryBudget",
        entityId: id,
        metadataJson: { category: existing.category },
      },
    });
  });
}

/**
 * Emails at most once per calendar month per over-limit category. There's no
 * job scheduler in v1, so this runs on-demand whenever the Budgets page
 * loads, deduped by CategoryBudget.lastAlertedMonth — visiting the page
 * twice in the same month won't send a second email.
 */
export async function sendDueBudgetAlerts(
  workspaceId: string,
  recipientEmail: string,
  emailClient: EmailClient = new EmailClient(),
): Promise<void> {
  const withSpend = await budgetsWithSpend(workspaceId);
  const currentMonth = monthKey(new Date());

  for (const { row, spentMinor } of withSpend) {
    if (statusFor(row.limitMinor > 0 ? Math.round((spentMinor / row.limitMinor) * 100) : 0) !== "over") {
      continue;
    }
    if (row.lastAlertedMonth === currentMonth) continue;

    const label = getCategoryLabel(row.category);
    await emailClient.send({
      to: recipientEmail,
      subject: `Over budget: ${label}`,
      html: `<p>You've spent ${(spentMinor / 100).toFixed(2)} ${row.currency} on <strong>${label}</strong> this month, over your ${(row.limitMinor / 100).toFixed(2)} ${row.currency} limit.</p>`,
    });
    await prisma.categoryBudget.update({
      where: { id: row.id },
      data: { lastAlertedMonth: currentMonth },
    });
  }
}
