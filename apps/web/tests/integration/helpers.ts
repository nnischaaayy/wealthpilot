import { prisma } from "@wealthpilot/db";

/** Creates an isolated workspace/user/account trio for a single test run. */
export async function createTestWorkspace(namePrefix = "test") {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const workspace = await prisma.workspace.create({ data: { name: `${namePrefix}-${suffix}` } });
  const user = await prisma.user.create({
    data: { email: `${namePrefix}-${suffix}@example.test`, name: "Test User" },
  });
  await prisma.workspaceMember.create({
    data: { workspaceId: workspace.id, userId: user.id, role: "owner" },
  });
  const account = await prisma.account.create({
    data: { workspaceId: workspace.id, name: "Test Checking", type: "checking", currency: "USD" },
  });

  return { workspace, user, account };
}

/** Deletes a test workspace; cascading FKs clean up everything scoped to it. */
export async function cleanupWorkspace(workspaceId: string) {
  await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => {});
}
