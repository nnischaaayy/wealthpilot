import { Search } from "lucide-react";
import { WorkspaceSwitcher } from "@/features/workspace/components/workspace-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import type { WorkspaceSummary } from "@/features/workspace/server/service";

export function AppTopbar({
  workspaces,
  activeWorkspaceId,
  userName,
  userEmail,
}: {
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string;
  userName: string;
  userEmail: string;
}) {
  return (
    <header className="bg-background/80 sticky top-0 z-40 flex h-16 shrink-0 items-center gap-4 border-b px-4 backdrop-blur-sm md:px-6">
      <WorkspaceSwitcher workspaces={workspaces} activeWorkspaceId={activeWorkspaceId} />

      <button
        type="button"
        className="text-muted-foreground border-input hover:bg-accent hidden max-w-sm flex-1 items-center gap-2 rounded-md border px-3 py-1.5 text-sm md:flex"
        aria-label="Search (Command K)"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="bg-muted rounded px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <UserMenu name={userName} email={userEmail} />
      </div>
    </header>
  );
}
