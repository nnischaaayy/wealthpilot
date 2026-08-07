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
import { CATEGORIES } from "@/lib/categories";
import { setCategoryBudgetAction } from "@/features/budgets/actions";
import type { CategoryBudgetWithSpend } from "@/features/budgets/server/service";

// Income/transfer aren't spend categories — budgeting a limit against them
// doesn't map to anything meaningful on the 50/30/20 or category-spend views.
const NON_BUDGETABLE_GROUPS = new Set(["income", "transfer"]);

export function CategoryBudgetDialog({
  currency,
  existing,
  usedCategories,
  trigger,
}: {
  currency: string;
  existing?: CategoryBudgetWithSpend | null;
  usedCategories: string[];
  trigger: ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [category, setCategory] = useState(existing?.category ?? "");
  const [limit, setLimit] = useState(existing ? (existing.limitMinor / 100).toString() : "");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [formError, setFormError] = useState<string | undefined>();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setCategory(existing?.category ?? "");
      setLimit(existing ? (existing.limitMinor / 100).toString() : "");
      setFieldErrors({});
      setFormError(undefined);
    }
  }

  function handleSubmit() {
    startTransition(async () => {
      const result = await setCategoryBudgetAction(currency, { category, limit });
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

  const usedElsewhere = new Set(usedCategories.filter((c) => c !== existing?.category));
  const selectable = CATEGORIES.filter(
    (c) => !NON_BUDGETABLE_GROUPS.has(c.group) && !usedElsewhere.has(c.id),
  );
  const items = Object.fromEntries(selectable.map((c) => [c.id, c.label]));

  const isValid = category && limit;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit budget" : "Set a category budget"}</DialogTitle>
          <DialogDescription>
            Get an alert when this category goes over its monthly limit.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="budget-category">Category</Label>
            <Select
              items={items}
              value={category}
              onValueChange={(v) => v && setCategory(v)}
              disabled={Boolean(existing)}
            >
              <SelectTrigger id="budget-category" className="w-full">
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {selectable.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.category?.[0] && (
              <p role="alert" className="text-negative text-sm">
                {fieldErrors.category[0]}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="budget-limit">Monthly limit ({currency})</Label>
            <Input
              id="budget-limit"
              type="number"
              step="any"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              aria-invalid={Boolean(fieldErrors.limit)}
            />
            {fieldErrors.limit?.[0] && (
              <p role="alert" className="text-negative text-sm">
                {fieldErrors.limit[0]}
              </p>
            )}
          </div>

          {formError && (
            <p role="alert" className="text-negative text-sm">
              {formError}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={isPending || !isValid}>
            {isPending ? "Saving…" : existing ? "Save changes" : "Set budget"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
