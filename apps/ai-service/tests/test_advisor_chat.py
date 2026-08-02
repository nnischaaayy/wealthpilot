import json

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def _parse_sse(body: str) -> list[dict]:
    events = []
    for chunk in body.split("\n\n"):
        chunk = chunk.strip()
        if not chunk:
            continue
        assert chunk.startswith("data: ")
        events.append(json.loads(chunk[len("data: ") :]))
    return events


def test_rejects_when_last_message_is_not_from_the_user() -> None:
    response = client.post(
        "/advisor/chat",
        json={"workspace_id": "ws-1", "messages": [{"role": "assistant", "content": "hi"}]},
    )
    assert response.status_code == 200
    events = _parse_sse(response.text)
    assert len(events) == 1
    assert events[0]["type"] == "error"


def test_portfolio_intent_without_api_key_degrades_gracefully() -> None:
    response = client.post(
        "/advisor/chat",
        json={
            "workspace_id": "ws-1",
            "messages": [{"role": "user", "content": "What's my portfolio risk score?"}],
        },
    )
    events = _parse_sse(response.text)
    assert len(events) == 1
    assert events[0]["type"] == "error"
    assert "ANTHROPIC_API_KEY" in events[0]["text"]


def test_report_intent_without_api_key_degrades_gracefully() -> None:
    response = client.post(
        "/advisor/chat",
        json={
            "workspace_id": "ws-1",
            "messages": [{"role": "user", "content": "Summarize my spending this month"}],
        },
    )
    events = _parse_sse(response.text)
    assert len(events) == 1
    assert events[0]["type"] == "error"
    assert "ANTHROPIC_API_KEY" in events[0]["text"]


def test_budget_intent_without_api_key_degrades_gracefully() -> None:
    response = client.post(
        "/advisor/chat",
        json={
            "workspace_id": "ws-1",
            "messages": [{"role": "user", "content": "How much did I spend on dining?"}],
        },
    )
    events = _parse_sse(response.text)
    assert len(events) == 1
    assert events[0]["type"] == "error"
    assert "ANTHROPIC_API_KEY" in events[0]["text"]
