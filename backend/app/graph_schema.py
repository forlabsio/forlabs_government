# backend/app/graph_schema.py
"""Initialize Neo4j schema: constraints and indexes."""
import asyncio
import logging

from app.graph import run_query

logger = logging.getLogger(__name__)

CONSTRAINTS = [
    "CREATE CONSTRAINT grant_id IF NOT EXISTS FOR (g:Grant) REQUIRE g.id IS UNIQUE",
    "CREATE CONSTRAINT company_id IF NOT EXISTS FOR (c:Company) REQUIRE c.id IS UNIQUE",
    "CREATE CONSTRAINT agency_id IF NOT EXISTS FOR (a:Agency) REQUIRE a.id IS UNIQUE",
    "CREATE CONSTRAINT tech_id IF NOT EXISTS FOR (t:TechArea) REQUIRE t.id IS UNIQUE",
]

INDEXES = [
    "CREATE INDEX grant_status IF NOT EXISTS FOR (g:Grant) ON (g.status)",
    "CREATE INDEX grant_end_date IF NOT EXISTS FOR (g:Grant) ON (g.end_date)",
    "CREATE INDEX tech_ksic IF NOT EXISTS FOR (t:TechArea) ON (t.ksic_code)",
]


async def init_schema():
    """Apply all constraints and indexes to Neo4j."""
    for stmt in CONSTRAINTS + INDEXES:
        try:
            await run_query(stmt)
            logger.info(f"Applied: {stmt[:60]}...")
        except Exception as e:
            logger.warning(f"Schema statement skipped: {e}")
    logger.info("Neo4j schema initialization complete")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(init_schema())
