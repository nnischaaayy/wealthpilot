import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { uploadStatement } from "@/features/transactions/server/service";
import { createTestWorkspace, cleanupWorkspace } from "../integration/helpers";

/**
 * Load/perf check (architecture.md §15 — "k6 (basic): upload endpoint under
 * concurrent load"). k6 itself isn't installable in this environment
 * (requires an elevated Windows install this session doesn't have); this
 * exercises the same real bottleneck — statement parsing, categorization,
 * and DB writes — directly against live Postgres with real concurrency,
 * which is what actually matters for this feature's scalability (the HTTP/
 * Server Action transport layer on top is Next.js's concern, not this
 * app's). Run with `npm run test:load` — deliberately not part of the
 * default `test`/`test:integration` scripts or CI, matching k6's usual
 * "run when you need it" posture rather than gating every PR.
 */

function csvFixture(rowCount: number): Buffer {
  const rows = ["Date,Narration,Amount"];
  for (let i = 0; i < rowCount; i++) {
    const day = String((i % 27) + 1).padStart(2, "0");
    rows.push(`${day}/03/2025,LOAD TEST MERCHANT ${i},-${((i % 500) + 1).toFixed(2)}`);
  }
  return Buffer.from(rows.join("\n"));
}

function percentile(sorted: number[], p: number): number {
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[index];
}

describe("load: statement upload under concurrency", () => {
  it(
    "handles concurrent uploads to the same workspace and reports latency percentiles",
    async () => {
      const CONCURRENCY = 20;
      const ROWS_PER_STATEMENT = 50;

      const { workspace, account } = await createTestWorkspace("load-upload");
      try {
        const durationsMs: number[] = [];

        const results = await Promise.allSettled(
          Array.from({ length: CONCURRENCY }, async (_, i) => {
            const start = performance.now();
            const outcome = await uploadStatement(
              workspace.id,
              account.id,
              `load-test-${i}.csv`,
              csvFixture(ROWS_PER_STATEMENT),
              randomUUID(),
            );
            durationsMs.push(performance.now() - start);
            return outcome;
          }),
        );

        const succeeded = results.filter((r) => r.status === "fulfilled").length;
        const failed = results.filter((r) => r.status === "rejected");
        durationsMs.sort((a, b) => a - b);

        console.log(
          `\n[load: upload] concurrency=${CONCURRENCY} rows/statement=${ROWS_PER_STATEMENT} ` +
            `succeeded=${succeeded}/${CONCURRENCY}\n` +
            `[load: upload] p50=${percentile(durationsMs, 0.5).toFixed(0)}ms ` +
            `p95=${percentile(durationsMs, 0.95).toFixed(0)}ms ` +
            `p99=${percentile(durationsMs, 0.99).toFixed(0)}ms ` +
            `max=${durationsMs[durationsMs.length - 1].toFixed(0)}ms`,
        );
        if (failed.length > 0) {
          console.log("[load: upload] failures:", failed.map((f) => (f as PromiseRejectedResult).reason));
        }

        expect(succeeded).toBe(CONCURRENCY);
      } finally {
        await cleanupWorkspace(workspace.id);
      }
    },
    60_000,
  );
});
