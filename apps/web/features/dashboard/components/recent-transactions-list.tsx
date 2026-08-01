import Link from "next/link";
import { formatMoney } from "@/lib/format-money";
import { getCategoryLabel } from "@/lib/categories";
import { cn } from "@/lib/utils";
import type { Account, Transaction } from "@wealthpilot/db";

type TransactionRow = Transaction & { account: Pick<Account, "name"> };

export function RecentTransactionsList({ transactions }: { transactions: TransactionRow[] }) {
  if (transactions.length === 0) return null;

  return (
    <ul className="flex flex-col">
      {transactions.map((t) => (
        <li key={t.id} className="flex items-center justify-between gap-3 border-b py-2.5 last:border-b-0">
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">{t.description}</span>
            <span className="text-muted-foreground text-xs">
              {t.postedAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })} &middot;{" "}
              {getCategoryLabel(t.category)}
            </span>
          </div>
          <span
            className={cn(
              "tabular-nums text-sm font-medium whitespace-nowrap",
              t.amountMinor < 0 ? "text-negative" : "text-positive",
            )}
          >
            {formatMoney(t.amountMinor, t.currency)}
          </span>
        </li>
      ))}
      <li className="pt-3 text-center">
        <Link href="/transactions" className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4">
          View all transactions
        </Link>
      </li>
    </ul>
  );
}
