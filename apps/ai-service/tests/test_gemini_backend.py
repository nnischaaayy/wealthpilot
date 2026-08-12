import json

from gemini_backend import _to_gemini_contents


def test_plain_string_content_becomes_a_single_text_part() -> None:
    contents = _to_gemini_contents([{"role": "user", "content": "hi"}])

    assert contents == [{"role": "user", "parts": [{"text": "hi"}]}]


def test_assistant_role_maps_to_gemini_model_role() -> None:
    contents = _to_gemini_contents([{"role": "assistant", "content": "sure"}])

    assert contents[0]["role"] == "model"


def test_tool_use_block_becomes_a_function_call_part() -> None:
    messages = [
        {
            "role": "assistant",
            "content": [
                {"type": "text", "text": "checking..."},
                {"type": "tool_use", "id": "call-1", "name": "get_holdings", "input": {"x": 1}},
            ],
        }
    ]

    contents = _to_gemini_contents(messages)

    assert contents == [
        {
            "role": "model",
            "parts": [
                {"text": "checking..."},
                {"functionCall": {"name": "get_holdings", "args": {"x": 1}}},
            ],
        }
    ]


def test_tool_result_is_matched_back_to_its_call_name_by_id() -> None:
    messages = [
        {
            "role": "assistant",
            "content": [{"type": "tool_use", "id": "call-1", "name": "get_holdings", "input": {}}],
        },
        {
            "role": "user",
            "content": [
                {
                    "type": "tool_result",
                    "tool_use_id": "call-1",
                    "content": json.dumps({"total": 100}),
                }
            ],
        },
    ]

    contents = _to_gemini_contents(messages)

    assert contents[1] == {
        "role": "user",
        "parts": [{"functionResponse": {"name": "get_holdings", "response": {"total": 100}}}],
    }


def test_non_object_tool_result_payload_is_wrapped_for_gemini() -> None:
    messages = [
        {
            "role": "assistant",
            "content": [{"type": "tool_use", "id": "call-1", "name": "rag_lookup", "input": {}}],
        },
        {
            "role": "user",
            "content": [
                {
                    "type": "tool_result",
                    "tool_use_id": "call-1",
                    "content": json.dumps([{"title": "Emergency fund"}]),
                }
            ],
        },
    ]

    contents = _to_gemini_contents(messages)

    response = contents[1]["parts"][0]["functionResponse"]["response"]
    assert response == {"result": [{"title": "Emergency fund"}]}


def test_error_tool_result_plain_string_is_wrapped_not_json_parsed() -> None:
    messages = [
        {
            "role": "assistant",
            "content": [{"type": "tool_use", "id": "call-1", "name": "get_holdings", "input": {}}],
        },
        {
            "role": "user",
            "content": [
                {
                    "type": "tool_result",
                    "tool_use_id": "call-1",
                    "content": "Error: workspace not found",
                    "is_error": True,
                }
            ],
        },
    ]

    contents = _to_gemini_contents(messages)

    response = contents[1]["parts"][0]["functionResponse"]["response"]
    assert response == {"result": "Error: workspace not found"}


def test_unknown_tool_use_id_falls_back_to_a_placeholder_name() -> None:
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "tool_result", "tool_use_id": "missing", "content": json.dumps({})}
            ],
        }
    ]

    contents = _to_gemini_contents(messages)

    assert contents[0]["parts"][0]["functionResponse"]["name"] == "unknown_tool"
