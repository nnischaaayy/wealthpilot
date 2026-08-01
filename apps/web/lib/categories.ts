export type BudgetGroup = "needs" | "wants" | "savings" | "income" | "transfer";

export interface CategoryDef {
  id: string;
  label: string;
  group: BudgetGroup;
}

// Canonical category taxonomy — the 50/30/20 budget view (Phase 3) groups by
// `group`. Keep ids stable; they're stored verbatim on Transaction.category.
export const CATEGORIES: CategoryDef[] = [
  { id: "housing", label: "Housing", group: "needs" },
  { id: "utilities", label: "Utilities", group: "needs" },
  { id: "groceries", label: "Groceries", group: "needs" },
  { id: "transport", label: "Transport", group: "needs" },
  { id: "health", label: "Health", group: "needs" },
  { id: "insurance", label: "Insurance", group: "needs" },
  { id: "dining", label: "Dining", group: "wants" },
  { id: "shopping", label: "Shopping", group: "wants" },
  { id: "entertainment", label: "Entertainment", group: "wants" },
  { id: "subscriptions", label: "Subscriptions", group: "wants" },
  { id: "travel", label: "Travel", group: "wants" },
  { id: "education", label: "Education", group: "wants" },
  { id: "fees", label: "Fees & charges", group: "wants" },
  { id: "savings", label: "Savings & investing", group: "savings" },
  { id: "income", label: "Income", group: "income" },
  { id: "transfer", label: "Transfer", group: "transfer" },
  { id: "other", label: "Other", group: "wants" },
  { id: "uncategorized", label: "Uncategorized", group: "wants" },
];

const CATEGORY_MAP = new Map(CATEGORIES.map((c) => [c.id, c]));

/** value -> label map for Base UI Select's `items` prop (shows labels, not raw ids). */
export const CATEGORY_ITEMS: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.label]),
);

export function getCategoryLabel(id: string): string {
  return CATEGORY_MAP.get(id)?.label ?? id;
}

export function isValidCategory(id: string): boolean {
  return CATEGORY_MAP.has(id);
}
