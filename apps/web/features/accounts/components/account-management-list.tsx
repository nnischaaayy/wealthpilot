"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { deleteAccountAction, renameAccountAction } from "@/features/accounts/actions";
import type { Account } from "@wealthpilot/db";

function DeleteAccountButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="destructive"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await deleteAccountAction(id);
              router.refresh();
            })
          }
        >
          {isPending ? "Deleting…" : "Confirm"}
        </Button>
        <Button size="sm" variant="ghost" disabled={isPending} onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Button size="icon-sm" variant="ghost" aria-label={`Delete ${name}`} onClick={() => setConfirming(true)}>
      <Trash2 className="size-4" />
    </Button>
  );
}

function AccountRow({ account }: { account: Account }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(account.name);
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  if (editing) {
    return (
      <li className="flex items-center gap-2 py-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label={`Rename ${account.name}`}
          className="h-8"
        />
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Save"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const result = await renameAccountAction(account.id, name);
              if (result.error) {
                setError(result.error);
                return;
              }
              setEditing(false);
              router.refresh();
            })
          }
        >
          <Check className="size-4" />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Cancel"
          disabled={isPending}
          onClick={() => {
            setName(account.name);
            setError(undefined);
            setEditing(false);
          }}
        >
          <X className="size-4" />
        </Button>
        {error && (
          <p role="alert" className="text-negative text-xs">
            {error}
          </p>
        )}
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-2 py-2 text-sm">
      <div className="flex items-center gap-2">
        <span className="font-medium">{account.name}</span>
        <Badge variant="secondary" className="capitalize">
          {account.type}
        </Badge>
        <span className="text-muted-foreground">{account.currency}</span>
      </div>
      <div className="flex items-center gap-1">
        <Button size="icon-sm" variant="ghost" aria-label={`Rename ${account.name}`} onClick={() => setEditing(true)}>
          <Pencil className="size-4" />
        </Button>
        <DeleteAccountButton id={account.id} name={account.name} />
      </div>
    </li>
  );
}

export function AccountManagementList({ accounts }: { accounts: Account[] }) {
  if (accounts.length === 0) {
    return <p className="text-muted-foreground text-sm">No accounts yet.</p>;
  }

  return (
    <ul className="divide-y">
      {accounts.map((account) => (
        <AccountRow key={account.id} account={account} />
      ))}
    </ul>
  );
}
