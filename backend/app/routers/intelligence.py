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
from app.graph import run_query
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


# ── 2. Graph Nodes ──────────────────────────────────────────────────────────

@router.get("/graph/nodes")
async def get_graph_nodes(
    limit: int = Query(100, ge=10, le=500),
):
    """Return graph nodes and edges for Cytoscape.js visualization."""
    try:
        grants_result = await run_query(
            """
            MATCH (g:Grant)
            WHERE g.status = '접수중'
            RETURN g.id AS id, g.title AS title, g.category AS category,
                   g.organization AS organization, 'Grant' AS type
            LIMIT $limit
            """,
            {"limit": limit},
        )

        agencies_result = await run_query(
            """
            MATCH (g:Grant)-[:MANAGED_BY]->(a:Agency)
            WHERE g.status = '접수중'
            RETURN DISTINCT a.id AS id, a.name AS name, 'Agency' AS type
            LIMIT 50
            """
        )

        tech_result = await run_query(
            """
            MATCH (t:TechArea)<-[:TARGETS_SECTOR]-(g:Grant)
            WHERE g.status = '접수중'
            RETURN DISTINCT t.id AS id, t.name AS name, 'TechArea' AS type
            """
        )

        edges_result = await run_query(
            """
            MATCH (g:Grant)-[r]->(n)
            WHERE g.status = '접수중' AND type(r) IN ['MANAGED_BY', 'TARGETS_SECTOR']
            RETURN g.id AS source, n.id AS target, type(r) AS rel_type
            LIMIT $limit
            """,
            {"limit": limit * 2},
        )

    except Exception as e:
        logger.warning(f"Neo4j query failed, returning empty graph: {e}")
        return {"nodes": [], "edges": []}

    nodes = []
    for g in grants_result:
        nodes.append({
            "data": {
                "id": g["id"], "label": g["title"][:30],
                "type": "Grant", "category": g.get("category", ""),
                "organization": g.get("organization", ""),
            }
        })
    for a in agencies_result:
        nodes.append({
            "data": {"id": a["id"], "label": a["name"], "type": "Agency"}
        })
    for t in tech_result:
        nodes.append({
            "data": {"id": t["id"], "label": t["name"], "type": "TechArea"}
        })

    edges = [
        {"data": {"source": e["source"], "target": e["target"], "rel": e["rel_type"]}}
        for e in edges_result
    ]

    return {"nodes": nodes, "edges": edges}


@router.get("/graph/overview")
async def get_graph_overview():
    """Overview: all Agencies + TechAreas with aggregated stats. 1,000 grants all included."""
    try:
        agencies_result = await run_query("""
            MATCH (g:Grant)-[:MANAGED_BY]->(a:Agency)
            WHERE g.status = '접수중'
            WITH a, count(g) AS grant_count, sum(coalesce(g.amount_max, 0)) AS total_amount
            RETURN a.id AS id, a.name AS name, 'Agency' AS type,
                   grant_count, total_amount
            ORDER BY grant_count DESC
        """)
        tech_result = await run_query("""
            MATCH (g:Grant)-[:TARGETS_SECTOR]->(t:TechArea)
            WHERE g.status = '접수중'
            WITH t, count(g) AS grant_count, sum(coalesce(g.amount_max, 0)) AS total_amount
            RETURN t.id AS id, t.name AS name, 'TechArea' AS type,
                   grant_count, total_amount
            ORDER BY total_amount DESC
        """)
        edges_result = await run_query("""
            MATCH (a:Agency)<-[:MANAGED_BY]-(g:Grant)-[:TARGETS_SECTOR]->(t:TechArea)
            WHERE g.status = '접수중'
            WITH a, t, count(g) AS shared
            RETURN a.id AS source, t.id AS target, shared AS weight
            ORDER BY shared DESC
        """)
    except Exception as e:
        logger.warning(f"Neo4j overview query failed: {e}")
        return {"nodes": [], "edges": []}

    max_agency = max([a.get("grant_count", 1) for a in agencies_result] or [1])
    max_tech_amt = max([(t.get("total_amount") or 0) for t in tech_result] or [1]) or 0
    max_tech_cnt = max([t.get("grant_count", 1) for t in tech_result] or [1])

    nodes = []
    for a in agencies_result:
        nodes.append({"data": {
            "id": a["id"], "label": a["name"], "type": "Agency",
            "grant_count": a["grant_count"],
            "total_amount": int(a.get("total_amount") or 0),
            "weight": a["grant_count"] / max_agency,
        }})
    for t in tech_result:
        amt = t.get("total_amount") or 0
        # fall back to grant_count-based weight when amount data is missing
        weight = (amt / max_tech_amt) if max_tech_amt > 0 else (t["grant_count"] / max_tech_cnt)
        nodes.append({"data": {
            "id": t["id"], "label": t["name"], "type": "TechArea",
            "grant_count": t["grant_count"],
            "total_amount": int(amt),
            "weight": weight,
        }})

    edges = [
        {"data": {"source": e["source"], "target": e["target"], "weight": e["weight"], "rel": "SHARED_GRANTS"}}
        for e in edges_result
    ]
    return {"nodes": nodes, "edges": edges}


