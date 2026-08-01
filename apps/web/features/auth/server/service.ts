import "server-only";
import { prisma } from "@wealthpilot/db";

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super("An account with this email already exists.");
    this.name = "EmailAlreadyRegisteredError";
  }
}

interface CreateUserWithWorkspaceInput {
  name: string;
  email: string;
  passwordHash: string;
}

/**
 * Creates a user, their default owner-role workspace, and the audit trail
 * entry in a single transaction — used by the credentials signup flow.
 */
export async function createUserWithWorkspace({
  name,
  email,
  passwordHash,
}: CreateUserWithWorkspaceInput) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new EmailAlreadyRegisteredError();
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name, email, passwordHash },
    });

    const workspace = await tx.workspace.create({
      data: { name: `${name}'s Workspace` },
    });

    await tx.workspaceMember.create({
      data: { workspaceId: workspace.id, userId: user.id, role: "owner" },
    });

    await tx.auditLog.create({
      data: {
        workspaceId: workspace.id,
        actorUserId: user.id,
        action: "user.signup",
        entityType: "User",
        entityId: user.id,
        metadataJson: { method: "credentials" },
      },
    });

    return { userId: user.id, workspaceId: workspace.id };
  });
}

/**
 * Finds or creates a user for an OAuth sign-in (e.g. Google), provisioning a
 * default workspace on first login. Idempotent — safe to call on every sign-in.
 */
export async function getOrCreateOAuthUser({ name, email }: { name: string; email: string }) {
  const existing = await prisma.user.findUnique({
    where: { email },
    include: { memberships: { orderBy: { createdAt: "asc" }, take: 1 } },
  });

  if (existing) {
    const workspaceId = existing.memberships[0]?.workspaceId;
    if (workspaceId) {
      return { userId: existing.id, workspaceId };
    }
    // Edge case: user row exists with no workspace membership — provision one.
    return provisionDefaultWorkspace(existing.id, existing.name ?? name);
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { name, email, passwordHash: null } });
    const workspace = await tx.workspace.create({ data: { name: `${name}'s Workspace` } });
    await tx.workspaceMember.create({
      data: { workspaceId: workspace.id, userId: user.id, role: "owner" },
    });
    await tx.auditLog.create({
      data: {
        workspaceId: workspace.id,
        actorUserId: user.id,
        action: "user.signup",
        entityType: "User",
        entityId: user.id,
        metadataJson: { method: "google" },
      },
    });
    return { userId: user.id, workspaceId: workspace.id };
  });
}

async function provisionDefaultWorkspace(userId: string, name: string) {
  return prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({ data: { name: `${name}'s Workspace` } });
    await tx.workspaceMember.create({
      data: { workspaceId: workspace.id, userId, role: "owner" },
    });
    return { userId, workspaceId: workspace.id };
  });
}

export async function recordLoginAudit(userId: string, workspaceId: string) {
  await prisma.auditLog.create({
    data: {
      workspaceId,
      actorUserId: userId,
      action: "user.login",
      entityType: "User",
      entityId: userId,
    },
  });
}
