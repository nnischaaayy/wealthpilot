"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
import { formatMoney } from "@/lib/format-money";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { deleteCategoryBudgetAction } from "@/features/budgets/actions";
import { CategoryBudgetDialog } from "@/features/budgets/components/category-budget-dialog";
import type { CategoryBudgetWithSpend } from "@/features/budgets/server/service";

const STATUS_STYLES: Record<CategoryBudgetWithSpend["status"], { bar: string; text: string }> = {
  ok: { bar: "bg-positive", text: "text-positive" },
  warning: { bar: "bg-warning", text: "text-warning" },
  over: { bar: "bg-negative", text: "text-negative" },
};

function DeleteBudgetButton({ id, label }: { id: string; label: string }) {
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
              await deleteCategoryBudgetAction(id);
              router.refresh();
            })
          }
        >
          {isPending ? "Removing…" : "Confirm"}
        </Button>
        <Button size="sm" variant="ghost" disabled={isPending} onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Button
      size="icon-sm"
      variant="ghost"
      aria-label={`Remove ${label} budget`}
      onClick={() => setConfirming(true)}
    >
      <Trash2 className="size-4" />
    </Button>
  );
}

export function CategoryBudgetList({
  budgets,
  currency,
}: {
  budgets: CategoryBudgetWithSpend[];
  currency: string;
}) {
  const usedCategories = budgets.map((b) => b.category);
  const addTrigger = (
    <Button variant="outline" size="sm">
      <Plus className="size-4" />
      Set a budget
    </Button>
  );

  return (
    <div className="flex flex-col gap-4">
      {budgets.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No category budgets set yet — add one to get an alert when you go over.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {budgets.map((b) => {
            const style = STATUS_STYLES[b.status];
            const fillPct = Math.min(100, b.pct);
            const editTrigger = (
              <Button size="icon-sm" variant="ghost" aria-label={`Edit ${b.label} budget`}>
                <Pencil className="size-4" />
              </Button>
            );

            return (
              <li key={b.id} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{b.label}</span>
                  <div className="flex items-center gap-1">
                    <span className={cn("flex items-center gap-1 font-medium tabular-nums", style.text)}>
                      {b.status === "over" ? (
                        <TriangleAlert className="size-3.5" aria-hidden="true" />
                      ) : (
                        <Check className="size-3.5" aria-hidden="true" />
                      )}
                      {b.pct}%
                    </span>
                    <CategoryBudgetDialog
                      currency={currency}
                      existing={b}
                      usedCategories={usedCategories}
                      trigger={editTrigger}
                    />
                    <DeleteBudgetButton id={b.id} label={b.label} />
                  </div>
                </div>
                <div className="bg-muted h-2 w-full overflow-hidden rounded-full" role="presentation">
                  <div className={cn("h-full rounded-full", style.bar)} style={{ width: `${fillPct}%` }} />
                </div>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {formatMoney(b.spentMinor, currency)} of {formatMoney(b.limitMinor, currency)} this month
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <CategoryBudgetDialog currency={currency} usedCategories={usedCategories} trigger={addTrigger} />
    </div>
  );
}
