from privacy.redaction import redact

# Golden fixtures: realistic bank-statement narration / chat text in, exact
# redacted text out. These are the contract — if a fixture needs to change,
# that's a deliberate decision about what counts as PII, not a drive-by edit.
GOLDEN_FIXTURES: list[tuple[str, str]] = [
    (
        "NEFT to account 123456789012 for rent",
        "NEFT to account [REDACTED:account_number] for rent",
    ),
    (
        "UPI/priya@okhdfcbank/Groceries at BigBasket",
        "UPI/[REDACTED:payment_handle]/Groceries at BigBasket",
    ),
    (
        "Card payment 4111 1111 1111 1234 at Amazon",
        "Card payment [REDACTED:card_number] at Amazon",
    ),
    (
        "IMPS ref UTR2024011212345678 salary credit",
        "IMPS [REDACTED:reference_id] salary credit",
    ),
    (
        "RRN-998877665544 refund from Swiggy",
        "[REDACTED:reference_id] refund from Swiggy",
    ),
    # Should NOT be touched — ordinary merchant/category text
    ("Swiggy order #4521", "Swiggy order #4521"),
    ("Salary credit for March 2025", "Salary credit for March 2025"),
    ("Amazon Pay - electronics", "Amazon Pay - electronics"),
    ("Zomato", "Zomato"),
]


def test_golden_fixtures() -> None:
    for input_text, expected in GOLDEN_FIXTURES:
        result = redact(input_text)
        assert result.text == expected, f"input={input_text!r}"


def test_flags_redacted_true_only_when_something_matched() -> None:
    assert redact("NEFT to account 1234567890123456").redacted is True
    assert redact("Zomato").redacted is False


def test_empty_string_is_a_noop() -> None:
    result = redact("")
    assert result.text == ""
    assert result.redacted is False
    assert result.matches == []


def test_multiple_pii_items_in_one_string_all_redacted() -> None:
    text = "Transfer to account 9876543210 to priya@okhdfcbank ref UTR20240112345678"
    result = redact(text)
    assert "9876543210" not in result.text
    assert "priya@okhdfcbank" not in result.text
    assert "UTR20240112345678" not in result.text
    assert result.matches == ["reference_id", "payment_handle", "account_number"]


def test_dates_and_small_amounts_are_not_redacted() -> None:
    assert redact("Paid 01/03/2025 amount 500.00").redacted is False
