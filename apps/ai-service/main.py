import json
from collections.abc import AsyncIterator
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

load_dotenv()

from agents.budget_coach import run_budget_coach  # noqa: E402
from agents.router import Intent, classify_intent  # noqa: E402
from llm_client import LLMClient  # noqa: E402

app = FastAPI(title="WealthPilot AI Service")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ai-service"}


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    workspace_id: str
    messages: list[ChatMessage]


# Portfolio Analyst and Report Summarizer land in Phase 6 alongside RAG
# (architecture.md §17). Until then the router still classifies these
# intents so the user gets an honest "not yet" instead of Budget Coach
# trying (and failing) to answer a question outside its tool set.
_NOT_YET_AVAILABLE: dict[Intent, str] = {
    Intent.PORTFOLIO: (
        "Portfolio analysis through the AI advisor is coming in a later phase — for now, "
        "check the Portfolio page for allocation, gain/loss, and risk score."
    ),
    Intent.REPORT: (
        "Monthly/quarterly summaries through the AI advisor are coming in a later phase — "
        "for now, check the Dashboard page for your KPIs and cash flow."
    ),
}


def _sse(event: dict[str, object]) -> str:
    return f"data: {json.dumps(event)}\n\n"


async def _stream_chat(workspace_id: str, messages: list[ChatMessage]) -> AsyncIterator[str]:
    if not messages or messages[-1].role != "user":
        yield _sse({"type": "error", "text": "The last message must be from the user."})
        return

    intent = classify_intent(messages[-1].content)
    not_yet_available = _NOT_YET_AVAILABLE.get(intent)
    if not_yet_available is not None:
        yield _sse({"type": "done", "text": not_yet_available})
        return

    llm = LLMClient()
    conversation = [{"role": m.role, "content": m.content} for m in messages]
    async for event in run_budget_coach(llm, workspace_id, conversation):
        yield _sse(
            {
                "type": event.type,
                "text": event.text,
                "toolName": event.tool_name,
                "detail": event.detail,
            }
        )


@app.post("/advisor/chat")
async def advisor_chat(request: ChatRequest) -> StreamingResponse:
    """Internal endpoint — never exposed directly to the browser (architecture.md §12).
    apps/web authenticates the user and resolves their workspace membership before
    proxying here; workspace_id is trusted as already-validated by that caller.
    """
    return StreamingResponse(
        _stream_chat(request.workspace_id, request.messages),
        media_type="text/event-stream",
    )
