# backend/app/routers/intelligence.py
"""Intelligence API: recommendation, graph queries, trends, matching, network."""
import logging
from collections import defaultdict
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import GrantProject, User
from app.schemas import GrantListItem, MatchRequest
from app.services.eligibility import compute_eligibility

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/intelligence", tags=["intelligence"])


def _get_current_user_optional(db: AsyncSession = Depends(get_db)):
    """Placeholder - in real usage inject from auth token."""
    return None


# ── 1. Recommendation ──────────────────────────────────────────────────────

@router.get("/recommend")
async def recommend_grants(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Return personalized grant recommendations. Uses profile matching from tasks.py."""
    from app.tasks import _match_grants_for_user

    grants_query = (
        select(GrantProject)
        .where(
            GrantProject.status == "접수중",
            (GrantProject.end_date >= date.today()) | (GrantProject.end_date.is_(None)),
        )
        .order_by(GrantProject.view_count.desc())
        .limit(limit)
    )
    result = await db.execute(grants_query)
    grants = result.scalars().all()

    items = []
    for g in grants:
        item = GrantListItem.model_validate({
            "id": g.id, "title": g.title, "summary": g.summary,
            "category": g.category, "amount_min": g.amount_min,
            "amount_max": g.amount_max, "organization": g.organization,
            "end_date": g.end_date, "start_date": g.start_date,
            "status": g.status, "detail_url": g.detail_url,
            "sources": [], "view_count": g.view_count, "created_at": g.created_at,
        })
        items.append(item)

    return {"items": items, "total": len(items)}


# ── 3. Trends ───────────────────────────────────────────────────────────────

@router.get("/trends")
async def get_trends(
    months: int = Query(6, ge=1, le=24),
    db: AsyncSession = Depends(get_db),
):
    """Return rich trend intelligence data for the Trends Analysis page."""

    # 1. Sector budget leaderboard — category by total funding KRW (LIVE grants)
    sector_rows = await db.execute(text("""
        SELECT
            category,
            COUNT(*) AS grant_count,
            SUM(COALESCE(amount_max, 0)) AS total_amount_krw,
            AVG(COALESCE(amount_max, 0)) AS avg_amount_krw
        FROM grant_projects
        WHERE status IN ('접수중', '공고중', '진행중')
          AND category IS NOT NULL
        GROUP BY category
        ORDER BY total_amount_krw DESC
        LIMIT 12
    """))
    sector_rows = sector_rows.fetchall()

    # 2. Monthly new announcement velocity (last 16 weeks by week)
    velocity_rows = await db.execute(text("""
        SELECT
            DATE_TRUNC('week', created_at) AS week,
            COUNT(*) AS count
        FROM grant_projects
        WHERE created_at >= NOW() - INTERVAL '16 weeks'
        GROUP BY DATE_TRUNC('week', created_at)
        ORDER BY week ASC
    """))
    velocity_rows = velocity_rows.fetchall()

    # 3. High-value grants closing soon (deadline within 90 days, amount > 0)
    closing_rows = await db.execute(text("""
        SELECT
            id, title, organization, category,
            COALESCE(amount_max, 0) AS amount_max,
            end_date,
            (end_date - CURRENT_DATE) AS days_left
        FROM grant_projects
        WHERE status IN ('접수중', '공고중', '진행중')
          AND end_date IS NOT NULL
          AND end_date >= CURRENT_DATE
          AND end_date <= CURRENT_DATE + INTERVAL '90 days'
          AND COALESCE(amount_max, 0) > 0
        ORDER BY amount_max DESC
        LIMIT 10
    """))
    closing_rows = closing_rows.fetchall()

    # 4. Monthly category trend (count over time) for sparklines
    trend_result = await db.execute(text("""
        SELECT
            DATE_TRUNC('month', created_at) AS month,
            category,
            COUNT(*) AS count,
            SUM(COALESCE(amount_max, 0)) AS total_amount
        FROM grant_projects
        WHERE created_at >= NOW() - (:months * INTERVAL '1 month')
          AND category IS NOT NULL
        GROUP BY DATE_TRUNC('month', created_at), category
        ORDER BY month ASC
    """), {"months": months})
    trend_rows = trend_result.fetchall()

    # 5. Agency budget power ranking (total amount of LIVE grants)
    agency_rows = await db.execute(text("""
        SELECT
            organization,
            COUNT(*) AS grant_count,
            SUM(COALESCE(amount_max, 0)) AS total_amount_krw
        FROM grant_projects
        WHERE status IN ('접수중', '공고중', '진행중')
          AND organization IS NOT NULL
          AND COALESCE(amount_max, 0) > 0
        GROUP BY organization
        ORDER BY total_amount_krw DESC
        LIMIT 12
    """))
    agency_rows = agency_rows.fetchall()

    # Build chart_data for backward compat
    trend_data: dict = {}
    for row in trend_rows:
        month_str = row.month.strftime("%Y-%m") if row.month else "unknown"
        if month_str not in trend_data:
            trend_data[month_str] = {}
        trend_data[month_str][row.category] = {"count": row.count}

    categories: set = set()
    for md in trend_data.values():
        categories.update(md.keys())

    chart_data = []
    for month, data in sorted(trend_data.items()):
        entry: dict = {"month": month}
        for cat in categories:
            entry[cat] = data.get(cat, {}).get("count", 0)
        chart_data.append(entry)

    return {
        # Legacy fields (kept for chart_data/categories consumers)
        "chart_data": chart_data,
        "categories": list(categories),
        "agencies": [{"name": r.organization, "count": r.grant_count} for r in agency_rows],

        # New intelligence fields
        "sector_leaderboard": [
            {
                "category": r.category,
                "grant_count": r.grant_count,
                "total_amount_krw": int(r.total_amount_krw or 0),
                "avg_amount_krw": int(r.avg_amount_krw or 0),
            }
            for r in sector_rows
        ],
        "weekly_velocity": [
            {
                "week": row.week.strftime("%m/%d") if row.week else "",
                "count": row.count,
            }
            for row in velocity_rows
        ],
        "high_value_closing": [
            {
                "id": str(row.id),
                "title": row.title,
                "organization": row.organization or "",
                "category": row.category or "",
                "amount_max": int(row.amount_max or 0),
                "end_date": row.end_date.isoformat() if row.end_date else "",
                "days_left": int(row.days_left.days) if hasattr(row.days_left, "days") else int(row.days_left or 0),
            }
            for row in closing_rows
        ],
        "agency_budget": [
            {
                "name": r.organization,
                "grant_count": r.grant_count,
                "total_amount_krw": int(r.total_amount_krw or 0),
            }
            for r in agency_rows
        ],
    }


# ── 4. Auto-matching ────────────────────────────────────────────────────────

# Keywords for each industry — used to score grant title/summary relevance
_INDUSTRY_KEYWORDS: dict[str, list[str]] = {
    "IT/소프트웨어": ["소프트웨어", "SW", "IT", "디지털", "AI", "인공지능", "정보통신", "빅데이터",
                     "클라우드", "앱", "플랫폼", "SaaS", "블록체인", "IoT", "스타트업", "핀테크"],
    "제조업":        ["제조", "생산", "공정", "스마트팩토리", "부품", "소재", "공장", "금속", "화학", "기계"],
    "바이오/의료":   ["바이오", "의료", "헬스케어", "제약", "의약품", "의료기기", "생명공학", "헬스", "건강"],
    "문화/콘텐츠":   ["콘텐츠", "문화", "미디어", "게임", "영상", "웹툰", "엔터테인먼트", "창작", "공연", "예술"],
    "농업/식품":     ["농업", "식품", "농촌", "농산물", "식품산업", "스마트팜", "축산", "수산", "먹거리"],
    "건설":          ["건설", "건축", "인프라", "토목", "스마트시티", "리모델링", "개발"],
    "유통/물류":     ["유통", "물류", "도소매", "이커머스", "배달", "온라인", "쇼핑", "배송"],
    "서비스업":      ["서비스", "소상공인", "자영업", "프랜차이즈", "외식", "숙박", "관광"],
}

# Company age → preferred grant categories (boost)
_AGE_CATEGORY_BOOST: list[tuple[tuple[int, int], list[str]]] = [
    ((0, 3),   ["창업", "소상공인"]),
    ((3, 7),   ["창업", "R&D", "자금"]),
    ((7, 9999), ["R&D", "수출", "인력", "경영"]),
]

# Employee count → preferred grant categories (boost)
_EMP_CATEGORY_BOOST: list[tuple[tuple[int, int], list[str]]] = [
    ((0, 5),    ["소상공인", "창업"]),
    ((5, 50),   ["창업", "자금", "R&D"]),
    ((50, 300), ["R&D", "수출", "인력"]),
    ((300, 9999), ["수출", "인력", "R&D"]),
]


@router.post("/match")
async def auto_match(
    body: MatchRequest,
    db: AsyncSession = Depends(get_db),
):
    """Score-based grant matching: industry keywords + company profile filters."""
    industry = body.industry
    region = body.region
    employee_count = body.employee_count  # int or None
    company_age = body.company_age        # int or None

    # Build profile dict for eligibility computation
    profile_dict = {
        "company_age": body.company_age,
        "industry": body.industry,
        "region": body.region if body.region else None,
        "employee_count": body.employee_count,
        "revenue_range": body.revenue_range,
        "revenue_krw": body.revenue_krw,
        "certifications": body.certifications,
        "is_corporate": body.is_corporate,
        "is_venture": body.is_venture,
    }

    keywords = _INDUSTRY_KEYWORDS.get(industry, [])

    # ── 1. Fetch candidate grants from PostgreSQL ──────────────────────────
    pg_query = (
        select(GrantProject)
        .where(
            GrantProject.status == "접수중",
            (GrantProject.end_date >= date.today()) | (GrantProject.end_date.is_(None)),
        )
        .order_by(GrantProject.end_date.asc().nullslast())
        .limit(300)
    )
    # Region filter — only if explicitly chosen (array overlap operator)
    if region and region != "전국":
        pg_query = pg_query.where(
            GrantProject.target_region.op("@>")(text(f"ARRAY['{region}']::varchar[]"))
            | GrantProject.target_region.is_(None)
        )

    pg_result = await db.execute(pg_query)
    candidates = pg_result.scalars().all()

    # ── 2. Score each grant ────────────────────────────────────────────────
    # Keep a mapping from grant_id → GrantProject so we can access parsed_requirements later
    grant_orm_map: dict[str, GrantProject] = {str(g.id): g for g in candidates}

    def score_grant(g: GrantProject) -> tuple[int, dict]:
        score = 0
        reasons: list[str] = []

        title_lower = (g.title or "").lower()
        summary_lower = (g.summary or "").lower()

        # Industry keyword matching
        kw_hits = [kw for kw in keywords if kw.lower() in title_lower or kw.lower() in summary_lower]
        if kw_hits:
            score += len(kw_hits) * 3
            reasons.append(f"키워드 매칭: {', '.join(kw_hits[:3])}")

        # Company age category boost
        if company_age is not None:
            for (lo, hi), cats in _AGE_CATEGORY_BOOST:
                if lo <= int(company_age) < hi and g.category in cats:
                    score += 2
                    reasons.append(f"업력 {company_age}년 적합")
                    break

        # Employee count category boost
        if employee_count is not None:
            for (lo, hi), cats in _EMP_CATEGORY_BOOST:
                if lo <= int(employee_count) < hi and g.category in cats:
                    score += 2
                    reasons.append(f"직원 {employee_count}명 규모 적합")
                    break

        # Deadline urgency boost
        if g.end_date:
            days_left = (g.end_date - date.today()).days
            if 0 < days_left <= 7:
                score += 4
                reasons.append(f"마감 {days_left}일 남음")
            elif 0 < days_left <= 14:
                score += 3
                reasons.append(f"마감 {days_left}일 남음")
            elif 0 < days_left <= 30:
                score += 2
            elif 0 < days_left <= 60:
                score += 1

        # Amount bonus
        if g.amount_max and g.amount_max >= 100_000_000:
            score += 1  # 1억 이상

        return score, {
            "grant_id": str(g.id),
            "title": g.title,
            "amount_max": g.amount_max,
            "end_date": str(g.end_date) if g.end_date else None,
            "organization": g.organization,
            "category": g.category,
            "match_score": score,
            "match_reasons": reasons,
        }

    scored = [score_grant(g) for g in candidates]
    scored.sort(key=lambda x: x[0], reverse=True)

    # Only return grants with score > 0 unless there are too few
    top = [item for s, item in scored if s > 0]
    if len(top) < 5:
        top = [item for _, item in scored]
    top_grants = top[:20]

    # ── 2b. Compute eligibility for each matched grant ─────────────────────
    for grant_dict in top_grants:
        gid = grant_dict["grant_id"]
        orm_obj = grant_orm_map.get(gid)
        parsed_reqs: dict = {}
        if orm_obj is not None and orm_obj.parsed_requirements:
            parsed_reqs = orm_obj.parsed_requirements

        elig = compute_eligibility(profile_dict, parsed_reqs)
        grant_dict["eligibility_score"] = elig.score
        grant_dict["eligibility_checklist"] = [
            {"field": c.field, "status": c.status, "message": c.message}
            for c in elig.checklist
        ]
        grant_dict["eligibility_confidence"] = elig.confidence

    # ── 2c. Sort by eligibility_score descending (None treated as lowest) ──
    top_grants.sort(
        key=lambda x: (x.get("eligibility_score") is not None, x.get("eligibility_score") or 0),
        reverse=True,
    )

    # ── 3. Build match reason summary ─────────────────────────────────────
    filters_used = []
    if industry:
        filters_used.append(f"업종 '{industry}'")
    if region and region != "전국":
        filters_used.append(f"지역 '{region}'")
    if employee_count:
        filters_used.append(f"직원 {employee_count}명")
    if company_age:
        filters_used.append(f"업력 {company_age}년")
    match_reason = (
        f"{'·'.join(filters_used)} 기반 {len(top_grants)}개 과제 매칭"
        if filters_used else f"{len(top_grants)}개 과제 매칭"
    )

    return {
        "matched_grants": top_grants,
        "match_reason": match_reason,
    }


# ── 5. Company Network ──────────────────────────────────────────────────────

@router.get("/network")
async def get_company_network(
    db: AsyncSession = Depends(get_db),
):
    """Return anonymized industry-region cluster network for Cytoscape.js.

    Privacy: no individual company names or user IDs are exposed.
    Each node = (industry, region) cluster; edges = clusters sharing bookmark interest.
    """
    result = await db.execute(
        text("""
        SELECT
            COALESCE(u.industry, '미분류') AS industry,
            COALESCE(u.region, '전국') AS region,
            COUNT(DISTINCT u.id) AS company_count,
            array_agg(DISTINCT b.grant_id) AS grant_ids
        FROM users u
        JOIN user_bookmarks b ON b.user_id = u.id
        GROUP BY COALESCE(u.industry, '미분류'), COALESCE(u.region, '전국')
        HAVING COUNT(DISTINCT u.id) >= 1
        """)
    )
    rows = result.fetchall()

    # Build cluster nodes — no individual company info
    grant_to_clusters: dict = defaultdict(list)
    cluster_nodes = []

    for row in rows:
        cluster_id = f"{row.industry}__{row.region}"
        company_count = row.company_count or 0
        cluster_nodes.append({
            "data": {
                "id": cluster_id,
                "label": f"{row.industry} · {row.region}",
                "industry": row.industry,
                "region": row.region,
                "company_count": company_count,
                "type": "Cluster",
                # Size scales with company count (min 20, max 60)
                "size": min(20 + company_count * 5, 60),
            }
        })
        for gid in (row.grant_ids or []):
            if gid:
                grant_to_clusters[str(gid)].append(cluster_id)

    # Edges between clusters that share bookmarked grants
    edge_weights: dict = defaultdict(int)
    for clusters in grant_to_clusters.values():
        for i in range(len(clusters)):
            for j in range(i + 1, len(clusters)):
                edge_key = tuple(sorted([clusters[i], clusters[j]]))
                edge_weights[edge_key] += 1

    edges = [
        {"data": {"source": src, "target": tgt, "rel": "SHARED_INTEREST", "weight": w}}
        for (src, tgt), w in sorted(edge_weights.items(), key=lambda x: -x[1])[:300]
    ]

    return {
        "nodes": cluster_nodes,
        "edges": edges,
        "stats": {
            "company_count": sum(n["data"]["company_count"] for n in cluster_nodes),
            "edge_count": len(edges),
            "cluster_count": len(cluster_nodes),
        },
    }
