# backend/app/sync_graph.py
"""Sync PostgreSQL grant/user data to Neo4j Knowledge Graph."""
import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.graph import run_query
from app.models import GrantProject, User
from app.services.eligibility import compute_eligibility

logger = logging.getLogger(__name__)

# KSIC top-level industry codes
KSIC_CATEGORIES = {
    "IT/소프트웨어": {"id": "ksic_j", "name": "정보통신업", "level": 1},
    "제조업": {"id": "ksic_c", "name": "제조업", "level": 1},
    "바이오/의료": {"id": "ksic_q", "name": "보건·사회복지", "level": 1},
    "문화/콘텐츠": {"id": "ksic_r", "name": "예술·스포츠·여가", "level": 1},
    "농업/식품": {"id": "ksic_a", "name": "농업·임업·어업", "level": 1},
    "건설": {"id": "ksic_f", "name": "건설업", "level": 1},
    "유통/물류": {"id": "ksic_g", "name": "도소매업", "level": 1},
    "서비스업": {"id": "ksic_n", "name": "사업시설 관리", "level": 1},
    "에너지/환경": {"id": "ksic_e", "name": "에너지·환경", "level": 1},
}

CATEGORY_TO_INDUSTRY = {
    "R&D": ["IT/소프트웨어", "바이오/의료", "제조업"],
    "창업": ["IT/소프트웨어", "문화/콘텐츠", "서비스업"],
    "자금": ["제조업", "유통/물류", "서비스업"],
    "수출": ["제조업", "IT/소프트웨어"],
    "인력": ["제조업", "IT/소프트웨어", "서비스업"],
}

ELIGIBILITY_THRESHOLD = 60


async def sync_grant_to_neo4j(grant: GrantProject) -> None:
    """Upsert a single grant and its relationships to Neo4j.

    Creates semantic edges from parsed_requirements when available:
    - TARGETS_INDUSTRY / EXCLUDES_INDUSTRY
    - RESTRICTS_REGION
    - REQUIRES_CERT
    Numeric constraints stored as Grant node properties for graph queries.
    """
    grant_id = str(grant.id)
    req: dict[str, Any] = grant.parsed_requirements or {}

    # 1. Upsert Grant node with full properties
    await run_query(
        """
        MERGE (g:Grant {id: $id})
        SET g.title = $title,
            g.category = $category,
            g.amount_min = $amount_min,
            g.amount_max = $amount_max,
            g.status = $status,
            g.end_date = $end_date,
            g.organization = $organization,
            g.max_company_age = $max_company_age,
            g.min_company_age = $min_company_age,
            g.employee_count_max = $employee_count_max,
            g.employee_count_min = $employee_count_min,
            g.max_revenue_krw = $max_revenue_krw,
            g.min_revenue_krw = $min_revenue_krw,
            g.require_corporate = $require_corporate,
            g.require_venture = $require_venture,
            g.metropolitan_only = $metropolitan_only,
            g.has_parsed_requirements = $has_parsed_requirements
        """,
        {
            "id": grant_id,
            "title": grant.title or "",
            "category": grant.category or "",
            "amount_min": grant.amount_min or 0,
            "amount_max": grant.amount_max or 0,
            "status": grant.status or "접수중",
            "end_date": str(grant.end_date) if grant.end_date else "",
            "organization": grant.organization or "",
            "max_company_age": req.get("max_company_age_years"),
            "min_company_age": req.get("min_company_age_years"),
            "employee_count_max": req.get("employee_count_max"),
            "employee_count_min": req.get("employee_count_min"),
            "max_revenue_krw": req.get("max_revenue_krw"),
            "min_revenue_krw": req.get("min_revenue_krw"),
            "require_corporate": req.get("require_corporate", False),
            "require_venture": req.get("require_venture_cert", False),
            "metropolitan_only": req.get("metropolitan_only"),
            "has_parsed_requirements": bool(req),
        },
    )

    # 2. Upsert Agency node + MANAGED_BY
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

    # 3. Industry edges — prefer parsed_requirements, fall back to category mapping
    allowed_industries: list[str] = req.get("allowed_industries") or []
    if allowed_industries:
        for industry in allowed_industries[:5]:  # cap to avoid bloat
            industry_id = f"industry_{industry.replace('/', '_')}"
            await run_query(
                """
                MERGE (i:Industry {id: $industry_id})
                SET i.name = $name
                WITH i
                MATCH (g:Grant {id: $grant_id})
                MERGE (g)-[:TARGETS_INDUSTRY]->(i)
                """,
                {
                    "industry_id": industry_id,
                    "name": industry,
                    "grant_id": grant_id,
                },
            )
    else:
        # fallback: category-based tagging
        for industry_key in CATEGORY_TO_INDUSTRY.get(grant.category or "", []):
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

    # 4. Excluded industry edges
    excluded_industries: list[str] = req.get("excluded_industries") or []
    for industry in excluded_industries[:3]:
        industry_id = f"industry_{industry.replace('/', '_')}"
        await run_query(
            """
            MERGE (i:Industry {id: $industry_id})
            SET i.name = $name
            WITH i
            MATCH (g:Grant {id: $grant_id})
            MERGE (g)-[:EXCLUDES_INDUSTRY]->(i)
            """,
            {
                "industry_id": industry_id,
                "name": industry,
                "grant_id": grant_id,
            },
        )

    # 5. Region restriction edges
    allowed_regions: list[str] = req.get("allowed_regions") or []
    for region in allowed_regions[:5]:
        region_id = f"region_{region}"
        await run_query(
            """
            MERGE (r:Region {id: $region_id})
            SET r.name = $name
            WITH r
            MATCH (g:Grant {id: $grant_id})
            MERGE (g)-[:RESTRICTS_REGION]->(r)
            """,
            {
                "region_id": region_id,
                "name": region,
                "grant_id": grant_id,
            },
        )

    # 6. Certification requirement edges
    CERT_NODES = {
        "이노비즈": "cert_innobiz",
        "메인비즈": "cert_mainbiz",
        "여성기업": "cert_women",
        "사회적기업": "cert_social",
        "벤처": "cert_venture",
        "장애인기업": "cert_disabled",
    }
    if req.get("require_venture_cert"):
        await run_query(
            """
            MERGE (c:Certification {id: 'cert_venture'})
            SET c.name = '벤처기업인증'
            WITH c
            MATCH (g:Grant {id: $grant_id})
            MERGE (g)-[:REQUIRES_CERT]->(c)
            """,
            {"grant_id": grant_id},
        )
    for condition in (req.get("unextracted_conditions") or [])[:5]:
        for keyword, cert_id in CERT_NODES.items():
            if keyword in condition and "필수" in condition:
                await run_query(
                    """
                    MERGE (c:Certification {id: $cert_id})
                    SET c.name = $name
                    WITH c
                    MATCH (g:Grant {id: $grant_id})
                    MERGE (g)-[:REQUIRES_CERT]->(c)
                    """,
                    {
                        "cert_id": cert_id,
                        "name": keyword,
                        "grant_id": grant_id,
                    },
                )
                break


