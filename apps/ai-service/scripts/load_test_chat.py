"""Load/perf check for /advisor/chat (architecture.md §15 — "k6 (basic):
chat streaming latency budget"). k6 itself isn't installable in this
environment (needs an elevated Windows install this session doesn't have);
this measures the same thing k6 would via concurrent HTTP requests and
percentile reporting.

Caveat, stated plainly: without a real ANTHROPIC_API_KEY configured, every
request takes the graceful-degradation path (agents/_loop.py's
"not configured" short-circuit) instead of actually streaming tokens from
Claude. What this measures is real and useful on its own — proxy routing,
intent classification, rate-limit check, and the SSE response plumbing —
but it is NOT a measurement of real LLM streaming latency. Re-run this with
a configured key to get that number.

Usage (with apps/ai-service running on :8000):
    .venv/Scripts/python.exe scripts/load_test_chat.py
"""

from __future__ import annotations

import asyncio
import time

import httpx

BASE_URL = "http://localhost:8000"
CONCURRENCY = 20


async def one_request(client: httpx.AsyncClient, i: int) -> float:
    start = time.perf_counter()
    async with client.stream(
        "POST",
        "/advisor/chat",
        json={
            "workspace_id": f"load-test-ws-{i}",
            "messages": [{"role": "user", "content": "How much did I spend on dining?"}],
        },
    ) as response:
        async for _ in response.aiter_bytes():
            break  # time-to-first-byte is what we care about
    return (time.perf_counter() - start) * 1000


def percentile(sorted_values: list[float], p: float) -> float:
    index = min(len(sorted_values) - 1, int(len(sorted_values) * p))
    return sorted_values[index]


async def main() -> None:
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        health = await client.get("/health")
        health.raise_for_status()

        start = time.perf_counter()
        durations = await asyncio.gather(*(one_request(client, i) for i in range(CONCURRENCY)))
        total = time.perf_counter() - start

    durations.sort()
    print(f"[load: chat] concurrency={CONCURRENCY} total_wall_time={total * 1000:.0f}ms")
    print(
        f"[load: chat] p50={percentile(durations, 0.5):.0f}ms "
        f"p95={percentile(durations, 0.95):.0f}ms "
        f"p99={percentile(durations, 0.99):.0f}ms "
        f"max={durations[-1]:.0f}ms"
    )


if __name__ == "__main__":
    asyncio.run(main())
