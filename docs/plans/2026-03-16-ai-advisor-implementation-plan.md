# AI 과제 어드바이저 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the platform's "so what?" into "이번 주 우리 회사 과제 기회 4.2억" — adding Claude-powered requirement parsing, eligibility scoring with checklist, and a shareable weekly briefing page.

**Architecture:** Claude API parses grant summaries once → `parsed_requirements JSONB` stored in DB → deterministic rule-based eligibility scoring (no API calls at match time) → `/briefing` page aggregates user's opportunity data from DB.

**Tech Stack:** FastAPI + SQLAlchemy async + PostgreSQL (Supabase) + anthropic Python SDK + Next.js 16 + @vercel/og + Foundry dark theme (FOUNDRY constants from `lib/theme.ts`)

---

## Context & Key Conventions

- **Repo root:** `/Users/peterchae/forlabs_government`
- **Auth:** Bearer token = raw user UUID string. `get_current_user` in `backend/app/deps.py` returns `User` ORM object.
- **DB:** Async SQLAlchemy sessions via `get_db`. All queries use `await db.execute(select(...))`.
- **Models:** `backend/app/models.py` — `GrantProject` has `id: UUID`, `title`, `summary`, `target_industry ARRAY`, `target_region ARRAY`, `target_age VARCHAR`, `amount_max`, `end_date`, `status`. No `parsed_requirements` yet.
- **Schemas:** `backend/app/schemas.py` — `UserResponse` has `company_name`, `industry`, `company_age`, `region`, `employee_count`, `revenue_range`.
- **Matching endpoint:** `backend/app/routers/intelligence.py` → `POST /api/intelligence/match`. Returns `MatchResult` with `matched_grants[{grant_id, title, amount_max, end_date, organization, category, match_score, match_reasons}]` + `graph` + `match_reason`.
- **Frontend API client:** `frontend/src/lib/api.ts` — all API calls pattern: `fetch(${API_URL}/api/..., { headers: { Authorization: \`Bearer ${token}\` }})`. `MatchResult` type defined here.
- **Collectors:** `backend/app/collectors/base.py` — `BaseCollector.run()` saves grants. Hook for new grants should go after `await db.commit()`.
- **Test runner:** No existing test suite — write unit tests in `backend/tests/` using `pytest`. Run with `cd backend && python -m pytest tests/ -v`.
- **Deploy:** `git push origin main` triggers Railway auto-deploy. Do NOT run `railway up`.
- **Foundry theme:** Import `{ FOUNDRY }` from `@/lib/theme` in all frontend files.

---

## Phase 1: Requirement Parsing Pipeline

### Task 1: Dependencies + Alembic Migration

**Files:**
- Modify: `backend/pyproject.toml`
- Modify: `backend/app/config.py`
- Modify: `backend/app/models.py`
- Create: `backend/alembic/versions/XXXX_add_parsed_requirements.py`

**Step 1: Add anthropic dependency**

In `backend/pyproject.toml`, in the `[project] dependencies` array, add:
```toml
"anthropic>=0.40.0",
```

**Step 2: Add ANTHROPIC_API_KEY to config**

In `backend/app/config.py`, in the `Settings` class, add after the existing API key fields:
```python
anthropic_api_key: str = ""
```

Also add to `.env.example` or note: set `ANTHROPIC_API_KEY` in Railway environment variables.

**Step 3: Add parsed_requirements column to GrantProject model**

In `backend/app/models.py`, in the `GrantProject` class, add after the `target_age` column:
```python
from sqlalchemy import JSON
# (add JSON to existing imports from sqlalchemy)

parsed_requirements: Mapped[dict | None] = mapped_column(
    JSON, nullable=True, default=None
)
```

**Step 4: Generate and run Alembic migration**

```bash
cd /Users/peterchae/forlabs_government/backend
alembic revision --autogenerate -m "add_parsed_requirements"
```

Verify the generated file in `alembic/versions/` contains:
```python
op.add_column('grant_projects',
    sa.Column('parsed_requirements', sa.JSON(), nullable=True)
)
```

Apply locally (if local DB):
```bash
alembic upgrade head
```

For production Supabase, the migration runs on Railway deploy via `alembic upgrade head` in startup (check `main.py` or `Dockerfile` for the startup command).

**Step 5: Verify model loads without error**

```bash
cd /Users/peterchae/forlabs_government/backend
python -c "from app.models import GrantProject; print(GrantProject.__table__.columns.keys())"
```

Expected output includes `parsed_requirements`.

**Step 6: Commit**

```bash
cd /Users/peterchae/forlabs_government
git add backend/pyproject.toml backend/app/config.py backend/app/models.py backend/alembic/versions/
git commit -m "feat: add parsed_requirements JSONB column + anthropic dependency"
```

---

### Task 2: Requirement Parser Service

**Files:**
- Create: `backend/app/services/requirement_parser.py`
- Create: `backend/tests/test_requirement_parser.py`

**Step 1: Write failing test**

Create `backend/tests/__init__.py` (empty) if it doesn't exist.

Create `backend/tests/test_requirement_parser.py`:
```python
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.requirement_parser import parse_requirements, RequirementsSchema

SAMPLE_SUMMARY = """
본 사업은 서울 소재 창업 후 7년 이내 중소기업(직원 50인 미만)을 대상으로
AI·소프트웨어 분야 기술 개발을 지원합니다. 연매출 30억 미만 기업에 한함.
최대 5,000만원 지원.
"""

MOCK_RESPONSE = {
    "max_company_age_years": 7,
    "min_company_age_years": None,
    "allowed_industries": ["AI", "소프트웨어"],
    "allowed_regions": ["서울"],
    "max_revenue_krw": 3000000000,
    "target_age_range": None,
    "employee_count_max": 50,
    "parse_confidence": "high"
}

@pytest.mark.asyncio
async def test_parse_requirements_returns_schema():
    with patch("app.services.requirement_parser.anthropic.AsyncAnthropic") as mock_client_class:
        mock_client = AsyncMock()
        mock_client_class.return_value = mock_client

        mock_message = MagicMock()
        mock_message.content = [MagicMock(text=str(MOCK_RESPONSE).replace("'", '"'))]
        mock_client.messages.create = AsyncMock(return_value=mock_message)

        result = await parse_requirements(SAMPLE_SUMMARY)

        assert result is not None
        assert isinstance(result, dict)

@pytest.mark.asyncio
async def test_parse_requirements_empty_summary():
    result = await parse_requirements("")
    assert result is None

@pytest.mark.asyncio
async def test_parse_requirements_short_summary():
    result = await parse_requirements("지원사업입니다.")
    # Short text should return low confidence or None without API call
    assert result is None or result.get("parse_confidence") in ("low", "medium", "high")
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/peterchae/forlabs_government/backend
python -m pytest tests/test_requirement_parser.py -v
```

Expected: `ModuleNotFoundError: No module named 'app.services.requirement_parser'`

**Step 3: Create the service**

Create `backend/app/services/__init__.py` (empty) if it doesn't exist.

