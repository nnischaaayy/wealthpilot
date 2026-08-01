import { prisma } from "@wealthpilot/db";
import { requireActiveWorkspace } from "@/lib/workspace-context";
import { listWorkspacesForUser } from "@/features/workspace/server/service";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId, workspaceId } = await requireActiveWorkspace();

  const [user, workspaces] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    listWorkspacesForUser(userId),
  ]);

  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar
          workspaces={workspaces}
          activeWorkspaceId={workspaceId}
          userName={user.name ?? user.email}
          userEmail={user.email}
        />
        <main className="min-w-0 flex-1 px-4 pb-20 md:px-6 md:pb-6">
          <div className="mx-auto w-full max-w-7xl py-6">{children}</div>
        </main>
      </div>
      <MobileTabBar />
    </div>
  );
}
