"""
Parse grant eligibility requirements from summary text using Claude API.

Design principle: Call Claude once per grant, store result in parsed_requirements.
Subsequent eligibility checks read from DB only — no API calls.
"""
from __future__ import annotations

import json
import logging
import re

import anthropic

from app.config import settings

logger = logging.getLogger(__name__)

MIN_SUMMARY_LEN = 30
CLAUDE_MODEL = "claude-3-haiku-20240307"

SYSTEM_PROMPT = """You are a structured data extractor for Korean government grant announcements.
Extract eligibility requirements from the provided Korean text and return ONLY a JSON object.
If a field cannot be determined from the text, use null.

Return exactly this JSON structure (no markdown, no explanation):
{
  "max_company_age_years": <integer or null>,
  "min_company_age_years": <integer or null>,
  "allowed_industries": <array of Korean industry names or empty array>,
  "excluded_industries": <array of explicitly excluded industry names or empty array>,
  "allowed_regions": <array of Korean region names or empty array>,
  "metropolitan_only": <true if 수도권/서울/경기/인천 only; false if 비수도권/지방 only; null if no restriction>,
  "max_revenue_krw": <integer in KRW or null>,
  "min_revenue_krw": <integer in KRW or null>,
  "target_age_range": <string describing age requirement or null>,
  "employee_count_max": <integer or null>,
  "employee_count_min": <integer or null>,
  "require_corporate": <true if 법인 required, false if 개인사업자도 가능, null if no restriction>,
  "require_venture_cert": <true if 벤처기업 certification required, null if no restriction>,
  "unextracted_conditions": <array of important eligibility conditions that don't fit above fields, or empty array>,
  "parse_confidence": <"high" | "medium" | "low">
}

parse_confidence rules:
- "high": most fields clearly stated in text
- "medium": some fields inferred or ambiguous
- "low": very little eligibility info in text

Extraction notes:
- metropolitan_only: true = 수도권(서울/경기/인천) 소재 기업만, false = 비수도권 기업만(지역특화/지방)
- excluded_industries: 유흥업, 도박업, 부동산임대업 등 명시적으로 제외된 업종만
- require_corporate: 법인만 가능하면 true, 개인사업자도 허용이면 false, 언급 없으면 null
- unextracted_conditions: 위 필드로 표현할 수 없는 중요 요건(인증 필요, 특정 자격 요건 등)을 raw 텍스트로"""


async def parse_requirements(summary: str) -> dict | None:
    """
    Parse grant eligibility requirements from summary text.

    Returns a dict matching the schema, or None if summary is too short or API fails.
    """
    if not summary or len(summary.strip()) < MIN_SUMMARY_LEN:
        return None

    if not settings.anthropic_api_key:
        logger.warning("ANTHROPIC_API_KEY not set — skipping requirement parsing")
        return None

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    try:
        message = await client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=800,
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": f"Extract requirements from this grant announcement:\n\n{summary[:2000]}"
                }
            ],
        )

        raw = message.content[0].text.strip()
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)

        parsed = json.loads(raw)

        required_keys = {
            "max_company_age_years", "min_company_age_years",
            "allowed_industries", "excluded_industries",
            "allowed_regions", "metropolitan_only",
            "max_revenue_krw", "min_revenue_krw",
            "target_age_range",
            "employee_count_max", "employee_count_min",
            "require_corporate", "require_venture_cert",
            "unextracted_conditions", "parse_confidence",
        }
        if not required_keys.issubset(parsed.keys()):
            logger.warning("Claude response missing required keys: %s", raw[:200])
            return None

        return parsed

    except json.JSONDecodeError as e:
        logger.warning("Failed to parse Claude JSON response: %s", e)
        return None
    except anthropic.APIError as e:
        logger.error("Anthropic API error: %s", e)
        return None
    except Exception as e:
        logger.error("Unexpected error in parse_requirements: %s", e)
        return None
