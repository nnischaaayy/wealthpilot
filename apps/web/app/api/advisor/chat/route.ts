import { z } from "zod";
import { prisma } from "@wealthpilot/db";
import { requireActiveWorkspace } from "@/lib/workspace-context";
import { checkRateLimit } from "@/lib/rate-limit";

// Streaming a full LLM response can run past Vercel's default serverless
// function duration (10s on Hobby) — especially against a free-tier
// ai-service host that may still be warming a connection. 60s is the max
// allowed on the Hobby plan.
export const maxDuration = 60;

const chatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(50),
});

/**
 * Proxies to ai-service's /advisor/chat — never exposed directly to the
 * browser (architecture.md §12). This route is the trust boundary: it
 * authenticates the user and resolves their workspace membership before
 * forwarding workspace_id to ai-service, which trusts it as already-validated.
 */
function sseError(text: string): Response {
  return new Response(`data: ${JSON.stringify({ type: "error", text })}\n\n`, {
    headers: { "Content-Type": "text/event-stream" },
  });
}

// 20 messages per 5-minute window sustained, bursts up to 20 — generous
// enough for a real back-and-forth conversation while blocking a scripted
// flood against the (metered) LLM provider.
const CHAT_RATE_LIMIT = { capacity: 20, refillPerSecond: 20 / 300 };

export async function POST(request: Request) {
  const { workspaceId } = await requireActiveWorkspace();

  const body = chatRequestSchema.safeParse(await request.json());
  if (!body.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const { allowed } = await checkRateLimit(`chat:${workspaceId}`, CHAT_RATE_LIMIT);
  if (!allowed) {
    return sseError("You've sent a lot of messages — please slow down and try again shortly.");
  }

  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
  if (!workspace.aiEnabled) {
    return sseError(
      "The AI advisor is turned off for this workspace. Turn it back on in Settings to use it.",
    );
  }

  const aiServiceUrl = process.env.AI_SERVICE_URL;
  if (!aiServiceUrl) {
    return Response.json({ error: "AI_SERVICE_URL is not configured" }, { status: 500 });
  }

  const upstream = await fetch(`${aiServiceUrl}/advisor/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspace_id: workspaceId, messages: body.data.messages }),
  });

  if (!upstream.ok || !upstream.body) {
    return Response.json({ error: "AI advisor is unavailable" }, { status: 502 });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