Create `backend/app/services/requirement_parser.py`:
```python
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

# Minimum summary length to attempt parsing
MIN_SUMMARY_LEN = 30

# Claude model — haiku is cheap and sufficient for structured extraction
CLAUDE_MODEL = "claude-haiku-4-5-20251001"

SYSTEM_PROMPT = """You are a structured data extractor for Korean government grant announcements.
Extract eligibility requirements from the provided Korean text and return ONLY a JSON object.
If a field cannot be determined from the text, use null.

Return exactly this JSON structure (no markdown, no explanation):
{
  "max_company_age_years": <integer or null>,
  "min_company_age_years": <integer or null>,
  "allowed_industries": <array of Korean industry names or empty array>,
  "allowed_regions": <array of Korean region names or empty array>,
  "max_revenue_krw": <integer in KRW or null>,
  "target_age_range": <string describing age requirement or null>,
  "employee_count_max": <integer or null>,
  "parse_confidence": <"high" | "medium" | "low">
}

parse_confidence rules:
- "high": most fields clearly stated in text
- "medium": some fields inferred or ambiguous
- "low": very little eligibility info in text"""


async def parse_requirements(summary: str) -> dict | None:
    """
    Parse grant eligibility requirements from summary text.

    Returns a dict matching the RequirementsSchema, or None if summary is too short
    or API call fails.
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
            max_tokens=512,
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": f"Extract requirements from this grant announcement:\n\n{summary[:2000]}"
                }
            ],
        )

        raw = message.content[0].text.strip()

        # Strip markdown code fences if present
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)

        parsed = json.loads(raw)

        # Validate required keys exist
        required_keys = {
            "max_company_age_years", "min_company_age_years",
            "allowed_industries", "allowed_regions",
            "max_revenue_krw", "target_age_range",
            "employee_count_max", "parse_confidence"
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
```

**Step 4: Install dependency and run tests**

```bash
cd /Users/peterchae/forlabs_government/backend
pip install anthropic
python -m pytest tests/test_requirement_parser.py -v
```

Expected: All 3 tests PASS.

**Step 5: Commit**

```bash
cd /Users/peterchae/forlabs_government
git add backend/app/services/ backend/tests/
git commit -m "feat: add requirement_parser service using Claude haiku API"
```

---

### Task 3: Batch Parse Script

**Files:**
- Create: `backend/scripts/batch_parse.py`

**Step 1: Write the script**

Create `backend/scripts/__init__.py` (empty) if not present.

Create `backend/scripts/batch_parse.py`:
```python
"""
One-time batch script to parse existing grants without parsed_requirements.

Usage:
    cd /Users/peterchae/forlabs_government/backend
    python -m scripts.batch_parse [--limit N] [--dry-run]

Cost estimate:
    10,000 grants × ~200 tokens each ≈ 2M tokens × $0.0001/1k = ~$0.20
    (haiku input pricing)
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import time

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.config import settings
from app.models import GrantProject
from app.services.requirement_parser import parse_requirements

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

BATCH_SIZE = 50
DELAY_BETWEEN_BATCHES = 2.0  # seconds, to respect rate limits


async def batch_parse(limit: int | None = None, dry_run: bool = False) -> None:
    engine = create_async_engine(settings.database_url, echo=False)
    SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with SessionLocal() as db:
        # Query all grants without parsed_requirements that have a summary
        q = (
            select(GrantProject)
            .where(GrantProject.parsed_requirements.is_(None))
            .where(GrantProject.summary.isnot(None))
            .order_by(GrantProject.created_at.desc())
        )
        if limit:
            q = q.limit(limit)

        result = await db.execute(q)
        grants = result.scalars().all()

    logger.info("Found %d grants to parse", len(grants))

    if dry_run:
        logger.info("Dry run — exiting without API calls")
        return

    processed = 0
    failed = 0

    async with SessionLocal() as db:
        for i in range(0, len(grants), BATCH_SIZE):
            batch = grants[i : i + BATCH_SIZE]
            logger.info("Processing batch %d/%d (grants %d-%d)",
                       i // BATCH_SIZE + 1,
                       (len(grants) + BATCH_SIZE - 1) // BATCH_SIZE,
                       i, min(i + BATCH_SIZE, len(grants)))

            for grant in batch:
                try:
                    parsed = await parse_requirements(grant.summary or "")
                    if parsed:
                        await db.execute(
                            update(GrantProject)
                            .where(GrantProject.id == grant.id)
                            .values(parsed_requirements=parsed)
                        )
                        processed += 1
                    else:
                        failed += 1
                        logger.debug("No requirements extracted for grant %s", grant.id)
                except Exception as e:
                    failed += 1
                    logger.error("Error parsing grant %s: %s", grant.id, e)

            await db.commit()
            logger.info("Batch done. Total processed: %d, failed/skipped: %d", processed, failed)

            if i + BATCH_SIZE < len(grants):
                time.sleep(DELAY_BETWEEN_BATCHES)

    logger.info("Batch parse complete. Processed: %d, Failed/skipped: %d", processed, failed)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Batch parse grant requirements")
    parser.add_argument("--limit", type=int, default=None, help="Max grants to process")
    parser.add_argument("--dry-run", action="store_true", help="Show count without calling API")
    args = parser.parse_args()

    asyncio.run(batch_parse(limit=args.limit, dry_run=args.dry_run))
```

**Step 2: Test dry run locally**

```bash
cd /Users/peterchae/forlabs_government/backend
python -m scripts.batch_parse --dry-run
```

Expected: Shows count of unparsed grants, exits without API calls.

**Step 3: Run on small batch to validate**

```bash
python -m scripts.batch_parse --limit 10
```

Expected: 10 grants processed, check DB for `parsed_requirements` being set.

**Step 4: Commit**

```bash
cd /Users/peterchae/forlabs_government
git add backend/scripts/
git commit -m "feat: batch_parse.py script for one-time requirement extraction"
```

---

### Task 4: Auto-Parse New Grants in Collector

**Files:**
- Modify: `backend/app/collectors/base.py`

**Step 1: Read and understand base.py**

The `BaseCollector.run()` method saves grants and calls `await db.commit()`. We need to add parsing after saving each new grant.

**Step 2: Add async parse call in base.py**

In `backend/app/collectors/base.py`, add this import at the top:
```python
from app.services.requirement_parser import parse_requirements
```

In the `run()` method, find the section where a new grant is saved. After `db.add(grant)` and before (or just after) `await db.commit()`, add the parsing call:

```python
# Auto-parse requirements for new grant (non-blocking — failure is OK)
if grant.summary:
    try:
        parsed = await parse_requirements(grant.summary)
        if parsed:
            grant.parsed_requirements = parsed
    except Exception as e:
        logger.warning("Auto-parse failed for grant %s: %s", grant.dedup_hash, e)
```

The exact location depends on the current base.py structure. The key constraint: only parse new grants (not updates), and wrap in try/except so a parse failure never blocks collection.

**Step 3: Verify collector still runs**

```bash
cd /Users/peterchae/forlabs_government/backend
python -c "from app.collectors.base import BaseCollector; print('OK')"
```

**Step 4: Commit**

```bash
cd /Users/peterchae/forlabs_government
git add backend/app/collectors/base.py
git commit -m "feat: auto-parse requirements for new grants in collector pipeline"
```

---

## Phase 2: Enhanced Matching Engine

### Task 5: Eligibility Service

**Files:**
- Create: `backend/app/services/eligibility.py`
- Create: `backend/tests/test_eligibility.py`

**Step 1: Write failing tests**

