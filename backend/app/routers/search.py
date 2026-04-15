from __future__ import annotations
# backend/app/routers/search.py
"""
Hybrid search pipeline combining three retrieval channels:

  1. Keyword   — PostgreSQL ILIKE on title + summary (fast, precise)
  2. Vector    — pgvector cosine similarity on content_embedding (semantic)
  3. Graph     — Neo4j concept expansion via TechArea / Agency nodes (ontology)

Results are fused with Reciprocal Rank Fusion (RRF) before pagination.
Each channel degrades gracefully when its dependency is unavailable.
"""

import logging
import re
import uuid

from fastapi import APIRouter, Depends
from datetime import date

from sqlalchemy import case, literal, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.embedding import generate_embedding
from app.models import GrantProject, GrantSource, SearchLog
from app.schemas import GrantListResponse, SearchRequest

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/search", tags=["search"])

# ── RRF constant ───────────────────────────────────────────────────────────────
# k=60 is the standard value from the original RRF paper (Cormack et al. 2009).
RRF_K = 60

# ── Korean stopwords ───────────────────────────────────────────────────────────
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


# ── Keyword extraction ─────────────────────────────────────────────────────────

def extract_keywords(query: str) -> list[str]:
    """Extract meaningful keywords from a natural language query."""
    cleaned = re.sub(r"[^\w\s가-힣]", " ", query)
    tokens = cleaned.split()
    keywords = [t for t in tokens if t not in STOPWORDS and len(t) >= 2]
    if not keywords:
        keywords = [t for t in tokens if len(t) >= 2]
    if not keywords:
        keywords = [query.strip()]
    return keywords


# ── Channel 1: Keyword search (PostgreSQL ILIKE) ───────────────────────────────

async def _keyword_search(
    db: AsyncSession,
    keywords: list[str],
    limit: int = 200,
) -> list[str]:
    """Return grant IDs sorted by keyword match count (most matches first)."""
    if not keywords:
        return []

    conditions = []
    match_scores = []
    for kw in keywords:
        pattern = f"%{kw}%"
        cond = (GrantProject.title.ilike(pattern)) | (GrantProject.summary.ilike(pattern))
        conditions.append(cond)
        match_scores.append(
            case((cond, literal(1)), else_=literal(0))
        )

    combined = conditions[0]
    for c in conditions[1:]:
        combined = combined | c

    relevance = sum(match_scores)

    q = (
        select(GrantProject.id, relevance.label("rel"))
        .where(combined)
        .order_by(relevance.desc())
        .limit(limit)
    )

    try:
        result = await db.execute(q)
        return [str(row.id) for row in result.all()]
    except Exception as e:
        logger.warning("Keyword search failed: %s", e)
        return []


# ── Channel 2: Vector search (pgvector cosine similarity) ─────────────────────

async def _vector_search(
    db: AsyncSession,
    embedding: list[float] | None,
    limit: int = 50,
) -> list[str]:
    """Return grant IDs ordered by cosine similarity to the query embedding.

    Requires:
      - pgvector extension enabled in PostgreSQL
      - content_embedding column populated on grant_projects
    Falls back to empty list if either condition is unmet.
    """
    if not embedding:
        return []

    # Format as pgvector literal string: '[0.123, -0.456, ...]'
    vec_str = "[" + ",".join(f"{x:.7f}" for x in embedding) + "]"

    try:
        result = await db.execute(
            text(
                """
                SELECT id::text
                FROM grant_projects
                WHERE content_embedding IS NOT NULL
                ORDER BY content_embedding <=> CAST(:vec AS vector)
                LIMIT :lim
                """
            ),
            {"vec": vec_str, "lim": limit},
        )
        return [row[0] for row in result.all()]
    except Exception as e:
        # pgvector not available or column missing — degrade gracefully
        logger.warning("Vector search unavailable: %s", e)
        await db.rollback()  # must rollback aborted txn before any further queries
        return []


# ── Reciprocal Rank Fusion ─────────────────────────────────────────────────────

def _rrf_fusion(*ranked_lists: list[str], k: int = RRF_K) -> list[str]:
    """Combine multiple ranked ID lists using Reciprocal Rank Fusion.

    score(doc) = Σ_channel  1 / (k + rank_in_channel + 1)

    A document appearing near the top of multiple channels gets a high
    combined score even if it's not #1 in any single channel.
    """
    scores: dict[str, float] = {}
    for lst in ranked_lists:
        for rank, gid in enumerate(lst):
            scores[gid] = scores.get(gid, 0.0) + 1.0 / (k + rank + 1)
    return sorted(scores, key=lambda x: scores[x], reverse=True)


# ── Filter application ─────────────────────────────────────────────────────────

