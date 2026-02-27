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
            "status": grant.status,
            "detail_url": grant.detail_url,
            "sources": source_names,
        }
    )


@router.get("", response_model=GrantListResponse)
async def list_grants(
    category: str | None = Query(None),
    source: str | None = Query(None),
    region: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """List grants with optional filters, ordered by end_date ascending."""
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
        query = query.join(GrantProject.sources).where(GrantSource.source == source)
        count_query = (
            count_query.join(GrantProject.sources).where(GrantSource.source == source)
        )

    # Order by end_date ascending (nulls last)
    query = query.order_by(GrantProject.end_date.asc().nullslast())

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
            "status": grant.status,
            "detail_url": grant.detail_url,
            "sources": source_names,
            "target_industry": grant.target_industry or [],
            "target_region": grant.target_region or [],
            "target_age": grant.target_age,
            "start_date": grant.start_date,
            "created_at": grant.created_at,
        }
    )
