import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/workspace-context";
import { listAccountsForWorkspace } from "@/features/accounts/server/service";
import { listTransactions, type TransactionSort } from "@/features/transactions/server/service";
import { StatementUploadDropzone } from "@/features/transactions/components/statement-upload-dropzone";
import { TransactionsFilterBar } from "@/features/transactions/components/transactions-filter-bar";
import { TransactionsTable } from "@/features/transactions/components/transactions-table";

export const metadata: Metadata = { title: "Transactions — WealthPilot" };

const PAGE_SIZE = 25;
const VALID_SORTS: TransactionSort[] = ["date-desc", "date-asc", "amount-desc", "amount-asc"];

interface TransactionsSearchParams {
  q?: string;
  category?: string;
  page?: string;
  sort?: string;
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<TransactionsSearchParams>;
}) {
  const { workspaceId } = await requireActiveWorkspace();
  const params = await searchParams;

  const q = params.q?.trim() ?? "";
  const category = params.category ?? "";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const sort: TransactionSort = VALID_SORTS.includes(params.sort as TransactionSort)
    ? (params.sort as TransactionSort)
    : "date-desc";

  const [accounts, { transactions, total }] = await Promise.all([
    listAccountsForWorkspace(workspaceId),
    listTransactions(workspaceId, { query: q || undefined, category: category || undefined, page, pageSize: PAGE_SIZE, sort }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
        <p className="text-muted-foreground text-sm">
          Upload a bank statement to import and categorize transactions.
        </p>
      </div>

      <StatementUploadDropzone accounts={accounts} />

      <TransactionsFilterBar />

      <TransactionsTable
        transactions={transactions}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        sort={sort}
        q={q}
        category={category}
      />
    </div>
  );
}
