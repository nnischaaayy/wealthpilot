import "server-only";
import { prisma, Prisma, type UploadJob } from "@wealthpilot/db";
import { CONFIDENCE_THRESHOLD, detectColumns } from "@/features/transactions/lib/detect";
import { normalizeRows } from "@/features/transactions/lib/normalize";
import { categorizeTransaction } from "@/features/transactions/lib/categorize";
import { parseStatementFile, UnsupportedFileError } from "@/features/transactions/lib/parse";
import type { ColumnMapping, NormalizedTransaction, RawTable } from "@/features/transactions/lib/types";

export interface UploadOutcome {
  jobId: string;
  status: "done" | "mapping_required" | "error";
  transactionCount?: number;
  skippedRows?: number;
  errorDetail?: string;
  headers?: string[];
  previewRows?: string[][];
  suggestedMapping?: ColumnMapping | null;
}

function jobToOutcome(job: UploadJob): UploadOutcome {
  if (job.status === "mapping_required") {
    const table = job.rawRowsJson as unknown as RawTable | null;
    return {
      jobId: job.id,
      status: "mapping_required",
      headers: table?.headers,
      previewRows: table?.rows.slice(0, 8),
      suggestedMapping: null,
    };
  }
  if (job.status === "error") {
    return { jobId: job.id, status: "error", errorDetail: job.errorDetail ?? undefined };
  }
  return { jobId: job.id, status: "done", transactionCount: job.transactionCount ?? undefined };
}

async function persistTransactions(
  workspaceId: string,
  accountId: string,
  currency: string,
  normalized: NormalizedTransaction[],
): Promise<number> {
  if (normalized.length === 0) return 0;

  const rules = await prisma.categoryRule.findMany({
    where: { workspaceId },
    orderBy: { priority: "desc" },
  });

  const result = await prisma.transaction.createMany({
    data: normalized.map((t) => ({
      workspaceId,
      accountId,
      postedAt: t.postedAt,
      amountMinor: t.amountMinor,
      currency,
      description: t.description,
      merchantRaw: t.merchantRaw,
      merchantNormalized: t.merchantNormalized,
      category: categorizeTransaction(t.merchantNormalized, t.description, rules),
      source: "upload" as const,
    })),
  });

  return result.count;
}

export async function uploadStatement(
  workspaceId: string,
  accountId: string,
  fileName: string,
  buffer: Buffer,
  idempotencyKey: string,
): Promise<UploadOutcome> {
  const existing = await prisma.uploadJob.findUnique({
    where: { workspaceId_idempotencyKey: { workspaceId, idempotencyKey } },
  });
  if (existing) return jobToOutcome(existing);

  const account = await prisma.account.findFirst({ where: { id: accountId, workspaceId } });
  if (!account) throw new Error("Account not found in this workspace.");

  let table: RawTable;
  try {
    table = await parseStatementFile(fileName, buffer);
  } catch (err) {
    const detail = err instanceof UnsupportedFileError ? err.message : "We couldn't read this file.";
    const job = await prisma.uploadJob.create({
      data: { workspaceId, accountId, status: "error", fileName, errorDetail: detail, idempotencyKey },
    });
    return { jobId: job.id, status: "error", errorDetail: detail };
  }

  if (table.headers.length === 0 || table.rows.length === 0) {
    const detail = "We couldn't find any rows in this file.";
    const job = await prisma.uploadJob.create({
      data: { workspaceId, accountId, status: "error", fileName, errorDetail: detail, idempotencyKey },
    });
    return { jobId: job.id, status: "error", errorDetail: detail };
  }

  const detection = detectColumns(table);

  if (!detection.mapping || detection.confidence < CONFIDENCE_THRESHOLD) {
    const job = await prisma.uploadJob.create({
      data: {
        workspaceId,
        accountId,
        status: "mapping_required",
        fileName,
        rawRowsJson: table as unknown as Prisma.InputJsonValue,
        idempotencyKey,
      },
    });
    return {
      jobId: job.id,
      status: "mapping_required",
      headers: table.headers,
      previewRows: table.rows.slice(0, 8),
      suggestedMapping: detection.mapping,
    };
  }

  const { transactions, skippedRows } = normalizeRows(table, detection.mapping);
  const count = await persistTransactions(workspaceId, accountId, account.currency, transactions);

  const job = await prisma.uploadJob.create({
    data: {
      workspaceId,
      accountId,
      status: "done",
      fileName,
      detectedFormat: detection.mapping.amountColumn !== undefined ? "signed-amount" : "debit-credit",
      columnMapping: detection.mapping as unknown as Prisma.InputJsonValue,
      transactionCount: count,
      idempotencyKey,
    },
  });

  return { jobId: job.id, status: "done", transactionCount: count, skippedRows };
}

