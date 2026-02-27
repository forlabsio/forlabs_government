# backend/app/routers/admin.py
import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_admin_user
from app.models import Banner, FetchLog, GrantProject, SearchLog, User
from app.schemas import (
    BannerCreate,
    BannerResponse,
    DashboardStats,
    FetchLogResponse,
    SearchLogResponse,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/dashboard", response_model=DashboardStats)
async def dashboard(
    _admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Return aggregated dashboard statistics. Requires admin."""
    today = date.today()
    today_start = datetime(today.year, today.month, today.day, tzinfo=timezone.utc)

    # Total grants
    total_grants_result = await db.execute(
        select(func.count()).select_from(GrantProject)
    )
    total_grants = total_grants_result.scalar() or 0

    # Active grants (end_date >= today or null)
    active_grants_result = await db.execute(
        select(func.count())
        .select_from(GrantProject)
        .where(
            (GrantProject.end_date >= today) | (GrantProject.end_date.is_(None))
        )
    )
    active_grants = active_grants_result.scalar() or 0

    # Total users
    total_users_result = await db.execute(select(func.count()).select_from(User))
    total_users = total_users_result.scalar() or 0

    # Today's searches
    today_searches_result = await db.execute(
        select(func.count())
        .select_from(SearchLog)
        .where(SearchLog.created_at >= today_start)
    )
    today_searches = today_searches_result.scalar() or 0

    # Fetch logs today
    fetch_logs_result = await db.execute(
        select(FetchLog)
        .where(FetchLog.started_at >= today_start)
        .order_by(FetchLog.started_at.desc())
    )
    fetch_logs = fetch_logs_result.scalars().all()

    return DashboardStats(
        total_grants=total_grants,
        active_grants=active_grants,
        total_users=total_users,
        today_searches=today_searches,
        fetch_logs_today=[FetchLogResponse.model_validate(fl) for fl in fetch_logs],
    )


@router.get("/search-insights", response_model=list[SearchLogResponse])
async def search_insights(
    days: int = Query(7, ge=1, le=90),
    _admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Top search queries in the last N days. Requires admin."""
    from datetime import timedelta

    since = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(
            SearchLog.query_text,
            func.count().label("count"),
        )
        .where(SearchLog.created_at >= since)
        .group_by(SearchLog.query_text)
        .order_by(func.count().desc())
        .limit(50)
    )
    rows = result.all()
    return [SearchLogResponse(query_text=r.query_text, count=r.count) for r in rows]


@router.get("/search-insights/zero-results", response_model=list[SearchLogResponse])
async def zero_result_queries(
    days: int = Query(7, ge=1, le=90),
    _admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Queries that returned zero results in the last N days. Requires admin."""
    from datetime import timedelta

    since = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(
            SearchLog.query_text,
            func.count().label("count"),
        )
        .where(SearchLog.created_at >= since, SearchLog.result_count == 0)
        .group_by(SearchLog.query_text)
        .order_by(func.count().desc())
        .limit(50)
    )
    rows = result.all()
    return [SearchLogResponse(query_text=r.query_text, count=r.count) for r in rows]


@router.get("/banners", response_model=list[BannerResponse])
async def list_banners(
    _admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """List all banners. Requires admin."""
    result = await db.execute(
        select(Banner).order_by(Banner.created_at.desc())
    )
    banners = result.scalars().all()
    return [BannerResponse.model_validate(b) for b in banners]


@router.post("/banners", response_model=BannerResponse, status_code=status.HTTP_201_CREATED)
async def create_banner(
    body: BannerCreate,
    _admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a banner. Requires admin."""
    banner = Banner(
        title=body.title,
        image_url=body.image_url,
        link_url=body.link_url,
        target_industry=body.target_industry,
        target_region=body.target_region,
        start_date=body.start_date,
        end_date=body.end_date,
    )
    db.add(banner)
    await db.commit()
    await db.refresh(banner)
    return BannerResponse.model_validate(banner)


@router.delete("/banners/{banner_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_banner(
    banner_id: uuid.UUID,
    _admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a banner. Requires admin."""
    result = await db.execute(select(Banner).where(Banner.id == banner_id))
    banner = result.scalar_one_or_none()
    if banner is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Banner not found",
        )
    await db.delete(banner)
    await db.commit()


@router.post("/trigger-collect")
async def trigger_collect(admin: User = Depends(get_admin_user)):
    from app.tasks import run_all_collectors
    run_all_collectors.delay("manual")
    return {"message": "Collection triggered"}
