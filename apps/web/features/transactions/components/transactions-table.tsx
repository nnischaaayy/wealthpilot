import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/lib/format-money";
import { CategoryCell } from "@/features/transactions/components/category-cell";
import type { TransactionSort } from "@/features/transactions/server/service";
import type { Account, Transaction } from "@wealthpilot/db";

type TransactionRow = Transaction & { account: Pick<Account, "name"> };

interface TransactionsTableProps {
  transactions: TransactionRow[];
  total: number;
  page: number;
  pageSize: number;
  sort: TransactionSort;
  q: string;
  category: string;
}

function hrefFor(params: Partial<{ page: number; sort: TransactionSort; q: string; category: string }>, current: TransactionsTableProps) {
  const merged = {
    page: params.page ?? current.page,
    sort: params.sort ?? current.sort,
    q: params.q ?? current.q,
    category: params.category ?? current.category,
  };
  const search = new URLSearchParams();
  if (merged.q) search.set("q", merged.q);
  if (merged.category) search.set("category", merged.category);
  if (merged.sort !== "date-desc") search.set("sort", merged.sort);
  if (merged.page !== 1) search.set("page", String(merged.page));
  const qs = search.toString();
  return qs ? `/transactions?${qs}` : "/transactions";
}

function SortHeader({
  label,
  ascSort,
  descSort,
  current,
  props,
}: {
  label: string;
  ascSort: TransactionSort;
  descSort: TransactionSort;
  current: TransactionSort;
  props: TransactionsTableProps;
}) {
  const isActive = current === ascSort || current === descSort;
  const nextSort = current === descSort ? ascSort : descSort;

  return (
    <Link
      href={hrefFor({ sort: nextSort, page: 1 }, props)}
      className="inline-flex items-center gap-1 hover:text-foreground"
    >
      {label}
      {isActive &&
        (current === descSort ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
    </Link>
  );
}

export function TransactionsTable(props: TransactionsTableProps) {
  const { transactions, total, page, pageSize } = props;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (transactions.length === 0) {
    return (
      <div className="text-muted-foreground rounded-lg border py-16 text-center text-sm">
        No transactions match your filters yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <SortHeader label="Date" ascSort="date-asc" descSort="date-desc" current={props.sort} props={props} />
              </TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">
                <span className="flex justify-end">
                  <SortHeader
                    label="Amount"
                    ascSort="amount-asc"
                    descSort="amount-desc"
                    current={props.sort}
                    props={props}
                  />
                </span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="tabular-nums whitespace-nowrap">
                  {t.postedAt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                </TableCell>
                <TableCell className="max-w-72 truncate" title={t.description}>
                  {t.description}
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">{t.account.name}</TableCell>
                <TableCell>
                  <CategoryCell
                    transactionId={t.id}
                    category={t.category}
                    merchantNormalized={t.merchantNormalized}
                  />
                </TableCell>
                <TableCell
                  className={
                    "tabular-nums text-right whitespace-nowrap " +
                    (t.amountMinor < 0 ? "text-negative" : "text-positive")
                  }
                >
                  {formatMoney(t.amountMinor, t.currency)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="text-muted-foreground flex items-center justify-between text-sm">
        <span>
          Page {page} of {totalPages} &middot; {total} transaction{total === 1 ? "" : "s"}
        </span>
        <div className="flex gap-2">
          <Link
            href={hrefFor({ page: Math.max(1, page - 1) }, props)}
            aria-disabled={page <= 1}
            className={
              "rounded-md border px-3 py-1.5 " +
              (page <= 1 ? "pointer-events-none opacity-50" : "hover:bg-muted")
            }
          >
            Previous
          </Link>
          <Link
            href={hrefFor({ page: Math.min(totalPages, page + 1) }, props)}
            aria-disabled={page >= totalPages}
            className={
              "rounded-md border px-3 py-1.5 " +
              (page >= totalPages ? "pointer-events-none opacity-50" : "hover:bg-muted")
            }
          >
            Next
          </Link>
        </div>
      </div>
    </div>
  );
}
