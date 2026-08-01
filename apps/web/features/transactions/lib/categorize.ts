export interface CategoryRuleLike {
  matcherPattern: string;
  category: string;
  priority: number;
}

// Curated starter rules, evaluated after workspace rules (which always win —
// this is what "user-learned rules" (§3.1) override). Priority -1 keeps them
// below every workspace rule, including the default priority-0 ones a user's
// inline correction creates.
const BUILTIN_RULES: CategoryRuleLike[] = [
  { matcherPattern: "RENT", category: "housing", priority: -1 },
  { matcherPattern: "MORTGAGE", category: "housing", priority: -1 },
  { matcherPattern: "ELECTRIC", category: "utilities", priority: -1 },
  { matcherPattern: "UTILITY", category: "utilities", priority: -1 },
  { matcherPattern: "WATER BOARD", category: "utilities", priority: -1 },
  { matcherPattern: "BROADBAND", category: "utilities", priority: -1 },
  { matcherPattern: "GROCERY", category: "groceries", priority: -1 },
  { matcherPattern: "SUPERMARKET", category: "groceries", priority: -1 },
  { matcherPattern: "WHOLE FOODS", category: "groceries", priority: -1 },
  { matcherPattern: "TRADER JOE", category: "groceries", priority: -1 },
  { matcherPattern: "UBER", category: "transport", priority: -1 },
  { matcherPattern: "LYFT", category: "transport", priority: -1 },
  { matcherPattern: "OLA", category: "transport", priority: -1 },
  { matcherPattern: "IRCTC", category: "transport", priority: -1 },
  { matcherPattern: "FUEL", category: "transport", priority: -1 },
  { matcherPattern: "PETROL", category: "transport", priority: -1 },
  { matcherPattern: "PARKING", category: "transport", priority: -1 },
  { matcherPattern: "PHARMACY", category: "health", priority: -1 },
  { matcherPattern: "CLINIC", category: "health", priority: -1 },
  { matcherPattern: "HOSPITAL", category: "health", priority: -1 },
  { matcherPattern: "INSURANCE", category: "insurance", priority: -1 },
  { matcherPattern: "SWIGGY", category: "dining", priority: -1 },
  { matcherPattern: "ZOMATO", category: "dining", priority: -1 },
  { matcherPattern: "STARBUCKS", category: "dining", priority: -1 },
  { matcherPattern: "MCDONALD", category: "dining", priority: -1 },
  { matcherPattern: "RESTAURANT", category: "dining", priority: -1 },
  { matcherPattern: "CAFE", category: "dining", priority: -1 },
  { matcherPattern: "AMAZON", category: "shopping", priority: -1 },
  { matcherPattern: "FLIPKART", category: "shopping", priority: -1 },
  { matcherPattern: "TARGET", category: "shopping", priority: -1 },
  { matcherPattern: "WALMART", category: "shopping", priority: -1 },
  { matcherPattern: "NETFLIX", category: "subscriptions", priority: -1 },
  { matcherPattern: "SPOTIFY", category: "subscriptions", priority: -1 },
  { matcherPattern: "PRIME VIDEO", category: "subscriptions", priority: -1 },
  { matcherPattern: "DISNEY+", category: "subscriptions", priority: -1 },
  { matcherPattern: "AIRLINE", category: "travel", priority: -1 },
  { matcherPattern: "HOTEL", category: "travel", priority: -1 },
  { matcherPattern: "AIRBNB", category: "travel", priority: -1 },
  { matcherPattern: "TUITION", category: "education", priority: -1 },
  { matcherPattern: "ATM FEE", category: "fees", priority: -1 },
  { matcherPattern: "SERVICE CHARGE", category: "fees", priority: -1 },
  { matcherPattern: "LATE FEE", category: "fees", priority: -1 },
  { matcherPattern: "SALARY", category: "income", priority: -1 },
  { matcherPattern: "PAYROLL", category: "income", priority: -1 },
  { matcherPattern: "INTEREST CREDIT", category: "income", priority: -1 },
  { matcherPattern: "TRANSFER", category: "transfer", priority: -1 },
  { matcherPattern: "ATM WITHDRAWAL", category: "transfer", priority: -1 },
];

export const DEFAULT_CATEGORY = "uncategorized";

/**
 * Matches a transaction's normalized merchant/description against
 * workspace-specific rules first (highest priority wins, ties broken by
 * whichever pattern is longer/more specific), then the built-in keyword
 * list, falling back to "uncategorized".
 */
export function categorizeTransaction(
  merchantNormalized: string,
  description: string,
  workspaceRules: CategoryRuleLike[],
): string {
  const haystack = `${merchantNormalized} ${description}`.toUpperCase();

  const candidates = [...workspaceRules, ...BUILTIN_RULES]
    .filter((rule) => haystack.includes(rule.matcherPattern.toUpperCase()))
    .sort((a, b) => b.priority - a.priority || b.matcherPattern.length - a.matcherPattern.length);

  return candidates[0]?.category ?? DEFAULT_CATEGORY;
}
