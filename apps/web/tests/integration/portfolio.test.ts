import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@wealthpilot/db";
import {
  createHolding,
  deleteHolding,
  getPortfolioAnalytics,
  listHoldings,
  updateHolding,
} from "@/features/portfolio/server/service";
import { createTestWorkspace, cleanupWorkspace } from "./helpers";

describe("portfolio holdings (live Postgres)", () => {
  let workspaceId: string;
  let userId: string;
  let accountId: string;

  beforeAll(async () => {
    const ctx = await createTestWorkspace("portfolio");
    workspaceId = ctx.workspace.id;
    userId = ctx.user.id;
    accountId = ctx.account.id;
  });

  afterAll(async () => {
    await cleanupWorkspace(workspaceId);
    await prisma.$disconnect();
  });

  it("creates a holding and computes analytics at cost basis when no current price is set", async () => {
    // Symbol uppercasing happens in the zod schema (lib/validations/holding.ts),
    // not the service — the service trusts its already-validated input.
    const holding = await createHolding(workspaceId, userId, {
      accountId,
      symbol: "AAPL",
      quantity: 10,
      costBasis: 150,
      assetClass: "equity",
    });
    expect(holding.symbol).toBe("AAPL");
    expect(holding.costBasisMinor).toBe(15000);
    expect(holding.currentPriceMinor).toBeNull();

    const analytics = await getPortfolioAnalytics(workspaceId);
    expect(analytics.hasHoldings).toBe(true);
    expect(analytics.summary.totalValueMinor).toBe(150000); // at cost, no live price yet
    expect(analytics.summary.hasLivePricing).toBe(false);
    expect(analytics.allocationByAssetClass.find((a) => a.key === "equity")?.pct).toBe(100);
  });

  it("updates a holding's current price and reflects gain/loss", async () => {
    const [existing] = await listHoldings(workspaceId);
    await updateHolding(workspaceId, userId, existing.id, {
      accountId,
      symbol: existing.symbol,
      quantity: existing.quantity,
      costBasis: existing.costBasisMinor / 100,
      currentPrice: 180,
      assetClass: "equity",
    });

    const analytics = await getPortfolioAnalytics(workspaceId);
    expect(analytics.summary.hasLivePricing).toBe(true);
    expect(analytics.summary.totalValueMinor).toBe(180000);
    expect(analytics.summary.totalGainLossMinor).toBe(30000);
  });

  it("rejects creating a holding against an account from another workspace", async () => {
    const other = await createTestWorkspace("other-portfolio");
    try {
      await expect(
        createHolding(workspaceId, userId, {
          accountId: other.account.id,
          symbol: "MSFT",
          quantity: 1,
          costBasis: 100,
          assetClass: "equity",
        }),
      ).rejects.toThrow();
    } finally {
      await cleanupWorkspace(other.workspace.id);
    }
  });

  it("deletes a holding", async () => {
    const [existing] = await listHoldings(workspaceId);
    await deleteHolding(workspaceId, userId, existing.id);

    const analytics = await getPortfolioAnalytics(workspaceId);
    expect(analytics.hasHoldings).toBe(false);
  });
});