Create `backend/tests/test_eligibility.py`:
```python
import pytest
from app.services.eligibility import compute_eligibility, EligibilityResult, CheckItem

# Sample user profile
USER_PROFILE = {
    "company_age": 4,
    "industry": "IT/소프트웨어",
    "region": "서울",
    "employee_count": 15,
    "revenue_range": "5억~10억",
}

# Grant with clear requirements
PARSED_HIGH = {
    "max_company_age_years": 7,
    "min_company_age_years": None,
    "allowed_industries": ["AI", "소프트웨어", "IT"],
    "allowed_regions": ["서울", "경기"],
    "max_revenue_krw": 3000000000,
    "target_age_range": None,
    "employee_count_max": 50,
    "parse_confidence": "high",
}

# Grant that user fails (too old)
PARSED_FAIL_AGE = {
    "max_company_age_years": 3,
    "min_company_age_years": None,
    "allowed_industries": ["AI"],
    "allowed_regions": ["서울"],
    "max_revenue_krw": None,
    "target_age_range": None,
    "employee_count_max": None,
    "parse_confidence": "high",
}

# Grant with no requirements
PARSED_EMPTY = {
    "max_company_age_years": None,
    "min_company_age_years": None,
    "allowed_industries": [],
    "allowed_regions": [],
    "max_revenue_krw": None,
    "target_age_range": None,
    "employee_count_max": None,
    "parse_confidence": "low",
}


def test_perfect_match():
    result = compute_eligibility(USER_PROFILE, PARSED_HIGH)
    assert result.score >= 80
    assert result.confidence == "high"
    passed = [c for c in result.checklist if c.status == "pass"]
    assert len(passed) >= 3


def test_age_fail():
    result = compute_eligibility(USER_PROFILE, PARSED_FAIL_AGE)
    failed = [c for c in result.checklist if c.status == "fail"]
    assert any("업력" in c.message for c in failed)
    assert result.score < 60


def test_no_requirements_returns_unknown():
    result = compute_eligibility(USER_PROFILE, PARSED_EMPTY)
    assert result.confidence == "low"
    # Score should still be returned but treated as unknown
    assert result.score is None or isinstance(result.score, (int, float))


def test_empty_profile():
    empty_profile = {
        "company_age": None,
        "industry": None,
        "region": None,
        "employee_count": None,
        "revenue_range": None,
    }
    result = compute_eligibility(empty_profile, PARSED_HIGH)
    unknowns = [c for c in result.checklist if c.status == "unknown"]
    # All checks should be unknown (no profile data to compare)
    assert len(unknowns) >= 3


def test_deterministic():
    """Same inputs must always produce same outputs."""
    r1 = compute_eligibility(USER_PROFILE, PARSED_HIGH)
    r2 = compute_eligibility(USER_PROFILE, PARSED_HIGH)
    assert r1.score == r2.score
    assert [c.status for c in r1.checklist] == [c.status for c in r2.checklist]
```

**Step 2: Run test to verify fail**

```bash
cd /Users/peterchae/forlabs_government/backend
python -m pytest tests/test_eligibility.py -v
```

Expected: `ModuleNotFoundError: No module named 'app.services.eligibility'`

**Step 3: Implement eligibility service**

Create `backend/app/services/eligibility.py`:
```python
"""
Rule-based eligibility scoring: user profile vs parsed_requirements.

Design: 100% deterministic, no API calls, runs from DB data only.
Score = passed_checks / (passed_checks + failed_checks) * 100
Unknown checks (missing data on either side) excluded from denominator.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal


# Revenue range upper bounds in KRW (for comparison with max_revenue_krw)
REVENUE_UPPER_BOUNDS: dict[str, int] = {
    "1억 미만":   100_000_000,
    "1억~5억":    500_000_000,
    "5억~10억":   1_000_000_000,
    "10억~50억":  5_000_000_000,
    "50억~100억": 10_000_000_000,
    "100억 이상": 999_999_999_999,
}

# Industry matching — map user industry names to grant requirement keywords
INDUSTRY_ALIASES: dict[str, list[str]] = {
    "IT/소프트웨어": ["IT", "소프트웨어", "AI", "정보통신", "ICT", "SW"],
    "바이오/의료":   ["바이오", "의료", "헬스케어", "제약", "바이오헬스"],
    "문화/콘텐츠":  ["문화", "콘텐츠", "엔터테인먼트", "게임", "미디어"],
    "에너지/환경":  ["에너지", "환경", "그린", "신재생"],
    "제조업":       ["제조", "하드웨어", "공정"],
    "농업/식품":    ["농업", "식품", "푸드테크", "농촌"],
}


@dataclass
class CheckItem:
    field: str
    status: Literal["pass", "fail", "unknown"]
    message: str


@dataclass
class EligibilityResult:
    score: float | None          # 0–100, or None if not enough data
    confidence: Literal["high", "medium", "low"]
    checklist: list[CheckItem] = field(default_factory=list)


def _industry_matches(user_industry: str, allowed: list[str]) -> bool:
    """Check if user's industry matches any of the allowed industries."""
    if not user_industry or not allowed:
        return False

    user_lower = user_industry.lower()
    aliases = INDUSTRY_ALIASES.get(user_industry, [user_industry])

    for allowed_item in allowed:
        allowed_lower = allowed_item.lower()
        if allowed_lower in user_lower or user_lower in allowed_lower:
            return True
        for alias in aliases:
            if alias.lower() in allowed_lower or allowed_lower in alias.lower():
                return True
    return False


def compute_eligibility(
    profile: dict,
    parsed_requirements: dict,
) -> EligibilityResult:
    """
    Compare user profile against parsed grant requirements.

    profile keys: company_age (int), industry (str), region (str),
                  employee_count (int), revenue_range (str)
    """
    checklist: list[CheckItem] = []

    # ── 1. Company age check ─────────────────────────────────────────────
    user_age = profile.get("company_age")
    max_age = parsed_requirements.get("max_company_age_years")
    min_age = parsed_requirements.get("min_company_age_years")

    if user_age is not None and (max_age is not None or min_age is not None):
        age_ok = True
        msg_parts = []
        if max_age is not None:
            if user_age > max_age:
                age_ok = False
                msg_parts.append(f"업력 {user_age}년 > 최대 {max_age}년")
            else:
                msg_parts.append(f"업력 {user_age}년 ≤ 최대 {max_age}년")
        if min_age is not None:
            if user_age < min_age:
                age_ok = False
                msg_parts.append(f"업력 {user_age}년 < 최소 {min_age}년")
        checklist.append(CheckItem(
            field="company_age",
            status="pass" if age_ok else "fail",
            message=" / ".join(msg_parts) or f"업력 {user_age}년",
        ))
    elif max_age is not None or min_age is not None:
        # Requirement exists but user has no age data
        checklist.append(CheckItem(
            field="company_age",
            status="unknown",
            message="업력 미입력 → 직접 확인 필요",
        ))

    # ── 2. Industry check ────────────────────────────────────────────────
    user_industry = profile.get("industry")
    allowed_industries = parsed_requirements.get("allowed_industries") or []

    if allowed_industries:
        if user_industry:
            matches = _industry_matches(user_industry, allowed_industries)
            checklist.append(CheckItem(
                field="industry",
                status="pass" if matches else "fail",
                message=f"업종 {user_industry} {'일치' if matches else '불일치'} (요건: {', '.join(allowed_industries[:3])})",
            ))
        else:
            checklist.append(CheckItem(
                field="industry",
                status="unknown",
                message="업종 미입력 → 직접 확인 필요",
            ))

    # ── 3. Region check ──────────────────────────────────────────────────
    user_region = profile.get("region")
    allowed_regions = parsed_requirements.get("allowed_regions") or []

    if allowed_regions:
        if user_region:
            # "전국" or matching region
            region_ok = (
                user_region == "전국"
                or any(r in user_region or user_region in r for r in allowed_regions)
            )
            checklist.append(CheckItem(
                field="region",
                status="pass" if region_ok else "fail",
                message=f"지역 {user_region} {'충족' if region_ok else '불충족'} (요건: {', '.join(allowed_regions[:3])})",
            ))
        else:
            checklist.append(CheckItem(
                field="region",
                status="unknown",
                message="소재지 미입력 → 직접 확인 필요",
            ))

    # ── 4. Employee count check ──────────────────────────────────────────
    user_emp = profile.get("employee_count")
    max_emp = parsed_requirements.get("employee_count_max")

    if max_emp is not None:
        if user_emp is not None:
            emp_ok = user_emp <= max_emp
            checklist.append(CheckItem(
                field="employee_count",
                status="pass" if emp_ok else "fail",
                message=f"직원 {user_emp}명 {'≤' if emp_ok else '>'} 최대 {max_emp}명",
            ))
        else:
            checklist.append(CheckItem(
                field="employee_count",
                status="unknown",
                message="직원수 미입력 → 직접 확인 필요",
            ))

    # ── 5. Revenue check ─────────────────────────────────────────────────
    user_rev_range = profile.get("revenue_range")
    max_rev = parsed_requirements.get("max_revenue_krw")

    if max_rev is not None:
        if user_rev_range and user_rev_range in REVENUE_UPPER_BOUNDS:
            user_upper = REVENUE_UPPER_BOUNDS[user_rev_range]
            # If user's upper bound ≤ max_rev, they likely qualify
            rev_ok = user_upper <= max_rev
            user_rev_display = f"{user_upper // 100_000_000}억" if user_upper >= 100_000_000 else f"{user_upper // 10_000}만"
            max_rev_display = f"{max_rev // 100_000_000}억" if max_rev >= 100_000_000 else f"{max_rev // 10_000}만"
            checklist.append(CheckItem(
                field="revenue",
                status="pass" if rev_ok else "fail",
                message=f"매출 상한 {user_rev_display} {'≤' if rev_ok else '>'} 요건 {max_rev_display}",
            ))
        else:
            checklist.append(CheckItem(
                field="revenue",
                status="unknown",
                message="매출 미입력 → 공고문 확인 필요",
            ))

    # ── Score calculation ────────────────────────────────────────────────
    passed = sum(1 for c in checklist if c.status == "pass")
    failed = sum(1 for c in checklist if c.status == "fail")
    denominator = passed + failed

    confidence = parsed_requirements.get("parse_confidence", "low")

    if denominator == 0:
        # No checkable items — return None score
        return EligibilityResult(score=None, confidence=confidence, checklist=checklist)

    score = round(passed / denominator * 100)
    return EligibilityResult(score=score, confidence=confidence, checklist=checklist)
```

