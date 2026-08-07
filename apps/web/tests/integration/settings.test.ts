import { describe, expect, it } from "vitest";
import { prisma } from "@wealthpilot/db";
import { deleteAccount, renameAccount } from "@/features/accounts/server/service";
import { deleteWorkspace, setAiEnabled } from "@/features/workspace/server/service";
import { createTestWorkspace, cleanupWorkspace } from "./helpers";

describe("settings: accounts (live Postgres)", () => {
  it("renames an account and audit-logs it", async () => {
    const { workspace, user, account } = await createTestWorkspace("settings-accounts");
    try {
      const renamed = await renameAccount(workspace.id, user.id, account.id, "New name");
      expect(renamed.name).toBe("New name");

      const log = await prisma.auditLog.findFirst({
        where: { workspaceId: workspace.id, action: "account.rename" },
      });
      expect(log?.entityId).toBe(account.id);
    } finally {
      await cleanupWorkspace(workspace.id);
    }
  });

  it("rejects renaming an account from another workspace", async () => {
    const a = await createTestWorkspace("settings-accounts-a");
    const b = await createTestWorkspace("settings-accounts-b");
    try {
      await expect(renameAccount(a.workspace.id, a.user.id, b.account.id, "hijacked")).rejects.toThrow();
    } finally {
      await cleanupWorkspace(a.workspace.id);
      await cleanupWorkspace(b.workspace.id);
    }
  });

  it("rejects deleting an account from another workspace", async () => {
    const a = await createTestWorkspace("settings-accounts-delete-a");
    const b = await createTestWorkspace("settings-accounts-delete-b");
    try {
      await expect(deleteAccount(a.workspace.id, a.user.id, b.account.id)).rejects.toThrow();
      expect(await prisma.account.findUnique({ where: { id: b.account.id } })).not.toBeNull();
    } finally {
      await cleanupWorkspace(a.workspace.id);
      await cleanupWorkspace(b.workspace.id);
    }
  });

  it("deleting an account cascades its transactions", async () => {
    const { workspace, user, account } = await createTestWorkspace("settings-accounts-cascade");
    try {
      await prisma.transaction.create({
        data: {
          workspaceId: workspace.id,
          accountId: account.id,
          postedAt: new Date(),
          amountMinor: -1000,
          currency: "USD",
          description: "test",
          category: "other",
        },
      });

      await deleteAccount(workspace.id, user.id, account.id);

      const remainingAccount = await prisma.account.findUnique({ where: { id: account.id } });
      const remainingTransactions = await prisma.transaction.findMany({ where: { accountId: account.id } });
      expect(remainingAccount).toBeNull();
      expect(remainingTransactions).toEqual([]);
    } finally {
      await cleanupWorkspace(workspace.id);
    }
  });
});

describe("settings: workspace AI toggle and delete (live Postgres)", () => {
  it("toggles aiEnabled and audit-logs it", async () => {
    const { workspace, user } = await createTestWorkspace("settings-ai-toggle");
    try {
      await setAiEnabled(workspace.id, user.id, false);
      const updated = await prisma.workspace.findUniqueOrThrow({ where: { id: workspace.id } });
      expect(updated.aiEnabled).toBe(false);

      const log = await prisma.auditLog.findFirst({
        where: { workspaceId: workspace.id, action: "workspace.ai_toggle" },
      });
      expect(log?.metadataJson).toEqual({ enabled: false });
    } finally {
      await cleanupWorkspace(workspace.id);
    }
  });

  it("defaults aiEnabled to true for a new workspace", async () => {
    const { workspace } = await createTestWorkspace("settings-ai-default");
    try {
      expect(workspace.aiEnabled).toBe(true);
    } finally {
      await cleanupWorkspace(workspace.id);
    }
  });

  it("deleteWorkspace cascades every workspace-scoped table", async () => {
    const { workspace, account } = await createTestWorkspace("settings-delete-cascade");
    await prisma.transaction.create({
      data: {
        workspaceId: workspace.id,
        accountId: account.id,
        postedAt: new Date(),
        amountMinor: -1000,
        currency: "USD",
        description: "test",
        category: "other",
      },
    });

    await deleteWorkspace(workspace.id);

    expect(await prisma.workspace.findUnique({ where: { id: workspace.id } })).toBeNull();
    expect(await prisma.account.findUnique({ where: { id: account.id } })).toBeNull();
    expect(await prisma.transaction.findMany({ where: { workspaceId: workspace.id } })).toEqual([]);
  });
});
