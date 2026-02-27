# backend/app/routers/search.py
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.embedding import generate_embedding
from app.models import GrantProject, GrantSource, SearchLog
from app.schemas import GrantListResponse, SearchRequest

router = APIRouter(prefix="/api/search", tags=["search"])


@router.post("", response_model=GrantListResponse)
async def search_grants(
    body: SearchRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Full-text search using ILIKE on title + summary.
    Applies optional category/region filters. Logs the query to SearchLog.
    """
    pattern = f"%{body.query}%"
    query = (
        select(GrantProject)
        .options(selectinload(GrantProject.sources))
        .where(
            (GrantProject.title.ilike(pattern)) | (GrantProject.summary.ilike(pattern))
        )
    )
    count_query = (
        select(func.count())
        .select_from(GrantProject)
        .where(
            (GrantProject.title.ilike(pattern)) | (GrantProject.summary.ilike(pattern))
        )
    )

    # Optional filters
    if body.category:
        query = query.where(GrantProject.category == body.category)
        count_query = count_query.where(GrantProject.category == body.category)
    if body.region:
        query = query.where(GrantProject.target_region.any(body.region))
        count_query = count_query.where(GrantProject.target_region.any(body.region))
    if body.source:
        query = query.join(GrantProject.sources).where(GrantSource.source == body.source)
        count_query = count_query.join(GrantProject.sources).where(
            GrantSource.source == body.source
        )

    # Order & paginate
    query = query.order_by(GrantProject.end_date.asc().nullslast())
    offset = (body.page - 1) * body.page_size
    query = query.offset(offset).limit(body.page_size)

    result = await db.execute(query)
    grants = result.scalars().unique().all()

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Try vector search if text search returns few results
    if total < 5:
        query_embedding = await generate_embedding(body.query)
        if query_embedding:
            vector_query = (
                select(GrantProject)
                .options(selectinload(GrantProject.sources))
                .where(GrantProject.content_embedding.isnot(None))
                .order_by(GrantProject.content_embedding.cosine_distance(query_embedding))
                .limit(body.page_size)
            )
            vector_result = await db.execute(vector_query)
            grants = vector_result.scalars().unique().all()
            total = len(grants)

    # Log search
    log = SearchLog(
        query_text=body.query,
        result_count=total,
        filters_used={
            k: v
            for k, v in {
                "category": body.category,
                "region": body.region,
                "source": body.source,
            }.items()
            if v is not None
        },
    )
    db.add(log)
    await db.commit()

    # Build response
    items = []
    for g in grants:
        source_names = [gs.source for gs in g.sources] if g.sources else []
        items.append(
            {
                "id": g.id,
                "title": g.title,
                "summary": g.summary,
                "category": g.category,
                "amount_min": g.amount_min,
                "amount_max": g.amount_max,
                "organization": g.organization,
                "end_date": g.end_date,
                "status": g.status,
                "detail_url": g.detail_url,
                "sources": source_names,
            }
        )

    return GrantListResponse(items=items, total=total, page=body.page, page_size=body.page_size)