**Step 4: Run tests**

```bash
cd /Users/peterchae/forlabs_government/backend
python -m pytest tests/test_eligibility.py -v
```

Expected: All 5 tests PASS.

**Step 5: Commit**

```bash
cd /Users/peterchae/forlabs_government
git add backend/app/services/eligibility.py backend/tests/test_eligibility.py
git commit -m "feat: rule-based eligibility scoring service (100% deterministic)"
```

---

### Task 6: Update /api/intelligence/match Endpoint

**Files:**
- Modify: `backend/app/routers/intelligence.py`
- Modify: `backend/app/schemas.py`
- Modify: `frontend/src/lib/api.ts`

**Step 1: Add eligibility fields to schemas**

In `backend/app/schemas.py`, find `MatchedGrant` or equivalent schema class. Add:
```python
class ChecklistItem(BaseModel):
    field: str
    status: str  # "pass" | "fail" | "unknown"
    message: str

class MatchedGrant(BaseModel):
    grant_id: str
    title: str
    amount_max: int | None = None
    end_date: str | None = None
    organization: str | None = None
    category: str | None = None
    match_score: float | None = None
    match_reasons: list[str] = []
    # New eligibility fields
    eligibility_score: float | None = None
    eligibility_checklist: list[ChecklistItem] = []
    eligibility_confidence: str = "low"
```

If `MatchedGrant` doesn't exist in schemas.py as its own class, add it. The current `/match` endpoint returns an inline dict — we want to add these three new fields.

**Step 2: Update the match endpoint in intelligence.py**

In `backend/app/routers/intelligence.py`, in the `POST /match` handler:

1. Add imports:
   ```python
   from app.services.eligibility import compute_eligibility
   ```

2. In the existing handler, after fetching matched grants, compute eligibility for each:
   ```python
   # Build profile dict from request body
   profile_dict = {
       "company_age": body.company_age,
       "industry": body.industry,
       "region": body.region,
       "employee_count": body.employee_count,
       "revenue_range": None,  # not in current request — add to schema if needed
   }

   # Enhance each matched grant with eligibility data
   for grant in matched_grants:
       if grant.parsed_requirements:
           elig = compute_eligibility(profile_dict, grant.parsed_requirements)
           grant_dict["eligibility_score"] = elig.score
           grant_dict["eligibility_checklist"] = [
               {"field": c.field, "status": c.status, "message": c.message}
               for c in elig.checklist
           ]
           grant_dict["eligibility_confidence"] = elig.confidence
   ```

The exact integration depends on the current handler structure. The key is: fetch grants from DB with `selectinload` (or add `parsed_requirements` to existing fetch), compute eligibility, add to response.

Also sort matched grants by `eligibility_score` descending (nulls last) after computing.

**Step 3: Add revenue_range to match request schema**

In the match request schema (in schemas.py or defined inline in intelligence.py), add:
```python
revenue_range: str | None = None
```

**Step 4: Test endpoint manually**

```bash
curl -X POST http://localhost:8000/api/intelligence/match \
  -H "Content-Type: application/json" \
  -d '{"industry": "IT/소프트웨어", "region": "서울", "company_age": 4, "employee_count": 15}'
```

Expected: Response includes `eligibility_score`, `eligibility_checklist`, `eligibility_confidence` fields on each matched grant.

**Step 5: Update frontend type**

In `frontend/src/lib/api.ts`, update `MatchResult.matched_grants` type:
```typescript
export interface ChecklistItem {
  field: string;
  status: "pass" | "fail" | "unknown";
  message: string;
}

export interface MatchResult {
  matched_grants: {
    grant_id: string;
    title: string;
    amount_max?: number;
    end_date?: string;
    organization?: string;
    category?: string;
    match_score?: number;
    match_reasons?: string[];
    // New eligibility fields
    eligibility_score?: number;
    eligibility_checklist?: ChecklistItem[];
    eligibility_confidence?: "high" | "medium" | "low";
  }[];
  graph: GraphData;
  match_reason: string;
}
```

**Step 6: Commit**

```bash
cd /Users/peterchae/forlabs_government
git add backend/app/routers/intelligence.py backend/app/schemas.py frontend/src/lib/api.ts
git commit -m "feat: /api/intelligence/match returns eligibility score + checklist per grant"
```

---

## Phase 3: UI Updates

### Task 7: /matching Page — Eligibility Badge + Checklist

**Files:**
- Modify: `frontend/src/app/matching/page.tsx`