@router.get("/graph/expand/{node_id:path}")
async def expand_graph_node(node_id: str):
    """Drilldown: returns all grants connected to a specific Agency or TechArea."""
    is_agency = node_id.startswith("agency_")
    try:
        if is_agency:
            grants_result = await run_query("""
                MATCH (g:Grant)-[:MANAGED_BY]->(a:Agency {id: $node_id})
                WHERE g.status = '접수중'
                RETURN g.id AS id, g.title AS title, g.category AS category,
                       g.organization AS organization, g.amount_max AS amount_max,
                       g.end_date AS end_date, 'Grant' AS type
                ORDER BY g.amount_max DESC
            """, {"node_id": node_id})
            hub_result = await run_query(
                "MATCH (a:Agency {id: $id}) RETURN a.name AS name", {"id": node_id}
            )
            hub_type = "Agency"
        else:
            grants_result = await run_query("""
                MATCH (g:Grant)-[:TARGETS_SECTOR]->(t:TechArea {id: $node_id})
                WHERE g.status = '접수중'
                RETURN g.id AS id, g.title AS title, g.category AS category,
                       g.organization AS organization, g.amount_max AS amount_max,
                       g.end_date AS end_date, 'Grant' AS type
                ORDER BY g.amount_max DESC
            """, {"node_id": node_id})
            hub_result = await run_query(
                "MATCH (t:TechArea {id: $id}) RETURN t.name AS name", {"id": node_id}
            )
            hub_type = "TechArea"
    except Exception as e:
        logger.warning(f"Neo4j expand query failed: {e}")
        return {"nodes": [], "edges": [], "hub": {"id": node_id, "label": node_id, "type": "Agency", "grant_count": 0}}

    hub_label = hub_result[0]["name"] if hub_result else node_id
    max_amount = max([(g.get("amount_max") or 0) for g in grants_result] or [1]) or 1

    nodes = [{"data": {
        "id": node_id, "label": hub_label, "type": hub_type,
        "is_hub": True, "grant_count": len(grants_result), "weight": 1.0,
    }}]
    for g in grants_result:
        nodes.append({"data": {
            "id": g["id"], "label": g["title"], "type": "Grant",
            "category": g.get("category"),
            "organization": g.get("organization"),
            "amount_max": g.get("amount_max"),
            "end_date": str(g.get("end_date")) if g.get("end_date") else None,
            "weight": (g.get("amount_max") or 0) / max_amount,
        }})

    edges = [
        {"data": {"source": node_id, "target": g["id"],
                  "rel": "MANAGED_BY" if is_agency else "TARGETS_SECTOR"}}
        for g in grants_result
    ]
    return {
        "nodes": nodes, "edges": edges,
        "hub": {"id": node_id, "label": hub_label, "type": hub_type, "grant_count": len(grants_result)},
    }


@router.get("/graph/node/{node_id}")
async def get_node_detail(node_id: str):
    """Return a specific node with its neighbors."""
    try:
        result = await run_query(
            """
            MATCH (n {id: $id})
            OPTIONAL MATCH (n)-[r]-(neighbor)
            RETURN n, collect({
                id: neighbor.id,
                label: coalesce(neighbor.title, neighbor.name),
                type: labels(neighbor)[0],
                rel: type(r)
            }) AS neighbors
            """,
            {"id": node_id},
        )
    except Exception as e:
        logger.warning(f"Neo4j node detail failed: {e}")
        return {"error": "Neo4j not configured"}

    if not result:
        return {"error": "Node not found"}
    return result[0]


# ── 3. Trends ───────────────────────────────────────────────────────────────

