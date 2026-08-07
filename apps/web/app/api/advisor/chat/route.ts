import { z } from "zod";
import { prisma } from "@wealthpilot/db";
import { requireActiveWorkspace } from "@/lib/workspace-context";

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

export async function POST(request: Request) {
  const { workspaceId } = await requireActiveWorkspace();

  const body = chatRequestSchema.safeParse(await request.json());
  if (!body.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
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
