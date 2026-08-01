"use client";

import { useState, useTransition } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIES, CATEGORY_ITEMS } from "@/lib/categories";
import { updateTransactionCategoryAction } from "@/features/transactions/actions";

export function CategoryCell({
  transactionId,
  category,
  merchantNormalized,
}: {
  transactionId: string;
  category: string;
  merchantNormalized: string | null;
}) {
  const [value, setValue] = useState(category);
  const [isPending, startTransition] = useTransition();

  function handleChange(next: string) {
    setValue(next);
    startTransition(async () => {
      // Learn a rule from the correction when we have an identifiable
      // merchant — the "correct a few rows, it trains a rule" journey (§3.1).
      await updateTransactionCategoryAction(transactionId, next, Boolean(merchantNormalized));
    });
  }

  return (
    <Select items={CATEGORY_ITEMS} value={value} onValueChange={(v) => v && handleChange(v)}>
      <SelectTrigger size="sm" className="w-40" disabled={isPending} aria-label="Category">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CATEGORIES.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
