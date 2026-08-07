"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { deleteWorkspaceAction } from "@/features/workspace/actions";

export function DeleteWorkspaceDialog({ workspaceName }: { workspaceName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setConfirmText("");
      setError(undefined);
    }
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteWorkspaceAction(confirmText);
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="destructive">Delete workspace</Button>} />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete &ldquo;{workspaceName}&rdquo;?</DialogTitle>
          <DialogDescription>
            This permanently deletes every account, transaction, holding, budget, and AI advisor
            history in this workspace. This can&apos;t be undone. If this is your only workspace,
            you&apos;ll be signed out.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Label htmlFor="confirm-workspace-name">
            Type <span className="font-medium">{workspaceName}</span> to confirm
          </Label>
          <Input
            id="confirm-workspace-name"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            aria-invalid={Boolean(error)}
          />
          {error && (
            <p role="alert" className="text-negative text-sm">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="destructive"
            disabled={isPending || confirmText !== workspaceName}
            onClick={handleDelete}
          >
            {isPending ? "Deleting…" : "Permanently delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
