"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@wealthpilot/db";
import { auth } from "@/lib/auth";
import { WORKSPACE_COOKIE } from "@/lib/workspace-context";
import { createWorkspaceSchema } from "@/lib/validations/workspace";
import { createWorkspaceForUser } from "@/features/workspace/server/service";

export interface WorkspaceActionResult {
  error?: string;
}

async function setActiveWorkspaceCookie(workspaceId: string) {
  const cookieStore = await cookies();
  cookieStore.set(WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function createWorkspaceAction(input: { name: string }): Promise<WorkspaceActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not signed in." };

  const parsed = createWorkspaceSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid workspace name." };
  }

  const workspace = await createWorkspaceForUser(session.user.id, parsed.data.name);
  await setActiveWorkspaceCookie(workspace.id);
  revalidatePath("/", "layout");
  return {};
}

export async function switchWorkspaceAction(workspaceId: string): Promise<WorkspaceActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not signed in." };

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.user.id } },
  });
  if (!membership) return { error: "You don't have access to that workspace." };

  await setActiveWorkspaceCookie(workspaceId);
  revalidatePath("/", "layout");
  return {};
}
