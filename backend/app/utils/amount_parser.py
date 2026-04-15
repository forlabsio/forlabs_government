"""
Korean currency amount parser.

Extracts the maximum KRW amount from a grant summary string.
Handles patterns like: 최대 1.5억원, 3,000만원, 최대 500만, 1억 등
Returns the maximum parsed amount in KRW (정수, 원 단위).
"""
from __future__ import annotations

import re

# Match patterns: optional comma-separated number with optional decimal, followed by 억/만
# Examples: 1.5억, 1,500만, 300만원, 2억원, 500만
_PATTERN = re.compile(
    r"(\d[\d,]*(?:\.\d+)?)\s*(?:억원|억|만원|만)",
    re.UNICODE,
)


def parse_amount_max(text: str | None) -> int | None:
    """
    Parse the maximum Korean currency amount from a text string.

    Returns the value in KRW (원) as an integer, or None if nothing found.

    Examples:
        "최대 1,300만원 지원" → 13_000_000
        "최대 2억원" → 200_000_000
        "1.5억 한도" → 150_000_000
        "30만원~200만원" → 2_000_000  (max of the range)
    """
    if not text:
        return None

    amounts: list[int] = []
    for m in _PATTERN.finditer(text):
        num_str = m.group(1).replace(",", "")
        unit_str = m.group(0)[len(m.group(1)):].strip()  # everything after the number
        try:
            num = float(num_str)
        except ValueError:
            continue

        if "억" in unit_str:
            krw = int(num * 1_0000_0000)
        else:  # 만
            krw = int(num * 1_0000)

        # Sanity bounds: ignore amounts < 1만 or > 1,000억 (likely noise)
        if 10_000 <= krw <= 1_000_000_000_000:
            amounts.append(krw)

    return max(amounts) if amounts else None
