import "server-only";
import Redis from "ioredis";

/**
 * Redis-backed token-bucket rate limiter (architecture.md §14 — per-user/
 * per-workspace limits on uploads, chat messages, and API calls).
 *
 * Fails open: if REDIS_URL is unset or Redis is unreachable, every check
 * returns allowed=true rather than throwing. Abuse prevention degrading is
 * an acceptable trade-off for not taking down the whole app when the cache
 * is down — the same posture as the AI provider clients (Phase 5/6) and the
 * email client (Phase 7): a missing optional dependency degrades a feature,
 * it doesn't crash the request.
 */

let client: Redis | null | undefined;

function getClient(): Redis | null {
  if (client !== undefined) return client;
  const url = process.env.REDIS_URL;
  if (!url) {
    client = null;
    return client;
  }
  client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
  client.on("error", () => {
    // Swallowed deliberately — checkRateLimit's try/catch is what decides
    // fail-open behavior; an unhandled 'error' event would otherwise crash
    // the Node process.
  });
  return client;
}

// Atomic token-bucket refill + consume. KEYS[1] = bucket key.
// ARGV: capacity, refillPerSecond, nowMs, requested.
const TOKEN_BUCKET_SCRIPT = `
local bucket = redis.call("HMGET", KEYS[1], "tokens", "timestamp")
local tokens = tonumber(bucket[1])
local timestamp = tonumber(bucket[2])
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])

if tokens == nil then
  tokens = capacity
  timestamp = now
end

local delta = math.max(0, now - timestamp) / 1000
local filled = math.min(capacity, tokens + delta * refill_rate)

local allowed = 0
if filled >= requested then
  allowed = 1
  filled = filled - requested
end

redis.call("HMSET", KEYS[1], "tokens", filled, "timestamp", now)
redis.call("EXPIRE", KEYS[1], math.ceil(capacity / refill_rate) + 60)

return {allowed, filled}
`;

export interface RateLimitOptions {
  /** Max tokens the bucket holds — the size of an allowed burst. */
  capacity: number;
  /** Tokens restored per second — the sustained rate. */
  refillPerSecond: number;
  /** Tokens this request costs. Default 1. */
  cost?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

export async function checkRateLimit(key: string, options: RateLimitOptions): Promise<RateLimitResult> {
  const redis = getClient();
  const { capacity, refillPerSecond, cost = 1 } = options;

  if (!redis) {
    return { allowed: true, remaining: capacity };
  }

  try {
    const [allowed, remaining] = (await redis.eval(
      TOKEN_BUCKET_SCRIPT,
      1,
      `ratelimit:${key}`,
      capacity,
      refillPerSecond,
      Date.now(),
      cost,
    )) as [number, string];
    return { allowed: allowed === 1, remaining: Math.floor(Number(remaining)) };
  } catch {
    return { allowed: true, remaining: capacity };
  }
}