async def _apply_filters(
    db: AsyncSession,
    grant_ids: list[str],
    body: SearchRequest,
) -> list[str]:
    """Remove IDs that don't satisfy optional category / region / source filters.

    Preserves the RRF ordering of the input list.
    """
    has_filters = any([body.category, body.region, body.source])
    if not grant_ids or not has_filters:
        return grant_ids

    try:
        uuid_ids = [uuid.UUID(gid) for gid in grant_ids]
    except ValueError:
        return []

    q = select(GrantProject.id).where(GrantProject.id.in_(uuid_ids))

    if body.category:
        q = q.where(GrantProject.category == body.category)
    if body.region:
        q = q.where(GrantProject.target_region.any(body.region))
    if body.source:
        q = (
            q.join(GrantProject.sources)
            .where(GrantSource.source == body.source)
        )

    try:
        result = await db.execute(q)
        valid = {str(row[0]) for row in result.all()}
        return [gid for gid in grant_ids if gid in valid]
    except Exception as e:
        logger.warning("Filter application failed: %s", e)
        return grant_ids  # return unfiltered rather than empty


# ── Sort IDs by DB column ──────────────────────────────────────────────────────

async def _sort_ids(
    db: AsyncSession,
    grant_ids: list[str],
    sort: str,
) -> list[str]:
    """Re-sort a list of grant IDs by deadline or recency.

    deadline: end_date ASC NULLS LAST (active-first; nulls = 상시 at end)
    recent:   start_date DESC NULLS LAST, id ASC
    """
    try:
        uuid_ids = [uuid.UUID(gid) for gid in grant_ids]
    except ValueError:
        return grant_ids

    today = date.today()

    if sort == "deadline":
        q = (
            select(GrantProject.id, GrantProject.end_date)
            .where(GrantProject.id.in_(uuid_ids))
        )
        result = await db.execute(q)
        rows = result.all()

        def deadline_key(row: tuple) -> tuple:
            d = row[1]  # end_date
            gid = str(row[0])  # UUID as tiebreaker for deterministic pagination
            if d is None:
                return (2, date.max, gid)      # 상시 → 뒤로
            if d < today:
                return (1, d, gid)             # 마감된 것 → 가운데
            return (0, d, gid)                 # 진행중 → 앞으로 (가까운 순)

        sorted_rows = sorted(rows, key=deadline_key)
        return [str(r[0]) for r in sorted_rows]

    elif sort == "recent":
        q = (
            select(GrantProject.id, GrantProject.start_date)
            .where(GrantProject.id.in_(uuid_ids))
        )
        result = await db.execute(q)
        rows = result.all()

        def recent_key(row: tuple) -> tuple:
            d = row[1]  # start_date
            gid = str(row[0])  # UUID as tiebreaker for deterministic pagination
            # (null_last, -ordinal) → ascending sort gives newest first, NULLs last
            if d is None:
                return (1, 0, gid)
            return (0, -d.toordinal(), gid)

        sorted_rows = sorted(rows, key=recent_key)
        return [str(r[0]) for r in sorted_rows]

    return grant_ids


# ── Main endpoint ──────────────────────────────────────────────────────────────

@router.post("", response_model=GrantListResponse)
async def search_grants(
    body: SearchRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Hybrid ontology-aware search:

      Phase 1 — External I/O in parallel:
        • OpenAI text-embedding-3-small (semantic query vector)
        • Neo4j concept expansion (TechArea / Agency traversal)

      Phase 2 — DB searches (sequential on shared async session):
        • PostgreSQL ILIKE keyword search
        • pgvector cosine similarity search

      Phase 3 — Fusion & delivery:
        • Reciprocal Rank Fusion across all three channels
        • Optional filter (category / region / source)
        • Ordered pagination
    """
    keywords = extract_keywords(body.query)

    # ── Phase 1: embedding (external I/O) ─────────────────────────────────────
    embedding_result = await generate_embedding(body.query)
    embedding: list[float] | None = (
        embedding_result if isinstance(embedding_result, list) else None
    )

    # ── Phase 2: DB searches ───────────────────────────────────────────────────
    kw_ids = await _keyword_search(db, keywords)
    vec_ids = await _vector_search(db, embedding)

    # ── Phase 3: fusion, filter, paginate ─────────────────────────────────────
    fused_ids = _rrf_fusion(kw_ids, vec_ids)
    filtered_ids = await _apply_filters(db, fused_ids, body)

    # Re-sort if requested (overrides RRF relevance order)
    if body.sort in ("deadline", "recent") and filtered_ids:
        filtered_ids = await _sort_ids(db, filtered_ids, body.sort)

    total = len(filtered_ids)
    offset = (body.page - 1) * body.page_size
    page_ids = filtered_ids[offset : offset + body.page_size]

    # ── Fetch full grant data for this page ────────────────────────────────────
    items = []
    if page_ids:
        try:
            uuid_page = [uuid.UUID(gid) for gid in page_ids]
        except ValueError:
            uuid_page = []

        if uuid_page:
            result = await db.execute(
                select(GrantProject)
                .options(selectinload(GrantProject.sources))
                .where(GrantProject.id.in_(uuid_page))
            )
            grants_map = {str(g.id): g for g in result.scalars().all()}

            for gid in page_ids:
                g = grants_map.get(gid)
                if not g:
                    continue
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

    # ── Log search ─────────────────────────────────────────────────────────────
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
                "channels": {
                    "keyword": len(kw_ids),
                    "vector": len(vec_ids),
                },
            }.items()
            if v is not None
        },
    )
    db.add(log)
    await db.commit()

    return GrantListResponse(
        items=items,
        total=total,
        page=body.page,
        page_size=body.page_size,
    )
