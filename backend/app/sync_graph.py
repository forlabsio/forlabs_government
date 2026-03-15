# backend/app/sync_graph.py
"""Sync PostgreSQL grant data to Neo4j Knowledge Graph."""
import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.graph import run_query
from app.models import GrantProject

logger = logging.getLogger(__name__)

# KSIC top-level industry codes (simplified for MVP)
KSIC_CATEGORIES = {
    "IT/소프트웨어": {"id": "ksic_j", "name": "정보통신업", "level": 1},
    "제조업": {"id": "ksic_c", "name": "제조업", "level": 1},
    "바이오/의료": {"id": "ksic_q", "name": "보건·사회복지", "level": 1},
    "문화/콘텐츠": {"id": "ksic_r", "name": "예술·스포츠·여가", "level": 1},
    "농업/식품": {"id": "ksic_a", "name": "농업·임업·어업", "level": 1},
    "건설": {"id": "ksic_f", "name": "건설업", "level": 1},
    "유통/물류": {"id": "ksic_g", "name": "도소매업", "level": 1},
    "서비스업": {"id": "ksic_n", "name": "사업시설 관리", "level": 1},
}

# Category → industry mapping for auto-tagging
CATEGORY_TO_INDUSTRY = {
    "R&D": ["IT/소프트웨어", "바이오/의료", "제조업"],
    "창업": ["IT/소프트웨어", "문화/콘텐츠", "서비스업"],
    "자금": ["제조업", "유통/물류", "서비스업"],
    "수출": ["제조업", "IT/소프트웨어"],
    "인력": ["제조업", "IT/소프트웨어", "서비스업"],
}


async def sync_grant_to_neo4j(grant: GrantProject) -> None:
    """Upsert a single grant and its relationships to Neo4j."""
    grant_id = str(grant.id)

    # 1. Upsert Grant node
    await run_query(
        """
        MERGE (g:Grant {id: $id})
        SET g.title = $title,
            g.category = $category,
            g.amount_min = $amount_min,
            g.amount_max = $amount_max,
            g.status = $status,
            g.end_date = $end_date,
            g.organization = $organization
        """,
        {
            "id": grant_id,
            "title": grant.title,
            "category": grant.category or "",
            "amount_min": grant.amount_min or 0,
            "amount_max": grant.amount_max or 0,
            "status": grant.status or "접수중",
            "end_date": str(grant.end_date) if grant.end_date else "",
            "organization": grant.organization or "",
        },
    )

    # 2. Upsert Agency node + relationship
    if grant.organization:
        await run_query(
            """
            MERGE (a:Agency {id: $agency_id})
            SET a.name = $name
            WITH a
            MATCH (g:Grant {id: $grant_id})
            MERGE (g)-[:MANAGED_BY]->(a)
            """,
            {
                "agency_id": f"agency_{grant.organization}",
                "name": grant.organization,
                "grant_id": grant_id,
            },
        )

    # 3. Upsert TechArea nodes + relationships based on category
    industries = CATEGORY_TO_INDUSTRY.get(grant.category or "", [])
    for industry_key in industries:
        tech = KSIC_CATEGORIES.get(industry_key)
        if not tech:
            continue
        await run_query(
            """
            MERGE (t:TechArea {id: $tech_id})
            SET t.name = $name, t.level = $level
            WITH t
            MATCH (g:Grant {id: $grant_id})
            MERGE (g)-[:TARGETS_SECTOR]->(t)
            """,
            {
                "tech_id": tech["id"],
                "name": tech["name"],
                "level": tech["level"],
                "grant_id": grant_id,
            },
        )


async def sync_all_grants(db: AsyncSession, limit: int = 1000) -> int:
    """Sync all active grants from PostgreSQL to Neo4j."""
    result = await db.execute(
        select(GrantProject)
        .options(selectinload(GrantProject.sources))
        .where(GrantProject.status == "접수중")
        .limit(limit)
    )
    grants = result.scalars().all()

    synced = 0
    for grant in grants:
        try:
            await sync_grant_to_neo4j(grant)
            synced += 1
        except Exception as e:
            logger.error(f"Failed to sync grant {grant.id}: {e}")

    logger.info(f"Synced {synced}/{len(grants)} grants to Neo4j")
    return synced