async def sync_company_to_neo4j(user: User) -> None:
    """Upsert a Company node (from User profile) and its relationships."""
    user_id = str(user.id)
    company_id = f"company_{user_id}"
    company_name = user.company_name or user.name or user.email

    # 1. Upsert Company node
    await run_query(
        """
        MERGE (c:Company {id: $company_id})
        SET c.name = $name,
            c.industry = $industry,
            c.region = $region,
            c.company_age = $company_age,
            c.employee_count = $employee_count,
            c.revenue_krw = $revenue_krw,
            c.is_corporate = $is_corporate,
            c.is_venture = $is_venture,
            c.user_id = $user_id
        """,
        {
            "company_id": company_id,
            "name": company_name,
            "industry": user.industry or "",
            "region": user.region or "",
            "company_age": user.company_age,
            "employee_count": user.employee_count,
            "revenue_krw": getattr(user, "revenue_krw", None),
            "is_corporate": getattr(user, "is_corporate", False),
            "is_venture": getattr(user, "is_venture", False),
            "user_id": user_id,
        },
    )

    # 2. OPERATES_IN Industry edge
    if user.industry:
        industry_id = f"industry_{user.industry.replace('/', '_')}"
        await run_query(
            """
            MERGE (i:Industry {id: $industry_id})
            SET i.name = $name
            WITH i
            MATCH (c:Company {id: $company_id})
            MERGE (c)-[:OPERATES_IN]->(i)
            """,
            {
                "industry_id": industry_id,
                "name": user.industry,
                "company_id": company_id,
            },
        )

    # 3. LOCATED_IN Region edge
    if user.region:
        region_id = f"region_{user.region}"
        await run_query(
            """
            MERGE (r:Region {id: $region_id})
            SET r.name = $name
            WITH r
            MATCH (c:Company {id: $company_id})
            MERGE (c)-[:LOCATED_IN]->(r)
            """,
            {
                "region_id": region_id,
                "name": user.region,
                "company_id": company_id,
            },
        )

    # 4. HAS_CERT edges
    CERT_NODE_MAP = {
        "이노비즈": "cert_innobiz",
        "메인비즈": "cert_mainbiz",
        "여성기업": "cert_women",
        "사회적기업": "cert_social",
        "장애인기업": "cert_disabled",
        "벤처": "cert_venture",
    }
    certs: list[str] = getattr(user, "certifications", []) or []
    for cert in certs:
        for keyword, cert_id in CERT_NODE_MAP.items():
            if keyword in cert:
                await run_query(
                    """
                    MERGE (c_node:Certification {id: $cert_id})
                    SET c_node.name = $cert_name
                    WITH c_node
                    MATCH (co:Company {id: $company_id})
                    MERGE (co)-[:HAS_CERT]->(c_node)
                    """,
                    {
                        "cert_id": cert_id,
                        "cert_name": keyword,
                        "company_id": company_id,
                    },
                )
                break
    if getattr(user, "is_venture", False):
        await run_query(
            """
            MERGE (c_node:Certification {id: 'cert_venture'})
            SET c_node.name = '벤처기업인증'
            WITH c_node
            MATCH (co:Company {id: $company_id})
            MERGE (co)-[:HAS_CERT]->(c_node)
            """,
            {"company_id": company_id},
        )


