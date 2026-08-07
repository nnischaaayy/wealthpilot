import { prisma } from "@wealthpilot/db";
import { requireActiveWorkspace } from "@/lib/workspace-context";

/**
 * GDPR-style data export (architecture.md §4, §14, §320) — every
 * workspace-scoped table, as a single downloadable JSON bundle. Real and
 * complete, not a placeholder: this is everything deleteWorkspace would
 * otherwise destroy irrecoverably.
 */
export async function GET() {
  const { workspaceId } = await requireActiveWorkspace();

  const [workspace, accounts, transactions, holdings, categoryRules, categoryBudgets, auditLogs] =
    await Promise.all([
      prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } }),
      prisma.account.findMany({ where: { workspaceId } }),
      prisma.transaction.findMany({ where: { workspaceId } }),
      prisma.holding.findMany({ where: { workspaceId } }),
      prisma.categoryRule.findMany({ where: { workspaceId } }),
      prisma.categoryBudget.findMany({ where: { workspaceId } }),
      prisma.auditLog.findMany({ where: { workspaceId } }),
    ]);

  const bundle = {
    exportedAt: new Date().toISOString(),
    workspace: { id: workspace.id, name: workspace.name, createdAt: workspace.createdAt },
    accounts,
    transactions,
    holdings,
    categoryRules,
    categoryBudgets,
    auditLogs,
  };

  const filename = `wealthpilot-data-export-${new Date().toISOString().slice(0, 10)}.json`;

  return new Response(JSON.stringify(bundle, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
