import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { checkRateLimit } from "@/lib/rate-limit";

// Requires REDIS_URL to be set and Redis reachable (docker-compose) — same
// "live infra, not mocks" testing philosophy as the Postgres integration
// suite. Each test uses a fresh random key so runs don't interfere.
describe("checkRateLimit (live Redis)", () => {
  it("allows requests within capacity", async () => {
    const key = randomUUID();
    const result = await checkRateLimit(key, { capacity: 5, refillPerSecond: 1 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("denies once capacity is exhausted", async () => {
    const key = randomUUID();
    for (let i = 0; i < 3; i++) {
      const result = await checkRateLimit(key, { capacity: 3, refillPerSecond: 0.001 });
      expect(result.allowed).toBe(true);
    }
    const denied = await checkRateLimit(key, { capacity: 3, refillPerSecond: 0.001 });
    expect(denied.allowed).toBe(false);
    expect(denied.remaining).toBe(0);
  });

  it("tracks separate buckets independently by key", async () => {
    const keyA = randomUUID();
    const keyB = randomUUID();
    await checkRateLimit(keyA, { capacity: 1, refillPerSecond: 0.001 });
    const secondOnA = await checkRateLimit(keyA, { capacity: 1, refillPerSecond: 0.001 });
    const firstOnB = await checkRateLimit(keyB, { capacity: 1, refillPerSecond: 0.001 });

    expect(secondOnA.allowed).toBe(false);
    expect(firstOnB.allowed).toBe(true);
  });

  it("refills over time up to capacity", async () => {
    const key = randomUUID();
    await checkRateLimit(key, { capacity: 2, refillPerSecond: 20 }); // 1 left
    await checkRateLimit(key, { capacity: 2, refillPerSecond: 20 }); // 0 left
    const immediatelyDenied = await checkRateLimit(key, { capacity: 2, refillPerSecond: 20 });
    expect(immediatelyDenied.allowed).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 150)); // ~3 tokens at 20/s

    const afterRefill = await checkRateLimit(key, { capacity: 2, refillPerSecond: 20 });
    expect(afterRefill.allowed).toBe(true);
  });

  it("supports a custom cost per request", async () => {
    const key = randomUUID();
    const result = await checkRateLimit(key, { capacity: 10, refillPerSecond: 0.001, cost: 5 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(5);
  });
});
