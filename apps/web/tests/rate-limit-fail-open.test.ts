import { describe, expect, it, vi } from "vitest";

// Its own file so rate-limit.ts's module-scoped client cache starts fresh —
// the integration suite (tests/integration/rate-limit.test.ts) exercises a
// real Redis connection, which would otherwise already be cached by the
// time a test here tried to unset REDIS_URL.
describe("checkRateLimit fail-open behavior", () => {
  it("allows every request when REDIS_URL is unset", async () => {
    vi.stubEnv("REDIS_URL", "");
    const { checkRateLimit } = await import("@/lib/rate-limit");

    const result = await checkRateLimit("some-key", { capacity: 3, refillPerSecond: 1 });

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(3);
  });
});
