# backend/app/routers/admin.py
import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_admin_user
from app.models import Banner, FetchLog, GrantProject, SearchLog, User, UserBookmark
from app.schemas import (
    AdminUserResponse,
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
    import asyncio

    from app.tasks import run_all_collectors

    asyncio.create_task(run_all_collectors("manual"))
    return {"message": "Collection triggered"}


# ── User Management ──────────────────────────────────────


@router.get("/users")
async def list_users(
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """List all users with bookmark count. Requires admin."""
    query = select(User)
    count_query = select(func.count()).select_from(User)

    if search:
        like = f"%{search}%"
        condition = (
            User.email.ilike(like)
            | User.name.ilike(like)
            | User.company_name.ilike(like)
        )
        query = query.where(condition)
        count_query = count_query.where(condition)

    query = query.order_by(User.created_at.desc().nullslast())
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await db.execute(query)
    users = result.scalars().all()

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    items = []
    for u in users:
        bm_result = await db.execute(
            select(func.count()).select_from(UserBookmark).where(UserBookmark.user_id == u.id)
        )
        bm_count = bm_result.scalar() or 0
        item = AdminUserResponse.model_validate(u)
        item.bookmark_count = bm_count
        items.append(item)

    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/users/{user_id}")
async def get_user(
    user_id: uuid.UUID,
    _admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single user's detail with bookmarks. Requires admin."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    bm_result = await db.execute(
        select(func.count()).select_from(UserBookmark).where(UserBookmark.user_id == user.id)
    )
    bm_count = bm_result.scalar() or 0

    item = AdminUserResponse.model_validate(user)
    item.bookmark_count = bm_count
    return item


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: uuid.UUID,
    _admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a user. Requires admin."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.is_admin:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete admin user")
    await db.delete(user)
    await db.commit()


@router.post("/sync-graph")
async def sync_graph_endpoint(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    """Sync grants from PostgreSQL to Neo4j Knowledge Graph."""
    from app.sync_graph import sync_all_grants
    count = await sync_all_grants(db)
    return {"synced": count}