**Step 1: Auto-load profile into form on mount**

The matching page currently has a form with `industry`, `region`, `employee_count`, `company_age`. On mount, load from localStorage (`govgrants_profile`) to pre-populate:

```typescript
// In MatchingPage component, add useEffect:
useEffect(() => {
  const stored = localStorage.getItem("govgrants_profile");
  if (stored) {
    try {
      const p = JSON.parse(stored);
      setForm(prev => ({
        ...prev,
        industry: p.industry || prev.industry,
        region: p.region || prev.region,
        employee_count: p.employeeCount || prev.employee_count,
        company_age: p.yearsInBusiness || prev.company_age,
      }));
    } catch {}
  }
}, []);
```

Also add `revenue_range` to the form state and request:
```typescript
const [form, setForm] = useState({
  industry: "",
  region: "전국",
  employee_count: "",
  company_age: "",
  revenue_range: "",
});
```

**Step 2: Update grant card in right panel to show eligibility**

In the right panel grant card section (around line 330+), after the existing match_reasons chips, add eligibility display:

```typescript
{/* Eligibility score */}
{grant.eligibility_score !== undefined && grant.eligibility_score !== null && (
  <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${FOUNDRY.border}` }}>
    {/* Score bar */}
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
      <div style={{
        flex: 1,
        height: 4,
        borderRadius: 2,
        background: "rgba(255,255,255,0.08)",
        overflow: "hidden",
      }}>
        <div style={{
          height: "100%",
          width: `${grant.eligibility_score}%`,
          borderRadius: 2,
          background: grant.eligibility_score >= 80 ? FOUNDRY.success
                     : grant.eligibility_score >= 60 ? FOUNDRY.primary
                     : FOUNDRY.warning,
          transition: "width 0.3s ease",
        }} />
      </div>
      <span style={{
        fontSize: 11,
        fontWeight: 700,
        color: grant.eligibility_score >= 80 ? FOUNDRY.success
               : grant.eligibility_score >= 60 ? FOUNDRY.primary
               : FOUNDRY.warning,
        flexShrink: 0,
        minWidth: 32,
        textAlign: "right",
      }}>
        {grant.eligibility_score}%
      </span>
    </div>

    {/* Checklist */}
    {grant.eligibility_checklist && grant.eligibility_checklist.map((item, i) => (
      <div key={i} style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 5,
        marginBottom: 3,
      }}>
        <span style={{
          fontSize: 10,
          flexShrink: 0,
          marginTop: 1,
        }}>
          {item.status === "pass" ? "✅" : item.status === "fail" ? "❌" : "⚠️"}
        </span>
        <span style={{
          fontSize: 10,
          color: item.status === "pass" ? FOUNDRY.success
                 : item.status === "fail" ? FOUNDRY.danger
                 : FOUNDRY.warning,
          lineHeight: 1.4,
        }}>
          {item.message}
        </span>
      </div>
    ))}

    {/* Confidence warning */}
    {grant.eligibility_confidence === "low" && (
      <p style={{ fontSize: 9, color: FOUNDRY.muted, marginTop: 4 }}>
        ⚠️ 공고문 직접 확인 권장
      </p>
    )}
  </div>
)}
```

**Step 3: Sort matched grants by eligibility_score in UI**

After receiving `result`, sort matched_grants by eligibility_score descending:
```typescript
const sortedGrants = [...result.matched_grants].sort((a, b) => {
  if (a.eligibility_score == null && b.eligibility_score == null) return 0;
  if (a.eligibility_score == null) return 1;
  if (b.eligibility_score == null) return -1;
  return b.eligibility_score - a.eligibility_score;
});
```

Use `sortedGrants` instead of `result.matched_grants` in the render.

**Step 4: Add profile incomplete nudge**

At the bottom of the left panel, if localStorage profile has empty fields, show:
```typescript
{missingFields.length > 0 && (
  <div style={{
    marginTop: 8,
    padding: "8px 10px",
    background: "rgba(45,114,210,0.08)",
    border: "1px solid rgba(45,114,210,0.2)",
    borderRadius: 6,
    fontSize: 10,
    color: FOUNDRY.primary,
    lineHeight: 1.4,
  }}>
    <Link href="/mypage" style={{ color: FOUNDRY.primary, textDecoration: "none" }}>
      프로필 완성 →
    </Link>
    {" "}{missingFields[0]}을 입력하면 더 정확한 매칭이 가능합니다
  </div>
)}
```

Where `missingFields` is computed from the loaded profile.

**Step 5: Verify UI renders without errors**

```bash
cd /Users/peterchae/forlabs_government/frontend
npm run dev
```

Navigate to `http://localhost:3000/matching`, select an industry, run match. Verify eligibility scores and checklists appear on grant cards.

**Step 6: Commit**

```bash
cd /Users/peterchae/forlabs_government
git add frontend/src/app/matching/page.tsx
git commit -m "feat: /matching page shows eligibility score + checklist per grant"
```

---

### Task 8: /mypage — Profile Completeness

**Files:**
- Modify: `frontend/src/app/mypage/page.tsx`

**Step 1: Add completeness calculation**

Add a helper function and display at the top of the profile form panel:

```typescript
// Completeness calculation
const PROFILE_FIELDS: Array<{ key: keyof CompanyProfile; label: string }> = [
  { key: "companyName",      label: "기업명" },
  { key: "industry",         label: "업종" },
  { key: "yearsInBusiness",  label: "업력" },
  { key: "region",           label: "소재지" },
  { key: "employeeCount",    label: "직원수" },
  { key: "revenueRange",     label: "매출 구간" },
];

function getCompleteness(profile: CompanyProfile): { pct: number; missing: string[] } {
  const missing = PROFILE_FIELDS
    .filter(f => !profile[f.key] || profile[f.key] === "")
    .map(f => f.label);
  const filled = PROFILE_FIELDS.length - missing.length;
  return { pct: Math.round(filled / PROFILE_FIELDS.length * 100), missing };
}
```

**Step 2: Add completeness UI**

Inside the profile form panel, add after the section header and before the form:

```typescript
{(() => {
  const { pct, missing } = getCompleteness(profile);
  return (
    <div style={{ marginBottom: 20 }}>
      {/* Progress bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: F.muted }}>프로필 완성도</span>
        <span style={{
          fontSize: 12,
          fontWeight: 700,
          color: pct >= 80 ? F.success : pct >= 50 ? F.primary : F.warning,
        }}>
          {pct}%
        </span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.08)" }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          borderRadius: 2,
          background: pct >= 80 ? F.success : pct >= 50 ? F.primary : F.warning,
          transition: "width 0.3s",
        }} />
      </div>

      {/* Nudge message for first missing field */}
      {missing.length > 0 && (
        <p style={{ fontSize: 11, color: F.primary, marginTop: 8 }}>
          {missing[0]}을(를) 입력하면 매칭 정확도가 높아집니다
        </p>
      )}
    </div>
  );
})()}
```

**Step 3: Verify page renders**

Navigate to `http://localhost:3000/mypage`. Verify progress bar shows correct %, nudge message appears for empty fields.

**Step 4: Commit**

```bash
cd /Users/peterchae/forlabs_government
git add frontend/src/app/mypage/page.tsx
git commit -m "feat: /mypage shows profile completeness % + field nudge messages"
```

---

## Phase 4: AI Weekly Briefing

### Task 9: /api/briefing Endpoint

