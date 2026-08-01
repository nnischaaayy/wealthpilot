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
