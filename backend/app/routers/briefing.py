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

ELIGIBILITY_THRESHOLD = 60
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
    eligible_grants = []
    for grant in active_grants:
        elig = compute_eligibility(profile, grant.parsed_requirements)
        if elig.score is not None and elig.score >= ELIGIBILITY_THRESHOLD:
            eligible_grants.append((grant, elig.score, elig.checklist, elig.confidence))

    # Sort by eligibility score descending
    eligible_grants.sort(key=lambda x: x[1], reverse=True)

    available_count = len(eligible_grants)
    urgent_grants_raw = [
        item for item in eligible_grants
        if item[0].end_date and (item[0].end_date - today).days <= URGENT_DAYS
    ]
    urgent_count = len(urgent_grants_raw)
    total_opportunity = sum(
        g.amount_max for g, _, _, _ in eligible_grants if g.amount_max
    )

    new_grants_raw = [
        item for item in eligible_grants
        if item[0].created_at and item[0].created_at.date() >= week_ago
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