**Files:**
- Create: `backend/app/routers/briefing.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/schemas.py`

**Step 1: Add briefing schema**

In `backend/app/schemas.py`, add:
```python
class BriefingGrant(BaseModel):
    grant_id: str
    title: str
    amount_max: int | None = None
    end_date: str | None = None
    days_left: int | None = None
    eligibility_score: float | None = None
    eligibility_checklist: list[ChecklistItem] = []
    eligibility_confidence: str = "low"

class BriefingResponse(BaseModel):
    week_label: str            # "Week 12"
    date_label: str            # "2026.03.17"
    company_label: str         # "(주)포랩스 · AI/소프트웨어 · 서울 · 업력 4년"

    available_count: int       # eligibility > 60% AND end_date >= today
    urgent_count: int          # D-7 이내
    total_opportunity_krw: int # sum of amount_max for available grants

    urgent_grants: list[BriefingGrant]   # D-7 이내, sorted by eligibility desc
    new_grants: list[BriefingGrant]      # this week's new grants matching user

    profile_incomplete: bool   # True if key fields missing
    missing_profile_fields: list[str]
```

**Step 2: Create briefing router**

Create `backend/app/routers/briefing.py`:
```python
"""
GET /api/briefing — Weekly intelligence briefing for authenticated user.

All calculations are DB-only: no API calls, deterministic, instant.
"""
from __future__ import annotations

import logging
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import GrantProject, User
from app.schemas import BriefingGrant, BriefingResponse, ChecklistItem
from app.services.eligibility import compute_eligibility

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/briefing", tags=["briefing"])

ELIGIBILITY_THRESHOLD = 60  # Only count grants with score >= this
URGENT_DAYS = 7


def _build_profile_dict(user: User) -> dict:
    return {
        "company_age": user.company_age,
        "industry": user.industry,
        "region": user.region,
        "employee_count": user.employee_count,
        "revenue_range": user.revenue_range,
    }


def _get_company_label(user: User) -> str:
    parts = []
    if user.company_name:
        parts.append(user.company_name)
    if user.industry:
        parts.append(user.industry)
    if user.region:
        parts.append(user.region)
    if user.company_age:
        parts.append(f"업력 {user.company_age}년")
    return " · ".join(parts) if parts else "프로필 미완성"


def _missing_fields(user: User) -> list[str]:
    missing = []
    if not user.company_name:
        missing.append("기업명")
    if not user.industry:
        missing.append("업종")
    if not user.company_age:
        missing.append("업력")
    if not user.region:
        missing.append("소재지")
    if not user.employee_count:
        missing.append("직원수")
    if not user.revenue_range:
        missing.append("매출 구간")
    return missing


@router.get("", response_model=BriefingResponse)
async def get_briefing(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return weekly briefing data for the authenticated user."""
    today = date.today()
    week_num = today.isocalendar()[1]
    week_ago = today - timedelta(days=7)

    # Fetch active grants with parsed requirements
    result = await db.execute(
        select(GrantProject).where(
            (GrantProject.end_date >= today) | GrantProject.end_date.is_(None)
        ).where(
            GrantProject.parsed_requirements.isnot(None)
        )
    )
    active_grants = result.scalars().all()

    profile = _build_profile_dict(user)

    # Compute eligibility for each grant
    eligible_grants: list[tuple[GrantProject, float, list]] = []
    for grant in active_grants:
        elig = compute_eligibility(profile, grant.parsed_requirements)
        if elig.score is not None and elig.score >= ELIGIBILITY_THRESHOLD:
            eligible_grants.append((grant, elig.score, elig.checklist, elig.confidence))

    # Sort by eligibility score descending
    eligible_grants.sort(key=lambda x: x[1], reverse=True)

    # Compute stats
    available_count = len(eligible_grants)
    urgent_grants_raw = [
        (g, score, cl, conf) for g, score, cl, conf in eligible_grants
        if g.end_date and (g.end_date - today).days <= URGENT_DAYS
    ]
    urgent_count = len(urgent_grants_raw)
    total_opportunity = sum(
        g.amount_max for g, _, _, _ in eligible_grants if g.amount_max
    )

    # New grants this week
    new_grants_raw = [
        (g, score, cl, conf) for g, score, cl, conf in eligible_grants
        if g.created_at and g.created_at.date() >= week_ago
    ]

    def to_briefing_grant(g: GrantProject, score: float, checklist, confidence: str) -> BriefingGrant:
        days_left = (g.end_date - today).days if g.end_date else None
        return BriefingGrant(
            grant_id=str(g.id),
            title=g.title or "",
            amount_max=g.amount_max,
            end_date=g.end_date.isoformat() if g.end_date else None,
            days_left=days_left,
            eligibility_score=score,
            eligibility_checklist=[
                ChecklistItem(field=c.field, status=c.status, message=c.message)
                for c in checklist
            ],
            eligibility_confidence=confidence,
        )

    missing = _missing_fields(user)

    return BriefingResponse(
        week_label=f"Week {week_num}",
        date_label=today.strftime("%Y.%m.%d"),
        company_label=_get_company_label(user),
        available_count=available_count,
        urgent_count=urgent_count,
        total_opportunity_krw=total_opportunity,
        urgent_grants=[to_briefing_grant(*x) for x in urgent_grants_raw[:10]],
        new_grants=[to_briefing_grant(*x) for x in new_grants_raw[:10]],
        profile_incomplete=len(missing) > 0,
        missing_profile_fields=missing,
    )
```

**Step 3: Register router in main.py**

In `backend/app/main.py`, add:
```python
from app.routers.briefing import router as briefing_router
app.include_router(briefing_router)
```

**Step 4: Test endpoint**

```bash
# Get token first (use an existing test user)
TOKEN="your-user-uuid-here"
curl http://localhost:8000/api/briefing \
  -H "Authorization: Bearer $TOKEN"
```

Expected: JSON response with `available_count`, `urgent_grants`, etc.

**Step 5: Commit**

```bash
cd /Users/peterchae/forlabs_government
git add backend/app/routers/briefing.py backend/app/main.py backend/app/schemas.py
git commit -m "feat: /api/briefing endpoint returns personalized weekly opportunity data"
```

---

### Task 10: /briefing Page

**Files:**
- Create: `frontend/src/app/briefing/page.tsx`

**Step 1: Add fetchBriefing to api.ts**

In `frontend/src/lib/api.ts`, add:
```typescript
export interface BriefingGrant {
  grant_id: string;
  title: string;
  amount_max?: number;
  end_date?: string;
  days_left?: number;
  eligibility_score?: number;
  eligibility_checklist?: ChecklistItem[];
  eligibility_confidence?: string;
}

export interface BriefingResponse {
  week_label: string;
  date_label: string;
  company_label: string;
  available_count: number;
  urgent_count: number;
  total_opportunity_krw: number;
  urgent_grants: BriefingGrant[];
  new_grants: BriefingGrant[];
  profile_incomplete: boolean;
  missing_profile_fields: string[];
}

export async function fetchBriefing(token: string): Promise<BriefingResponse> {
  const res = await fetch(`${API_URL}/api/briefing`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch briefing");
  return res.json();
}
```

**Step 2: Create the /briefing page**

