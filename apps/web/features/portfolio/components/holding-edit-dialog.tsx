"use client";

import { useState, useTransition, type ReactElement } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ASSET_CLASSES, ASSET_CLASS_ITEMS } from "@/lib/asset-classes";
import { createHoldingAction, updateHoldingAction } from "@/features/portfolio/actions";
import type { Account, Holding } from "@wealthpilot/db";

interface HoldingFormValues {
  accountId: string;
  symbol: string;
  name: string;
  quantity: string;
  costBasis: string;
  currentPrice: string;
  assetClass: string;
}

function toFormValues(holding: Holding | null | undefined, defaultAccountId: string): HoldingFormValues {
  if (!holding) {
    return {
      accountId: defaultAccountId,
      symbol: "",
      name: "",
      quantity: "",
      costBasis: "",
      currentPrice: "",
      assetClass: "equity",
    };
  }
  return {
    accountId: holding.accountId,
    symbol: holding.symbol,
    name: holding.name ?? "",
    quantity: String(holding.quantity),
    costBasis: (holding.costBasisMinor / 100).toString(),
    currentPrice: holding.currentPriceMinor !== null ? (holding.currentPriceMinor / 100).toString() : "",
    assetClass: holding.assetClass,
  };
}

export function HoldingEditDialog({
  accounts,
  holding,
  trigger,
}: {
  accounts: Account[];
  holding?: Holding | null;
  trigger: ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<HoldingFormValues>(() => toFormValues(holding, accounts[0]?.id ?? ""));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [formError, setFormError] = useState<string | undefined>();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setValues(toFormValues(holding, accounts[0]?.id ?? ""));
      setFieldErrors({});
      setFormError(undefined);
    }
  }

  function handleSubmit() {
    const payload = {
      accountId: values.accountId,
      symbol: values.symbol,
      name: values.name || undefined,
      quantity: values.quantity,
      costBasis: values.costBasis,
      currentPrice: values.currentPrice || undefined,
      assetClass: values.assetClass,
    };

    startTransition(async () => {
      const result = holding
        ? await updateHoldingAction(holding.id, payload)
        : await createHoldingAction(payload);

      if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors);
        return;
      }
      if (result.error) {
        setFormError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  const isValid = values.accountId && values.symbol.trim() && values.quantity && values.costBasis;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{holding ? "Edit holding" : "Add a holding"}</DialogTitle>
          <DialogDescription>Manual entry — no live market data yet.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="holding-account">Account</Label>
            <Select
              items={Object.fromEntries(accounts.map((a) => [a.id, a.name]))}
              value={values.accountId}
              onValueChange={(v) => v && setValues((s) => ({ ...s, accountId: v }))}
            >
              <SelectTrigger id="holding-account" className="w-full">
                <SelectValue placeholder="Choose an account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.accountId?.[0] && (
              <p role="alert" className="text-negative text-sm">
                {fieldErrors.accountId[0]}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="holding-symbol">Symbol</Label>
              <Input
                id="holding-symbol"
                value={values.symbol}
                onChange={(e) => setValues((s) => ({ ...s, symbol: e.target.value }))}
                placeholder="AAPL"
                aria-invalid={Boolean(fieldErrors.symbol)}
              />
              {fieldErrors.symbol?.[0] && (
                <p role="alert" className="text-negative text-xs">
                  {fieldErrors.symbol[0]}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="holding-asset-class">Asset class</Label>
              <Select
                items={ASSET_CLASS_ITEMS}
                value={values.assetClass}
                onValueChange={(v) => v && setValues((s) => ({ ...s, assetClass: v }))}
              >
                <SelectTrigger id="holding-asset-class" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_CLASSES.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="holding-name">Name (optional)</Label>
            <Input
              id="holding-name"
              value={values.name}
              onChange={(e) => setValues((s) => ({ ...s, name: e.target.value }))}
              placeholder="Apple Inc."
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="holding-quantity">Quantity</Label>
              <Input
                id="holding-quantity"
                type="number"
                step="any"
                value={values.quantity}
                onChange={(e) => setValues((s) => ({ ...s, quantity: e.target.value }))}
                aria-invalid={Boolean(fieldErrors.quantity)}
              />
              {fieldErrors.quantity?.[0] && (
                <p role="alert" className="text-negative text-xs">
                  {fieldErrors.quantity[0]}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="holding-cost-basis">Avg. cost</Label>
              <Input
                id="holding-cost-basis"
                type="number"
                step="any"
                value={values.costBasis}
                onChange={(e) => setValues((s) => ({ ...s, costBasis: e.target.value }))}
                aria-invalid={Boolean(fieldErrors.costBasis)}
              />
              {fieldErrors.costBasis?.[0] && (
                <p role="alert" className="text-negative text-xs">
                  {fieldErrors.costBasis[0]}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="holding-current-price">Current price</Label>
              <Input
                id="holding-current-price"
                type="number"
                step="any"
                value={values.currentPrice}
                onChange={(e) => setValues((s) => ({ ...s, currentPrice: e.target.value }))}
                placeholder="Optional"
              />
            </div>
          </div>

          {formError && (
            <p role="alert" className="text-negative text-sm">
              {formError}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={isPending || !isValid}>
            {isPending ? "Saving…" : holding ? "Save changes" : "Add holding"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
