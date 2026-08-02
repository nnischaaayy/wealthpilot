"""PII redaction gateway (architecture.md §13.2).

Mandatory pre-LLM step: account numbers, reference/transaction IDs, and raw
payment strings (UPI VPAs, card numbers) never leave the process boundary to
the LLM provider. Regex + rule-based, not ML — this needs to be auditable and
deterministic, not "probably works."

Each pattern is deliberately anchored (prefixed codes, @-delimited VPAs,
long digit runs) rather than "any word with a digit in it," so ordinary
merchant names and free-text notes pass through untouched.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    # UPI VPA / email-shaped payment handles: user@bankhandle, user@okhdfcbank
    ("payment_handle", re.compile(r"\b[\w.+-]{2,64}@[A-Za-z][A-Za-z0-9.-]{1,63}\b")),
    # Card numbers: contiguous 13-19 digits, or grouped in 4s (allow spaces or hyphens)
    ("card_number", re.compile(r"\b\d{4}[ -]\d{4}[ -]\d{4}[ -]\d{1,7}\b|\b\d{13,19}\b")),
    # Bank account numbers: contiguous 9-18 digit runs not already caught above
    ("account_number", re.compile(r"\b\d{9,18}\b")),
    # Reference / transaction IDs: bank rail prefix followed by an alphanumeric code
    (
        "reference_id",
        re.compile(
            r"\b(?:UTR|RRN|REF|TXN|IMPS|NEFT|RTGS|UPI)[/:\- ]?[A-Za-z0-9]{6,24}\b",
            re.IGNORECASE,
        ),
    ),
]


@dataclass
class RedactionResult:
    text: str
    redacted: bool = False
    matches: list[str] = field(default_factory=list)  # rule names that fired, in order


def redact(text: str) -> RedactionResult:
    """Replaces PII substrings with a `[REDACTED:<rule>]` placeholder.

    Order matters: card_number and reference_id are matched before the
    broader account_number pattern would otherwise consume the same digits.
    """
    if not text:
        return RedactionResult(text=text)

    result = text
    matches: list[str] = []

    # reference_id and payment_handle first (structurally distinctive, low
    # false-positive risk), then card_number, then the broadest pattern
    # (account_number) last so it only mops up what's left.
    ordered = ["reference_id", "payment_handle", "card_number", "account_number"]
    patterns = dict(_PATTERNS)

    for name in ordered:
        pattern = patterns[name]

        def _sub(m: re.Match[str], rule: str = name) -> str:
            matches.append(rule)
            return f"[REDACTED:{rule}]"

        result = pattern.sub(_sub, result)

    return RedactionResult(text=result, redacted=bool(matches), matches=matches)