export async function confirmMapping(
  workspaceId: string,
  jobId: string,
  mapping: ColumnMapping,
): Promise<UploadOutcome> {
  const job = await prisma.uploadJob.findFirst({ where: { id: jobId, workspaceId } });
  if (!job) throw new Error("Upload job not found.");
  if (job.status !== "mapping_required") return jobToOutcome(job);

  const table = job.rawRowsJson as unknown as RawTable;
  const account = await prisma.account.findFirstOrThrow({
    where: { id: job.accountId, workspaceId },
  });

  const { transactions, skippedRows } = normalizeRows(table, mapping);
  const count = await persistTransactions(workspaceId, job.accountId, account.currency, transactions);

  const updated = await prisma.uploadJob.update({
    where: { id: job.id },
    data: {
      status: "done",
      columnMapping: mapping as unknown as Prisma.InputJsonValue,
      transactionCount: count,
      rawRowsJson: Prisma.JsonNull, // clear now that the import is done
    },
  });

  return { jobId: updated.id, status: "done", transactionCount: count, skippedRows };
}

export async function updateTransactionCategory(
  workspaceId: string,
  transactionId: string,
  category: string,
  learnRule: boolean,
) {
  const transaction = await prisma.transaction.findFirst({
    where: { id: transactionId, workspaceId },
  });
  if (!transaction) throw new Error("Transaction not found in this workspace.");

  await prisma.transaction.update({
    where: { id: transactionId },
    data: { category },
  });

  if (learnRule && transaction.merchantNormalized) {
    // Upsert so re-correcting the same merchant updates the rule instead of
    // colliding with the @@unique([workspaceId, matcherPattern]) constraint.
    await prisma.categoryRule.upsert({
      where: {
        workspaceId_matcherPattern: {
          workspaceId,
          matcherPattern: transaction.merchantNormalized,
        },
      },
      create: {
        workspaceId,
        matcherPattern: transaction.merchantNormalized,
        category,
        priority: 10,
      },
      update: { category },
    });
  }
}

export type TransactionSort = "date-desc" | "date-asc" | "amount-desc" | "amount-asc";

export interface TransactionFilters {
  category?: string;
  query?: string;
  page: number;
  pageSize: number;
  sort: TransactionSort;
}

const SORT_ORDER_BY: Record<TransactionSort, Prisma.TransactionOrderByWithRelationInput> = {
  "date-desc": { postedAt: "desc" },
  "date-asc": { postedAt: "asc" },
  "amount-desc": { amountMinor: "desc" },
  "amount-asc": { amountMinor: "asc" },
};

export async function listTransactions(workspaceId: string, filters: TransactionFilters) {
  const where: Prisma.TransactionWhereInput = {
    workspaceId,
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.query
      ? {
          OR: [
            { description: { contains: filters.query, mode: "insensitive" } },
            { merchantNormalized: { contains: filters.query, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, transactions] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      orderBy: SORT_ORDER_BY[filters.sort],
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      include: { account: { select: { name: true } } },
    }),
  ]);

  return { transactions, total };
}