Create `frontend/src/app/briefing/page.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchBriefing, type BriefingResponse } from "@/lib/api";
import { FOUNDRY } from "@/lib/theme";
import { Loader2, Share2, ExternalLink } from "lucide-react";

const F = FOUNDRY;

function StatBox({ value, label }: { value: string; label: string }) {
  return (
    <div style={{
      background: F.card,
      border: `1px solid ${F.border}`,
      borderRadius: 8,
      padding: "16px 20px",
      textAlign: "center",
      flex: 1,
    }}>
      <p style={{ fontSize: 26, fontWeight: 700, color: F.text, fontFamily: "monospace", marginBottom: 4 }}>
        {value}
      </p>
      <p style={{ fontSize: 11, color: F.muted }}>{label}</p>
    </div>
  );
}

function formatAmount(krw: number): string {
  if (krw >= 100_000_000) return `${(krw / 100_000_000).toFixed(1)}억`;
  return `${Math.round(krw / 10_000)}만`;
}

export default function BriefingPage() {
  const [data, setData] = useState<BriefingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("govgrants_token");
    if (!token) {
      setError("로그인이 필요합니다.");
      setLoading(false);
      return;
    }
    fetchBriefing(token)
      .then(setData)
      .catch(() => setError("브리핑 데이터를 불러올 수 없습니다."))
      .finally(() => setLoading(false));
  }, []);

  function handleShare() {
    if (!data) return;
    const text = `📊 이번 주 우리 회사 과제 기회\n${formatAmount(data.total_opportunity_krw)}\n신청가능 ${data.available_count}건 · 마감임박 ${data.urgent_count}건`;
    if (navigator.share) {
      navigator.share({ title: "과제 기회 브리핑", text });
    } else {
      navigator.clipboard.writeText(text + "\nhttps://danbi.forlabs.io/briefing");
      alert("클립보드에 복사되었습니다.");
    }
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "calc(100vh - 40px)", background: F.bg }}>
        <Loader2 size={24} style={{ color: F.muted }} className="animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "calc(100vh - 40px)", background: F.bg, gap: 12 }}>
        <p style={{ fontSize: 13, color: F.muted }}>{error || "데이터를 불러올 수 없습니다."}</p>
        {error?.includes("로그인") && (
          <Link href="/login" style={{ fontSize: 12, color: F.primary }}>로그인하기 →</Link>
        )}
      </div>
    );
  }

  return (
    <div style={{ height: "calc(100vh - 40px)", overflow: "auto", background: F.bg }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 32px" }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: F.muted, letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Intelligence Briefing
            </span>
            <span style={{ fontSize: 10, color: F.muted, fontFamily: "monospace" }}>
              {data.date_label} · {data.week_label}
            </span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: F.text, margin: "0 0 4px" }}>
            이번 주 과제 기회 브리핑
          </h1>
          <p style={{ fontSize: 12, color: F.muted }}>{data.company_label}</p>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 10, marginBottom: 28 }}>
          <StatBox value={String(data.available_count)} label="신청 가능 건수" />
          <StatBox value={String(data.urgent_count)} label="마감 임박 (D-7)" />
          <StatBox
            value={data.total_opportunity_krw > 0 ? formatAmount(data.total_opportunity_krw) : "—"}
            label="총 기회 금액"
          />
        </div>

        {/* Profile incomplete warning */}
        {data.profile_incomplete && (
          <div style={{
            background: "rgba(45,114,210,0.08)",
            border: "1px solid rgba(45,114,210,0.2)",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}>
            <p style={{ fontSize: 12, color: F.primary, margin: 0 }}>
              {data.missing_profile_fields[0]}을(를) 입력하면 더 많은 과제가 매칭됩니다
            </p>
            <Link href="/mypage" style={{ fontSize: 11, color: F.primary, textDecoration: "none", flexShrink: 0 }}>
              프로필 완성 →
            </Link>
          </div>
        )}

        {/* Urgent grants */}
        {data.urgent_grants.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <p style={{ fontSize: 10, color: F.danger, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600, marginBottom: 12 }}>
              🔴 지금 바로 신청하세요 (D-7 이내)
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.urgent_grants.map((g) => (
                <Link key={g.grant_id} href={`/grants/${g.grant_id}`} style={{ textDecoration: "none" }}>
                  <div style={{
                    background: F.card,
                    border: `1px solid ${F.border}`,
                    borderRadius: 8,
                    padding: "12px 16px",
                    cursor: "pointer",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      {/* D-day badge */}
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: F.danger,
                        background: "rgba(194,48,48,0.12)",
                        borderRadius: 4,
                        padding: "2px 6px",
                        fontFamily: "monospace",
                        flexShrink: 0,
                      }}>
                        D-{g.days_left}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: F.text, flex: 1 }}>
                        {g.title}
                      </span>
                      {g.amount_max && (
                        <span style={{ fontSize: 12, color: F.primary, fontWeight: 600, flexShrink: 0 }}>
                          최대 {formatAmount(g.amount_max)}원
                        </span>
                      )}
                      {g.eligibility_score !== undefined && g.eligibility_score !== null && (
                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: g.eligibility_score >= 80 ? F.success : F.primary,
                          background: g.eligibility_score >= 80 ? "rgba(35,162,109,0.12)" : F.glow,
                          borderRadius: 4,
                          padding: "2px 7px",
                          flexShrink: 0,
                        }}>
                          적격성 {g.eligibility_score}%
                        </span>
                      )}
                    </div>
                    {/* Checklist summary (first 3 items) */}
                    {g.eligibility_checklist && g.eligibility_checklist.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 12px" }}>
                        {g.eligibility_checklist.slice(0, 3).map((item, i) => (
                          <span key={i} style={{ fontSize: 10, color: item.status === "pass" ? F.success : item.status === "fail" ? F.danger : F.warning }}>
                            {item.status === "pass" ? "✅" : item.status === "fail" ? "❌" : "⚠️"} {item.message}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* New grants this week */}
        {data.new_grants.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <p style={{ fontSize: 10, color: F.warning, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600, marginBottom: 12 }}>
              🟡 이번 주 신규 공고 (귀사 관련)
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {data.new_grants.slice(0, 8).map((g) => (
                <Link key={g.grant_id} href={`/grants/${g.grant_id}`} style={{ textDecoration: "none" }}>
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 14px",
                    background: F.card,
                    border: `1px solid ${F.border}`,
                    borderRadius: 6,
                  }}>
                    {g.eligibility_score !== undefined && g.eligibility_score !== null && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: F.primary, minWidth: 32, flexShrink: 0 }}>
                        {g.eligibility_score}%
                      </span>
                    )}
                    <span style={{ fontSize: 12, color: F.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {g.title}
                    </span>
                    {g.amount_max && (
                      <span style={{ fontSize: 11, color: F.muted, flexShrink: 0 }}>
                        {formatAmount(g.amount_max)}원
                      </span>
                    )}
                    <ExternalLink size={11} color={F.muted} style={{ flexShrink: 0 }} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={handleShare}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: F.primary,
              color: F.text,
              border: "none",
              borderRadius: 6,
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Share2 size={14} />
            브리핑 공유하기
          </button>
          <Link
            href="/matching"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "transparent",
              color: F.muted,
              border: `1px solid ${F.border}`,
              borderRadius: 6,
              padding: "10px 20px",
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            전체 매칭 보기 →
          </Link>
        </div>

      </div>
    </div>
  );
}
```

**Step 3: Verify page renders**

Navigate to `http://localhost:3000/briefing` (must be logged in). Verify all stat boxes, grant lists, and share button appear correctly.

