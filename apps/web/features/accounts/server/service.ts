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
