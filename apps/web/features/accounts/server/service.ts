import "server-only";
import { prisma } from "@wealthpilot/db";
import type { CreateAccountInput } from "@/lib/validations/account";

export function listAccountsForWorkspace(workspaceId: string) {
  return prisma.account.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
  });
}

export async function createAccount(
  workspaceId: string,
  actorUserId: string,
  input: CreateAccountInput,
) {
  return prisma.$transaction(async (tx) => {
    const account = await tx.account.create({
      data: {
        workspaceId,
        name: input.name,
        institution: input.institution || null,
        type: input.type,
        currency: input.currency,
      },
    });

    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId,
        action: "account.create",
        entityType: "Account",
        entityId: account.id,
        metadataJson: { name: account.name, type: account.type },
      },
    });

    return account;
  });
}

export async function renameAccount(
  workspaceId: string,
  actorUserId: string,
  accountId: string,
  name: string,
) {
  const existing = await prisma.account.findFirst({ where: { id: accountId, workspaceId } });
  if (!existing) throw new Error("Account not found in this workspace.");

  return prisma.$transaction(async (tx) => {
    const account = await tx.account.update({ where: { id: accountId }, data: { name } });
    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId,
        action: "account.rename",
        entityType: "Account",
        entityId: accountId,
        metadataJson: { from: existing.name, to: name },
      },
    });
    return account;
  });
}

/** Cascades to the account's transactions, holdings, and upload jobs (schema onDelete: Cascade). */
export async function deleteAccount(
  workspaceId: string,
  actorUserId: string,
  accountId: string,
): Promise<void> {
  const existing = await prisma.account.findFirst({ where: { id: accountId, workspaceId } });
  if (!existing) throw new Error("Account not found in this workspace.");

  await prisma.$transaction(async (tx) => {
    await tx.account.delete({ where: { id: accountId } });
    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId,
        action: "account.delete",
        entityType: "Account",
        entityId: accountId,
        metadataJson: { name: existing.name },
      },
    });
  });
}
