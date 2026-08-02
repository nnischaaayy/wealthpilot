import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@wealthpilot/db";
import { confirmMapping, uploadStatement } from "@/features/transactions/server/service";
import { createTestWorkspace, cleanupWorkspace } from "./helpers";

describe("upload pipeline (live Postgres)", () => {
  let workspaceId: string;
  let accountId: string;

  beforeAll(async () => {
    const ctx = await createTestWorkspace("upload-pipeline");
    workspaceId = ctx.workspace.id;
    accountId = ctx.account.id;
  });

  afterAll(async () => {
    await cleanupWorkspace(workspaceId);
    await prisma.$disconnect();
  });

  it("auto-detects a debit/credit statement and persists categorized transactions", async () => {
    const csv = [
      "Value Date,Particulars,Debit,Credit",
      "01/03/2025,UPI/123456789/SWIGGY BANGALORE,450.00,",
      "02/03/2025,SALARY CREDIT MARCH,,50000.00",
    ].join("\n");

    const outcome = await uploadStatement(
      workspaceId,
      accountId,
      "statement.csv",
      Buffer.from(csv),
      randomUUID(),
    );

    expect(outcome.status).toBe("done");
    expect(outcome.transactionCount).toBe(2);

    const transactions = await prisma.transaction.findMany({
      where: { workspaceId, accountId },
      orderBy: { postedAt: "asc" },
    });
    expect(transactions).toHaveLength(2);
    expect(transactions[0].amountMinor).toBe(-45000);
    expect(transactions[0].category).toBe("dining");
    expect(transactions[1].amountMinor).toBe(5000000);
    expect(transactions[1].category).toBe("income");
  });

  it("falls back to the mapping wizard for an unrecognizable file, then persists safely on confirm", async () => {
    const csv = ["Ref,Notes", "A1,Some transaction text", "A2,More transaction text"].join("\n");

    const outcome = await uploadStatement(
      workspaceId,
      accountId,
      "ambiguous.csv",
      Buffer.from(csv),
      randomUUID(),
    );
    expect(outcome.status).toBe("mapping_required");
    expect(outcome.headers).toEqual(["Ref", "Notes"]);

    // Nothing here actually parses as a date/amount — confirming should
    // import zero rows rather than crash or corrupt data.
    const confirmed = await confirmMapping(workspaceId, outcome.jobId, {
      dateColumn: 0,
      descriptionColumn: 1,
      amountColumn: 1,
      dateFormat: "day-first",
    });
    expect(confirmed.status).toBe("done");
    expect(confirmed.transactionCount).toBe(0);

    const job = await prisma.uploadJob.findUniqueOrThrow({ where: { id: outcome.jobId } });
    expect(job.rawRowsJson).toBeNull(); // cleared once imported
  });

  it("replays the same job instead of double-importing on a retried idempotency key", async () => {
    const csv = ["Date,Narration,Amount", "05/03/2025,TEST MERCHANT,-100.00"].join("\n");
    const key = randomUUID();

    const first = await uploadStatement(workspaceId, accountId, "retry.csv", Buffer.from(csv), key);
    const second = await uploadStatement(workspaceId, accountId, "retry.csv", Buffer.from(csv), key);

    expect(second.jobId).toBe(first.jobId);
    expect(second.transactionCount).toBe(first.transactionCount);

    const jobs = await prisma.uploadJob.count({ where: { workspaceId, idempotencyKey: key } });
    expect(jobs).toBe(1);

    const matching = await prisma.transaction.count({
      where: { workspaceId, accountId, description: "TEST MERCHANT" },
    });
    expect(matching).toBe(1);
  });

  it("rejects an upload for an account outside the workspace", async () => {
    const other = await createTestWorkspace("other-workspace");
    try {
      await expect(
        uploadStatement(
          workspaceId,
          other.account.id, // belongs to a different workspace
          "statement.csv",
          Buffer.from("Date,Narration,Amount\n01/03/2025,X,-1.00"),
          randomUUID(),
        ),
      ).rejects.toThrow();
    } finally {
      await cleanupWorkspace(other.workspace.id);
    }
  });
});
