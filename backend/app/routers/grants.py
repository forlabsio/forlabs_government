# backend/app/routers/grants.py
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import GrantProject, GrantSource
from app.schemas import GrantDetail, GrantListItem, GrantListResponse

router = APIRouter(prefix="/api/grants", tags=["grants"])


def _effective_status(grant: GrantProject) -> str:
    """Return status, auto-expiring to '마감' if end_date has passed."""
    if grant.end_date and grant.end_date < date.today() and grant.status in ("접수중", "공고중", "진행중"):
        return "마감"
    return grant.status or ""


def _grant_to_list_item(grant: GrantProject) -> GrantListItem:
    """Convert a GrantProject ORM object to a GrantListItem schema."""
    source_names = [gs.source for gs in grant.sources] if grant.sources else []
    return GrantListItem.model_validate(
        {
            "id": grant.id,
            "title": grant.title,
            "summary": grant.summary,
            "category": grant.category,
            "amount_min": grant.amount_min,
            "amount_max": grant.amount_max,
            "organization": grant.organization,
            "end_date": grant.end_date,
            "start_date": grant.start_date,
            "status": _effective_status(grant),
            "detail_url": grant.detail_url,
            "sources": source_names,
            "view_count": grant.view_count,
            "created_at": grant.created_at,
        }
    )


@router.get("", response_model=GrantListResponse)
async def list_grants(
    category: str | None = Query(None),
    source: str | None = Query(None),
    region: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    sort: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """List grants with optional filters and sorting."""
    query = select(GrantProject).options(selectinload(GrantProject.sources))
    count_query = select(func.count()).select_from(GrantProject)

    # Apply filters
    if category:
        query = query.where(GrantProject.category == category)
        count_query = count_query.where(GrantProject.category == category)
    if region:
        query = query.where(GrantProject.target_region.any(region))
        count_query = count_query.where(GrantProject.target_region.any(region))
    if status_filter:
        query = query.where(GrantProject.status == status_filter)
        count_query = count_query.where(GrantProject.status == status_filter)
    if source:
        # JOIN 대신 서브쿼리 — 한 과제가 여러 소스를 가질 때 중복 행 방지
        source_subq = select(GrantSource.grant_id).where(GrantSource.source == source).scalar_subquery()
        query = query.where(GrantProject.id.in_(source_subq))
        count_query = count_query.where(GrantProject.id.in_(source_subq))

    # Active-only filter: shared by deadline and default sorts
    _active_filter = (GrantProject.end_date >= date.today()) | (GrantProject.end_date.is_(None))

    # Sorting — 모든 정렬에 id를 타이브레이커로 추가해 페이지간 중복 방지
    if sort == "deadline":
        query = query.where(_active_filter)
        count_query = count_query.where(_active_filter)
        query = query.order_by(GrantProject.end_date.asc().nullslast(), GrantProject.id.asc())
    elif sort == "recent":
        # 활성 과제만 — 마감된 과제가 최상단에 노출되지 않도록
        query = query.where(_active_filter)
        count_query = count_query.where(_active_filter)
        # start_date = 실제 공고 게시일. created_at은 DB 등록 시각이라 배치 입력 시 동일한 값이 많음
        query = query.order_by(GrantProject.start_date.desc().nullslast(), GrantProject.id.asc())
    elif sort == "amount":
        query = query.order_by(GrantProject.amount_max.desc().nullslast(), GrantProject.id.asc())
    else:
        # Default: active grants only, sorted by nearest deadline
        query = query.where(_active_filter)
        count_query = count_query.where(_active_filter)
        query = query.order_by(GrantProject.end_date.asc().nullslast(), GrantProject.id.asc())

    # Pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await db.execute(query)
    grants = result.scalars().unique().all()

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    items = [_grant_to_list_item(g) for g in grants]

    return GrantListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/{grant_id}", response_model=GrantDetail)
async def get_grant(
    grant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get a single grant with full details."""
    result = await db.execute(
        select(GrantProject)
        .options(selectinload(GrantProject.sources))
        .where(GrantProject.id == grant_id)
    )
    grant = result.scalar_one_or_none()
    if grant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Grant not found"
        )

    # Increment view count
    grant.view_count = (grant.view_count or 0) + 1
    await db.flush()
    await db.commit()
    await db.refresh(grant)

    source_names = [gs.source for gs in grant.sources] if grant.sources else []
    return GrantDetail.model_validate(
        {
            "id": grant.id,
            "title": grant.title,
            "summary": grant.summary,
            "category": grant.category,
            "amount_min": grant.amount_min,
            "amount_max": grant.amount_max,
            "organization": grant.organization,
            "end_date": grant.end_date,
            "status": _effective_status(grant),
            "detail_url": grant.detail_url,
            "sources": source_names,
            "view_count": grant.view_count,
            "target_industry": grant.target_industry or [],
            "target_region": grant.target_region or [],
            "target_age": grant.target_age,
            "start_date": grant.start_date,
            "created_at": grant.created_at,
        }
    )
