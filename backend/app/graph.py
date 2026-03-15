from __future__ import annotations
# backend/app/graph.py
"""Neo4j Aura driver singleton and helper utilities."""
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from neo4j import AsyncDriver, AsyncGraphDatabase

from app.config import settings

logger = logging.getLogger(__name__)

_driver: AsyncDriver | None = None


def get_driver() -> AsyncDriver:
    """Return the global Neo4j driver instance."""
    global _driver
    if _driver is None:
        if not settings.neo4j_uri:
            raise RuntimeError("NEO4J_URI not configured")
        _driver = AsyncGraphDatabase.driver(
            settings.neo4j_uri,
            auth=(settings.neo4j_username, settings.neo4j_password),
        )
    return _driver


async def close_driver() -> None:
    global _driver
    if _driver:
        await _driver.close()
        _driver = None


@asynccontextmanager
async def graph_session() -> AsyncGenerator:
    """Async context manager for a Neo4j session."""
    driver = get_driver()
    async with driver.session(database="neo4j") as session:
        yield session


async def run_query(cypher: str, params: dict | None = None) -> list[dict]:
    """Execute a Cypher query and return list of record dicts."""
    async with graph_session() as session:
        result = await session.run(cypher, params or {})
        records = await result.data()
        return records
