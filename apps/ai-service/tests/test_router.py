from agents.router import Intent, classify_intent


def test_budget_keywords_route_to_budget() -> None:
    assert classify_intent("How much did I spend on dining last month?") == Intent.BUDGET
    assert classify_intent("Can I afford a $500 loan payment?") == Intent.BUDGET
    assert classify_intent("What's my cash flow looking like?") == Intent.BUDGET


def test_portfolio_keywords_route_to_portfolio() -> None:
    assert classify_intent("How is my portfolio allocated?") == Intent.PORTFOLIO
    assert classify_intent("What's my risk score?") == Intent.PORTFOLIO
    assert classify_intent("Should I buy more of this stock?") == Intent.PORTFOLIO


def test_report_keywords_route_to_report() -> None:
    assert classify_intent("Summarize my spending this month") == Intent.REPORT
    assert classify_intent("Give me an overview of my finances") == Intent.REPORT


def test_ambiguous_message_defaults_to_budget() -> None:
    assert classify_intent("Hello, what can you help me with?") == Intent.BUDGET


def test_is_case_insensitive() -> None:
    assert classify_intent("SUMMARIZE my month") == Intent.REPORT
    assert classify_intent("PORTFOLIO risk?") == Intent.PORTFOLIO
