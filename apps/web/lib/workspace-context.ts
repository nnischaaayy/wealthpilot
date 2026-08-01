import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@wealthpilot/db";
import { auth } from "@/lib/auth";

export const WORKSPACE_COOKIE = "wp_workspace";

export interface ActiveWorkspace {
  userId: string;
  workspaceId: string;
  role: "owner" | "member";
}

/**
 * Resolves the authenticated user's active workspace for this request,
 * re-verifying membership every call. This is the single chokepoint every
 * tenant-scoped query or server action should go through (§10) — never trust
 * a workspaceId from the client without going through here first.
 */
export async function requireActiveWorkspace(): Promise<ActiveWorkspace> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const cookieStore = await cookies();
  const requestedWorkspaceId = cookieStore.get(WORKSPACE_COOKIE)?.value;

  const membership = requestedWorkspaceId
    ? await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: requestedWorkspaceId, userId } },
      })
    : null;
  if (membership) {
    return { userId, workspaceId: membership.workspaceId, role: membership.role };
  }

  // Cookie missing, stale, or points to a workspace the user was removed
  // from — fall back to their earliest workspace. (Server Components can't
  // set cookies, so this resolves fresh each request until the user
  // explicitly switches via the workspace switcher's server action.)
  const fallback = await prisma.workspaceMember.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  if (!fallback) redirect("/login");

  return { userId, workspaceId: fallback.workspaceId, role: fallback.role };
}
