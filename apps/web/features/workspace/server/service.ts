import "server-only";
import { prisma } from "@wealthpilot/db";

export interface WorkspaceSummary {
  id: string;
  name: string;
  role: "owner" | "member";
}

export async function listWorkspacesForUser(userId: string): Promise<WorkspaceSummary[]> {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });

  return memberships.map((m) => ({ id: m.workspace.id, name: m.workspace.name, role: m.role }));
}

export async function setAiEnabled(
  workspaceId: string,
  actorUserId: string,
  enabled: boolean,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.workspace.update({ where: { id: workspaceId }, data: { aiEnabled: enabled } });
    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId,
        action: "workspace.ai_toggle",
        entityType: "Workspace",
        entityId: workspaceId,
        metadataJson: { enabled },
      },
    });
  });
}

/**
 * GDPR-style delete (architecture.md §4, §14) — cascades to every
 * workspace-scoped table via the schema's onDelete: Cascade relations.
 * Not audit-logged: AuditLog rows for this workspace are cascaded away in
 * the same delete, so an entry here would just be deleted with everything
 * else.
 */
export async function deleteWorkspace(workspaceId: string): Promise<void> {
  await prisma.workspace.delete({ where: { id: workspaceId } });
}

export async function createWorkspaceForUser(userId: string, name: string) {
  return prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({ data: { name } });
    await tx.workspaceMember.create({
      data: { workspaceId: workspace.id, userId, role: "owner" },
    });
    await tx.auditLog.create({
      data: {
        workspaceId: workspace.id,
        actorUserId: userId,
        action: "workspace.create",
        entityType: "Workspace",
        entityId: workspace.id,
      },
    });
    return workspace;
  });
}