async def sync_eligibility_edges(
    user: User,
    active_grants: list[GrantProject],
    threshold: int = ELIGIBILITY_THRESHOLD,
) -> int:
    """Compute and upsert ELIGIBLE_FOR edges between Company and Grant nodes.

    Returns the number of eligible edges created/updated.
    """
    company_id = f"company_{user.id}"
    profile = {
        "company_age": user.company_age,
        "industry": user.industry,
        "region": user.region,
        "employee_count": user.employee_count,
        "revenue_krw": getattr(user, "revenue_krw", None),
        "revenue_range": user.revenue_range,
        "certifications": getattr(user, "certifications", []) or [],
        "is_corporate": getattr(user, "is_corporate", False),
        "is_venture": getattr(user, "is_venture", False),
    }

    # First, remove stale ELIGIBLE_FOR edges for this company
    await run_query(
        "MATCH (c:Company {id: $company_id})-[r:ELIGIBLE_FOR]->() DELETE r",
        {"company_id": company_id},
    )

    created = 0
    for grant in active_grants:
        if not grant.parsed_requirements:
            continue
        elig = compute_eligibility(profile, grant.parsed_requirements)
        effective_score = elig.score if elig.score is not None else 100  # no restrictions = universally eligible
        if effective_score < threshold:
            continue

        await run_query(
            """
            MATCH (c:Company {id: $company_id})
            MATCH (g:Grant {id: $grant_id})
            MERGE (c)-[r:ELIGIBLE_FOR]->(g)
            SET r.score = $score,
                r.confidence = $confidence,
                r.checklist_pass = $pass_count,
                r.checklist_fail = $fail_count
            """,
            {
                "company_id": company_id,
                "grant_id": str(grant.id),
                "score": effective_score,
                "confidence": elig.confidence,
                "pass_count": sum(1 for c in elig.checklist if c.status == "pass"),
                "fail_count": sum(1 for c in elig.checklist if c.status == "fail"),
            },
        )
        created += 1

    return created


async def sync_all_grants(db: AsyncSession, limit: int = 2000) -> int:
    """Sync active grants from PostgreSQL to Neo4j."""
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


async def sync_all_companies(db: AsyncSession) -> int:
    """Sync all user profiles as Company nodes to Neo4j."""
    result = await db.execute(
        select(User).where(User.industry.isnot(None))
    )
    users = result.scalars().all()

    synced = 0
    for user in users:
        try:
            await sync_company_to_neo4j(user)
            synced += 1
        except Exception as e:
            logger.error(f"Failed to sync company for user {user.id}: {e}")

    logger.info(f"Synced {synced}/{len(users)} companies to Neo4j")
    return synced


async def sync_all_eligibility(db: AsyncSession, threshold: int = ELIGIBILITY_THRESHOLD) -> int:
    """Compute ELIGIBLE_FOR edges for all users with profiles."""
    from datetime import date

    users_result = await db.execute(
        select(User).where(User.industry.isnot(None))
    )
    users = users_result.scalars().all()

    grants_result = await db.execute(
        select(GrantProject).where(
            (GrantProject.end_date >= date.today()) | GrantProject.end_date.is_(None)
        ).where(
            GrantProject.parsed_requirements.isnot(None)
        )
    )
    active_grants = grants_result.scalars().all()

    logger.info(f"Computing eligibility: {len(users)} companies × {len(active_grants)} grants")

    total = 0
    for user in users:
        try:
            count = await sync_eligibility_edges(user, active_grants, threshold)
            total += count
        except Exception as e:
            logger.error(f"Failed eligibility sync for user {user.id}: {e}")

    logger.info(f"Created {total} ELIGIBLE_FOR edges")
    return total
