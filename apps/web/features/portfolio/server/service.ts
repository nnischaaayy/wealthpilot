import "server-only";
import { prisma } from "@wealthpilot/db";
import type { HoldingInput } from "@/lib/validations/holding";
import {
  analyzeHolding,
  computeAllocationByAssetClass,
  computeAllocationByHolding,
  computePortfolioSummary,
  type AllocationSlice,
  type HoldingAnalytics,
  type PortfolioSummary,
} from "@/features/portfolio/lib/analytics";

export function listHoldings(workspaceId: string) {
  return prisma.holding.findMany({
    where: { workspaceId },
    include: { account: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
}

function toMinor(amount: number): number {
  return Math.round(amount * 100);
}

export async function createHolding(workspaceId: string, actorUserId: string, input: HoldingInput) {
  const account = await prisma.account.findFirst({ where: { id: input.accountId, workspaceId } });
  if (!account) throw new Error("Account not found in this workspace.");

  return prisma.$transaction(async (tx) => {
    const holding = await tx.holding.create({
      data: {
        workspaceId,
        accountId: input.accountId,
        symbol: input.symbol,
        name: input.name || null,
        quantity: input.quantity,
        costBasisMinor: toMinor(input.costBasis),
        currentPriceMinor: input.currentPrice !== undefined ? toMinor(input.currentPrice) : null,
        currency: account.currency,
        assetClass: input.assetClass,
      },
    });
    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId,
        action: "holding.create",
        entityType: "Holding",
        entityId: holding.id,
        metadataJson: { symbol: holding.symbol, quantity: holding.quantity },
      },
    });
    return holding;
  });
}

export async function updateHolding(
  workspaceId: string,
  actorUserId: string,
  holdingId: string,
  input: HoldingInput,
) {
  const existing = await prisma.holding.findFirst({ where: { id: holdingId, workspaceId } });
  if (!existing) throw new Error("Holding not found in this workspace.");
  const account = await prisma.account.findFirst({ where: { id: input.accountId, workspaceId } });
  if (!account) throw new Error("Account not found in this workspace.");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.holding.update({
      where: { id: holdingId },
      data: {
        accountId: input.accountId,
        symbol: input.symbol,
        name: input.name || null,
        quantity: input.quantity,
        costBasisMinor: toMinor(input.costBasis),
        currentPriceMinor: input.currentPrice !== undefined ? toMinor(input.currentPrice) : null,
        currency: account.currency,
        assetClass: input.assetClass,
      },
    });
    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId,
        action: "holding.update",
        entityType: "Holding",
        entityId: updated.id,
        metadataJson: { symbol: updated.symbol },
      },
    });
    return updated;
  });
}

export async function deleteHolding(workspaceId: string, actorUserId: string, holdingId: string) {
  const existing = await prisma.holding.findFirst({ where: { id: holdingId, workspaceId } });
  if (!existing) throw new Error("Holding not found in this workspace.");

  await prisma.$transaction(async (tx) => {
    await tx.holding.delete({ where: { id: holdingId } });
    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId,
        action: "holding.delete",
        entityType: "Holding",
        entityId: holdingId,
        metadataJson: { symbol: existing.symbol },
      },
    });
  });
}

export interface PortfolioAnalyticsResult {
  currency: string | null;
  hasHoldings: boolean;
  holdings: HoldingAnalytics[];
  allocationByHolding: AllocationSlice[];
  allocationByAssetClass: AllocationSlice[];
  summary: PortfolioSummary;
}

/** Same "pick the most common currency" pattern as the dashboard — full multi-currency support is out of scope for v1 (architecture.md §1.3). */
export async function getPortfolioAnalytics(workspaceId: string): Promise<PortfolioAnalyticsResult> {
  const rows = await listHoldings(workspaceId);
  if (rows.length === 0) {
    return {
      currency: null,
      hasHoldings: false,
      holdings: [],
      allocationByHolding: [],
      allocationByAssetClass: [],
      summary: computePortfolioSummary([]),
    };
  }

  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.currency, (counts.get(r.currency) ?? 0) + 1);
  const currency = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];

  const holdings = rows.filter((r) => r.currency === currency).map((r) => analyzeHolding(r));

  return {
    currency,
    hasHoldings: holdings.length > 0,
    holdings,
    allocationByHolding: computeAllocationByHolding(holdings),
    allocationByAssetClass: computeAllocationByAssetClass(holdings),
    summary: computePortfolioSummary(holdings),
  };
}