@router.get("/trends")
async def get_trends(
    months: int = Query(6, ge=1, le=24),
    db: AsyncSession = Depends(get_db),
):
    """Return grant trend data grouped by month and category."""
    result = await db.execute(
        text("""
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
        """),
        {"months": months},
    )
    rows = result.fetchall()

    agency_result = await db.execute(
        text("""
        SELECT organization, COUNT(*) as count
        FROM grant_projects
        WHERE status = '접수중' AND organization IS NOT NULL
        GROUP BY organization
        ORDER BY count DESC
        LIMIT 15
        """)
    )

    trend_data: dict = {}
    for row in rows:
        month_str = row.month.strftime("%Y-%m") if row.month else "unknown"
        if month_str not in trend_data:
            trend_data[month_str] = {}
        trend_data[month_str][row.category] = {
            "count": row.count,
            "total_amount": int(row.total_amount or 0),
        }

    agencies = [
        {"name": r.organization, "count": r.count}
        for r in agency_result.fetchall()
    ]

    categories: set = set()
    for month_data in trend_data.values():
        categories.update(month_data.keys())

    chart_data = []
    for month, data in sorted(trend_data.items()):
        entry: dict = {"month": month}
        for cat in categories:
            entry[cat] = data.get(cat, {}).get("count", 0)
        chart_data.append(entry)

    return {
        "chart_data": chart_data,
        "categories": list(categories),
        "agencies": agencies,
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

    # ── 4. Build Cytoscape graph (company → industry → top grants) ─────────
    from app.sync_graph import KSIC_CATEGORIES
    tech_info = KSIC_CATEGORIES.get(industry)
    tech_id = tech_info["id"] if tech_info else None

    company_node = {
        "data": {"id": "company_input", "label": industry or "내 기업", "type": "Company"}
    }
    tech_node = (
        {"data": {"id": tech_id, "label": tech_info["name"] if tech_info else industry, "type": "TechArea"}}
        if tech_id else None
    )

    cy_nodes = [company_node]
    cy_edges = []
    if tech_node:
        cy_nodes.append(tech_node)
        cy_edges.append({"data": {"source": "company_input", "target": tech_id, "rel": "IN_SECTOR"}})

    for r in top_grants[:10]:
        cy_nodes.append({
            "data": {
                "id": r["grant_id"], "label": r["title"][:25],
                "type": "Grant", "amount_max": r.get("amount_max"),
            }
        })
        if tech_id:
            cy_edges.append({
                "data": {
                    "source": tech_id, "target": r["grant_id"], "rel": "TARGETS_SECTOR"
                }
            })

    return {
        "matched_grants": top_grants,
        "graph": {"nodes": cy_nodes, "edges": cy_edges},
        "match_reason": match_reason,
    }


# ── 5. Company Network ──────────────────────────────────────────────────────

@router.get("/network")
async def get_company_network(
    db: AsyncSession = Depends(get_db),
):
    """Return company co-interest network for Cytoscape.js."""
    result = await db.execute(
        text("""
        SELECT
            u.id AS user_id,
            u.company_name,
            u.industry,
            u.region,
            array_agg(b.grant_id) AS grant_ids
        FROM users u
        JOIN user_bookmarks b ON b.user_id = u.id
        WHERE u.company_name IS NOT NULL
        GROUP BY u.id, u.company_name, u.industry, u.region
        HAVING COUNT(b.grant_id) > 0
        LIMIT 100
        """)
    )
    rows = result.fetchall()

    grant_to_companies: dict = defaultdict(list)
    company_nodes = []

    for row in rows:
        company_nodes.append({
            "data": {
                "id": str(row.user_id),
                "label": row.company_name,
                "industry": row.industry or "미분류",
                "region": row.region or "전국",
                "type": "Company",
                "bookmark_count": len(row.grant_ids) if row.grant_ids else 0,
            }
        })
        for gid in (row.grant_ids or []):
            grant_to_companies[str(gid)].append(str(row.user_id))

    edge_set: set = set()
    for companies in grant_to_companies.values():
        for i in range(len(companies)):
            for j in range(i + 1, len(companies)):
                edge_key = tuple(sorted([companies[i], companies[j]]))
                edge_set.add(edge_key)

    edges = [
        {"data": {"source": src, "target": tgt, "rel": "PEER_OF"}}
        for src, tgt in list(edge_set)[:500]
    ]

    return {
        "nodes": company_nodes,
        "edges": edges,
        "stats": {
            "company_count": len(company_nodes),
            "edge_count": len(edges),
        },
    }
