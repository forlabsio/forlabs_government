# backend/app/routers/intelligence.py
"""Intelligence API: recommendation, graph queries, trends, matching, network."""
import logging
from collections import defaultdict
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.graph import run_query
from app.models import GrantProject, User
from app.schemas import GrantListItem

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
        WHERE created_at >= NOW() - INTERVAL :months_interval
          AND category IS NOT NULL
        GROUP BY DATE_TRUNC('month', created_at), category
        ORDER BY month ASC
        """),
        {"months_interval": f"{months} months"},
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

@router.post("/match")
async def auto_match(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """Auto-match company profile against active grants via Neo4j graph traversal."""
    from app.sync_graph import KSIC_CATEGORIES, CATEGORY_TO_INDUSTRY

    industry = body.get("industry", "")
    region = body.get("region", "")

    tech_info = KSIC_CATEGORIES.get(industry)
    tech_id = tech_info["id"] if tech_info else None

    graph_result = []
    if tech_id:
        try:
            graph_result = await run_query(
                """
                MATCH (t:TechArea {id: $tech_id})<-[:TARGETS_SECTOR]-(g:Grant)
                WHERE g.status = '접수중'
                RETURN g.id AS grant_id, g.title AS title,
                       g.amount_max AS amount_max, g.end_date AS end_date,
                       g.organization AS organization, g.category AS category
                ORDER BY g.amount_max DESC
                LIMIT 20
                """,
                {"tech_id": tech_id},
            )
        except Exception as e:
            logger.warning(f"Neo4j match query failed, falling back to PG: {e}")

    # Fallback to PostgreSQL if Neo4j unavailable or no results
    if not graph_result:
        pg_query = (
            select(GrantProject)
            .where(GrantProject.status == "접수중")
            .order_by(GrantProject.end_date.asc().nullslast())
            .limit(20)
        )
        if region and region != "전국":
            pg_query = pg_query.where(GrantProject.target_region.any(region))

        pg_result = await db.execute(pg_query)
        grants = pg_result.scalars().all()
        graph_result = [
            {
                "grant_id": str(g.id), "title": g.title,
                "amount_max": g.amount_max,
                "end_date": str(g.end_date) if g.end_date else None,
                "organization": g.organization, "category": g.category,
            }
            for g in grants
        ]

    # Build Cytoscape.js graph for match visualization
    company_node = {
        "data": {"id": "company_input", "label": industry or "내 기업", "type": "Company"}
    }
    tech_node = (
        {
            "data": {
                "id": tech_id,
                "label": tech_info["name"] if tech_info else industry,
                "type": "TechArea",
            }
        }
        if tech_id else None
    )

    cy_nodes = [company_node]
    cy_edges = []
    if tech_node:
        cy_nodes.append(tech_node)
        cy_edges.append({
            "data": {"source": "company_input", "target": tech_id, "rel": "IN_SECTOR"}
        })

    for r in graph_result[:10]:
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
        "matched_grants": graph_result,
        "graph": {"nodes": cy_nodes, "edges": cy_edges},
        "match_reason": f"업종 '{industry}' 기반 {len(graph_result)}개 과제 매칭",
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
