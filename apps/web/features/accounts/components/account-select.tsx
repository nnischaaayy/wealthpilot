"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { accountTypes } from "@/lib/validations/account";
import { createAccountAction } from "@/features/accounts/actions";
import type { Account } from "@wealthpilot/db";

const ACCOUNT_TYPE_LABELS: Record<(typeof accountTypes)[number], string> = {
  checking: "Checking",
  savings: "Savings",
  credit: "Credit card",
  brokerage: "Brokerage",
};

export function AccountSelect({
  accounts,
  value,
  onChange,
}: {
  accounts: Account[];
  value: string | undefined;
  onChange: (accountId: string) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<(typeof accountTypes)[number]>("checking");
  const [error, setError] = useState<string | undefined>();

  function handleCreate() {
    startTransition(async () => {
      const result = await createAccountAction({ name, type, currency: "USD" });
      if (result.error) {
        setError(result.error);
        return;
      }
      setDialogOpen(false);
      setName("");
      setError(undefined);
      router.refresh();
      if (result.accountId) onChange(result.accountId);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        items={Object.fromEntries(accounts.map((a) => [a.id, a.name]))}
        value={value ?? ""}
        onValueChange={(v) => v && onChange(v)}
      >
        <SelectTrigger className="w-56" aria-label="Account">
          <SelectValue placeholder="Choose an account" />
        </SelectTrigger>
        <SelectContent>
          {accounts.map((account) => (
            <SelectItem key={account.id} value={account.id}>
              {account.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger
          render={
            <Button variant="outline" size="icon" aria-label="Add account">
              <Plus className="size-4" />
            </Button>
          }
        />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add an account</DialogTitle>
            <DialogDescription>
              Statements are imported against a specific account.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="account-name">Account name</Label>
              <Input
                id="account-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Chase Checking"
                aria-invalid={Boolean(error)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="account-type">Type</Label>
              <Select
                items={ACCOUNT_TYPE_LABELS}
                value={type}
                onValueChange={(v) => v && setType(v as typeof type)}
              >
                <SelectTrigger id="account-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accountTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {ACCOUNT_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error && (
              <p role="alert" className="text-negative text-sm">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={isPending || name.trim().length === 0}>
              {isPending ? "Adding…" : "Add account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