**Step 4: Commit**

```bash
cd /Users/peterchae/forlabs_government
git add frontend/src/app/briefing/page.tsx frontend/src/lib/api.ts
git commit -m "feat: /briefing page with weekly opportunity stats and grant lists"
```

---

### Task 11: OG Image for Social Sharing

**Files:**
- Create: `frontend/src/app/api/briefing/og/route.tsx`

**Step 1: Install @vercel/og**

```bash
cd /Users/peterchae/forlabs_government/frontend
npm install @vercel/og
```

**Step 2: Create OG image API route**

Create `frontend/src/app/api/briefing/og/route.tsx`:
```typescript
import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const available = searchParams.get("available") || "0";
  const urgent = searchParams.get("urgent") || "0";
  const total = searchParams.get("total") || "0억";
  const company = searchParams.get("company") || "";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "#0B1117",
          padding: "48px 56px",
          fontFamily: "sans-serif",
          justifyContent: "space-between",
        }}
      >
        {/* Top label */}
        <div style={{ display: "flex", color: "#7B919E", fontSize: 18, letterSpacing: "0.15em", textTransform: "uppercase" }}>
          INTELLIGENCE BRIEFING
        </div>

        {/* Main content */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", color: "#7B919E", fontSize: 20 }}>
            📊 이번 주 우리 회사 과제 기회
          </div>
          <div style={{ display: "flex", color: "#F0F4F8", fontSize: 72, fontWeight: 700 }}>
            {total}원
          </div>
          <div style={{ display: "flex", gap: 32 }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ color: "#F0F4F8", fontSize: 36, fontWeight: 700 }}>{available}건</span>
              <span style={{ color: "#7B919E", fontSize: 18 }}>신청 가능</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ color: "#C23030", fontSize: 36, fontWeight: 700 }}>{urgent}건</span>
              <span style={{ color: "#7B919E", fontSize: 18 }}>마감 임박</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <span style={{ color: "#7B919E", fontSize: 18 }}>{company}</span>
          <span style={{ color: "#2D72D2", fontSize: 20, fontWeight: 600 }}>danbi.forlabs.io</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
```

**Step 3: Update share button in briefing page to use OG image URL**

In `frontend/src/app/briefing/page.tsx`, update `handleShare`:
```typescript
function handleShare() {
  if (!data) return;
  const params = new URLSearchParams({
    available: String(data.available_count),
    urgent: String(data.urgent_count),
    total: data.total_opportunity_krw > 0 ? formatAmount(data.total_opportunity_krw) : "—",
    company: data.company_label,
  });
  const shareUrl = `https://danbi.forlabs.io/briefing`;
  const text = `📊 이번 주 우리 회사 과제 기회\n${formatAmount(data.total_opportunity_krw)}\n신청가능 ${data.available_count}건 · 마감임박 ${data.urgent_count}건`;
  if (navigator.share) {
    navigator.share({ title: "과제 기회 브리핑", text, url: shareUrl });
  } else {
    navigator.clipboard.writeText(text + "\n" + shareUrl);
    alert("클립보드에 복사되었습니다.");
  }
}
```

**Step 4: Test OG image**

```bash
curl "http://localhost:3000/api/briefing/og?available=23&urgent=5&total=4.2억&company=포랩스" \
  --output test-og.png
open test-og.png
```

Expected: A 1200×630 dark image with the opportunity stats.

**Step 5: Commit**

```bash
cd /Users/peterchae/forlabs_government
git add frontend/src/app/api/briefing/ frontend/package.json frontend/package-lock.json
git commit -m "feat: OG image generation for briefing social share card"
```

---

### Task 12: Dashboard Briefing Banner

**Files:**
- Modify: `frontend/src/app/page.tsx`

**Step 1: Add briefing banner above stats**

In `frontend/src/app/page.tsx`:

1. Import `fetchBriefing` and add state:
```typescript
import { fetchGrants, fetchBriefing, type Grant, type BriefingResponse } from "@/lib/api";
// Add to component:
const [briefing, setBriefing] = useState<BriefingResponse | null>(null);
```

2. In the `useEffect` that loads data, also fetch briefing (only if token exists):
```typescript
const token = localStorage.getItem("govgrants_token");
if (token) {
  fetchBriefing(token).then(setBriefing).catch(() => {});
}
```

3. Add the banner between "Object Overview" stat cards and "Intelligence Modules":
```typescript
{briefing && briefing.available_count > 0 && (
  <Link href="/briefing" style={{ textDecoration: "none", display: "block", marginBottom: 20 }}>
    <div style={{
      background: "linear-gradient(135deg, rgba(45,114,210,0.15) 0%, rgba(45,114,210,0.05) 100%)",
      border: "1px solid rgba(45,114,210,0.3)",
      borderRadius: 8,
      padding: "14px 16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 16,
      cursor: "pointer",
    }}>
      <div>
        <p style={{ fontSize: 11, color: FOUNDRY.primary, fontWeight: 600, marginBottom: 2 }}>
          이번 주 귀사 과제 기회
        </p>
        <p style={{ fontSize: 20, fontWeight: 700, color: FOUNDRY.text, fontFamily: "monospace" }}>
          {briefing.available_count}건 ·{" "}
          {briefing.total_opportunity_krw > 0
            ? `${(briefing.total_opportunity_krw / 100_000_000).toFixed(1)}억원`
            : "확인하기"}
        </p>
        {briefing.urgent_count > 0 && (
          <p style={{ fontSize: 11, color: FOUNDRY.danger, marginTop: 2 }}>
            🔴 마감 임박 {briefing.urgent_count}건
          </p>
        )}
      </div>
      <div style={{
        fontSize: 11,
        color: FOUNDRY.primary,
        background: FOUNDRY.glow,
        borderRadius: 6,
        padding: "8px 14px",
        flexShrink: 0,
        fontWeight: 600,
      }}>
        브리핑 보기 →
      </div>
    </div>
  </Link>
)}
```

**Step 2: Verify dashboard renders**

Navigate to `http://localhost:3000`. Log in with a test account that has a profile set up. Verify the briefing banner appears between the stat cards and intelligence modules.

**Step 3: Final build check**

```bash
cd /Users/peterchae/forlabs_government/frontend
npm run build
```

Expected: Build succeeds with no errors.

**Step 4: Commit**

```bash
cd /Users/peterchae/forlabs_government
git add frontend/src/app/page.tsx
git commit -m "feat: dashboard briefing banner with weekly opportunity count + amount"
```

---

## Deployment

**Step 1: Push to Railway**

```bash
cd /Users/peterchae/forlabs_government
git push origin main
```

**Step 2: Set Railway environment variable**

In Railway dashboard → backend service → Variables, add:
```
ANTHROPIC_API_KEY=sk-ant-...
```

**Step 3: Run batch parse on production**

After deploy, exec into Railway:
```bash
railway run python -m scripts.batch_parse --limit 100  # test first
railway run python -m scripts.batch_parse               # then all
```

Or set as a one-time Railway job.

**Step 4: Verify production endpoints**

```bash
curl https://api-production-url/api/briefing \
  -H "Authorization: Bearer <production-token>"
```

---

## Success Metrics

- Profile completeness 70%+ users → matching click-through rate (before vs. after)
- /briefing page share count per week
- /matching → /grants/[id] conversion rate (with eligibility % vs. without)
- Briefing OG card sharing (카카오톡, 링크드인)
