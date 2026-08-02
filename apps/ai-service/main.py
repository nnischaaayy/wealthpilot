import json
from collections.abc import AsyncIterator
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

load_dotenv()

from agents._loop import AgentEvent  # noqa: E402
from agents.budget_coach import run_budget_coach  # noqa: E402
from agents.portfolio_analyst import run_portfolio_analyst  # noqa: E402
from agents.report_summarizer import run_report_summarizer  # noqa: E402
from agents.router import Intent, classify_intent  # noqa: E402
from embedding_client import EmbeddingClient  # noqa: E402
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


def _sse(event: dict[str, object]) -> str:
    return f"data: {json.dumps(event)}\n\n"


def _run_agent(
    intent: Intent,
    llm: LLMClient,
    workspace_id: str,
    conversation: list[dict[str, str]],
    embedding_client: EmbeddingClient,
) -> AsyncIterator[AgentEvent]:
    if intent is Intent.PORTFOLIO:
        return run_portfolio_analyst(llm, workspace_id, conversation)
    if intent is Intent.REPORT:
        return run_report_summarizer(llm, workspace_id, conversation, embedding_client)
    return run_budget_coach(llm, workspace_id, conversation)


async def _stream_chat(workspace_id: str, messages: list[ChatMessage]) -> AsyncIterator[str]:
    if not messages or messages[-1].role != "user":
        yield _sse({"type": "error", "text": "The last message must be from the user."})
        return

    intent = classify_intent(messages[-1].content)
    llm = LLMClient()
    embedding_client = EmbeddingClient()
    conversation = [{"role": m.role, "content": m.content} for m in messages]

    async for event in _run_agent(intent, llm, workspace_id, conversation, embedding_client):
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
