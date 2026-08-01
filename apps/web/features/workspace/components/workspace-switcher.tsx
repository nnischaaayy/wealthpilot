"use client";

import { useState, useTransition } from "react";
import { ChevronsUpDown, Check, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WorkspaceSummary } from "@/features/workspace/server/service";
import { createWorkspaceAction, switchWorkspaceAction } from "@/features/workspace/actions";

export function WorkspaceSwitcher({
  workspaces,
  activeWorkspaceId,
}: {
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | undefined>();
  const active = workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0];

  function handleSwitch(workspaceId: string) {
    if (workspaceId === activeWorkspaceId) return;
    startTransition(async () => {
      const result = await switchWorkspaceAction(workspaceId);
      if (!result.error) router.refresh();
    });
  }

  function handleCreate() {
    startTransition(async () => {
      const result = await createWorkspaceAction({ name });
      if (result.error) {
        setError(result.error);
        return;
      }
      setDialogOpen(false);
      setName("");
      setError(undefined);
      router.refresh();
    });
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              className="max-w-48 justify-between gap-2 px-2"
              disabled={isPending}
            >
              <span className="truncate text-sm font-medium">{active?.name ?? "Workspace"}</span>
              <ChevronsUpDown className="text-muted-foreground size-3.5 shrink-0" />
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
            {workspaces.map((workspace) => (
              <DropdownMenuItem key={workspace.id} onClick={() => handleSwitch(workspace.id)}>
                <span className="flex-1 truncate">{workspace.name}</span>
                {workspace.id === activeWorkspaceId && <Check className="size-4" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DialogTrigger
            nativeButton={false}
            render={
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <Plus className="size-4" />
                <span>Create workspace</span>
              </DropdownMenuItem>
            }
          />
        </DropdownMenuContent>
      </DropdownMenu>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a new workspace</DialogTitle>
          <DialogDescription>
            Workspaces isolate accounts, transactions, and budgets from each other.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="workspace-name">Workspace name</Label>
          <Input
            id="workspace-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "workspace-name-error" : undefined}
          />
          {error && (
            <p id="workspace-name-error" role="alert" className="text-negative text-sm">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button onClick={handleCreate} disabled={isPending || name.trim().length === 0}>
            {isPending ? "Creating…" : "Create workspace"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
