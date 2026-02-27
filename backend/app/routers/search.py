# backend/app/routers/search.py
import re

from fastapi import APIRouter, Depends
from sqlalchemy import case, func, literal, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import GrantProject, GrantSource, SearchLog
from app.schemas import GrantListResponse, SearchRequest

router = APIRouter(prefix="/api/search", tags=["search"])

# Korean stopwords — common particles, pronouns, verbs that don't carry search meaning
STOPWORDS = frozenset(
    [
        # Pronouns / demonstratives
        "나", "내", "내가", "저", "제", "우리", "너", "그", "이", "저것",
        # Particles / postpositions
        "은", "는", "이", "가", "을", "를", "에", "에서", "의", "로", "으로",
        "와", "과", "도", "만", "까지", "부터", "에게", "한테", "께",
        # Common verbs / endings
        "하다", "되다", "있다", "없다", "이다", "아니다",
        "해줘", "해주세요", "알려줘", "찾아줘", "보여줘", "추천해줘",
        "할", "하는", "한", "된", "되는", "있는", "없는",
        "것", "거", "걸", "건", "수", "듯",
        # Filler / connectors
        "좀", "좀더", "더", "매우", "아주", "정말", "진짜",
        "그리고", "또한", "혹시", "어떤", "어디", "뭐", "무엇",
        "적합한", "적합", "맞는", "관련", "관련된", "대한",
        "싶다", "싶어", "싶은", "보고",
    ]
)


def extract_keywords(query: str) -> list[str]:
    """Extract meaningful keywords from a natural language query.

    1. Remove special characters (keep Korean, alphanumeric, spaces)
    2. Split into tokens
    3. Remove stopwords
    4. Remove tokens shorter than 2 chars (single Korean syllable = noise)
    """
    cleaned = re.sub(r"[^\w\s가-힣]", " ", query)
    tokens = cleaned.split()
    keywords = [t for t in tokens if t not in STOPWORDS and len(t) >= 2]

    # If all tokens were filtered out, fall back to original tokens >= 2 chars
    if not keywords:
        keywords = [t for t in tokens if len(t) >= 2]

    # Last resort: use the original query as-is
    if not keywords:
        keywords = [query.strip()]

    return keywords


@router.post("", response_model=GrantListResponse)
async def search_grants(
    body: SearchRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Keyword-based search: splits natural language queries into keywords,
    searches each keyword against title + summary with ILIKE,
    and ranks results by number of keyword matches.
    """
    keywords = extract_keywords(body.query)

    # Build OR conditions: each keyword matches title OR summary
    conditions = []
    for kw in keywords:
        pattern = f"%{kw}%"
        conditions.append(
            (GrantProject.title.ilike(pattern)) | (GrantProject.summary.ilike(pattern))
        )

    # Main filter: at least one keyword must match
    combined_filter = conditions[0]
    for cond in conditions[1:]:
        combined_filter = combined_filter | cond

    # Count how many keywords match (for ranking)
    match_scores = []
    for kw in keywords:
        pattern = f"%{kw}%"
        match_scores.append(
            case(
                (
                    (GrantProject.title.ilike(pattern)) | (GrantProject.summary.ilike(pattern)),
                    literal(1),
                ),
                else_=literal(0),
            )
        )
    relevance = sum(match_scores) if match_scores else literal(0)

    query = (
        select(GrantProject, relevance.label("relevance"))
        .options(selectinload(GrantProject.sources))
        .where(combined_filter)
    )
    count_query = (
        select(func.count())
        .select_from(GrantProject)
        .where(combined_filter)
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

    # Order by relevance (most keyword matches first), then nearest deadline
    query = query.order_by(
        relevance.desc(),
        GrantProject.end_date.asc().nullslast(),
    )

    offset = (body.page - 1) * body.page_size
    query = query.offset(offset).limit(body.page_size)

    result = await db.execute(query)
    rows = result.unique().all()

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

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
                "keywords": keywords,
            }.items()
            if v is not None
        },
    )
    db.add(log)
    await db.commit()

    # Build response
    items = []
    for row in rows:
        g = row[0] if isinstance(row, tuple) else row.GrantProject
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
                "start_date": g.start_date,
                "status": g.status,
                "detail_url": g.detail_url,
                "sources": source_names,
                "view_count": g.view_count,
                "created_at": g.created_at,
            }
        )

    return GrantListResponse(items=items, total=total, page=body.page, page_size=body.page_size)
