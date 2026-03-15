from __future__ import annotations
# backend/app/embedding.py
import logging

import voyageai

from app.config import settings

logger = logging.getLogger(__name__)

EMBEDDING_MODEL = "voyage-multilingual-2"
EMBEDDING_DIM = 1024

_client: voyageai.AsyncClient | None = None


def _get_client() -> voyageai.AsyncClient:
    global _client
    if _client is None:
        _client = voyageai.AsyncClient(api_key=settings.voyage_api_key)
    return _client


async def generate_embedding(text: str) -> list[float] | None:
    """Generate embedding vector for given text using Voyage AI."""
    if not settings.voyage_api_key:
        logger.warning("Voyage API key not set, skipping embedding")
        return None
    try:
        client = _get_client()
        result = await client.embed(
            [text[:8000]],
            model=EMBEDDING_MODEL,
            input_type="query",
        )
        return result.embeddings[0]
    except Exception as e:
        logger.error("Embedding generation failed: %s", e)
        return None


async def generate_grant_embedding(
    title: str,
    summary: str | None,
    category: str | None,
    organization: str | None,
) -> list[float] | None:
    """Generate embedding for a grant project combining key fields."""
    parts = [title]
    if summary:
        parts.append(summary)
    if category:
        parts.append(f"카테고리: {category}")
    if organization:
        parts.append(f"기관: {organization}")
    text = " ".join(parts)
    if not settings.voyage_api_key:
        return None
    try:
        client = _get_client()
        result = await client.embed(
            [text[:8000]],
            model=EMBEDDING_MODEL,
            input_type="document",
        )
        return result.embeddings[0]
    except Exception as e:
        logger.error("Grant embedding generation failed: %s", e)
        return None


async def generate_profile_embedding(
    industry: str | None,
    region: str | None,
    company_age: int | None,
    revenue_range: str | None,
) -> list[float] | None:
    """Generate embedding for a user profile for matching."""
    parts = []
    if industry:
        parts.append(f"업종: {industry}")
    if region:
        parts.append(f"지역: {region}")
    if company_age is not None:
        parts.append(f"업력: {company_age}년")
    if revenue_range:
        parts.append(f"매출: {revenue_range}")
    if not parts:
        return None
    if not settings.voyage_api_key:
        return None
    try:
        client = _get_client()
        result = await client.embed(
            [" ".join(parts)],
            model=EMBEDDING_MODEL,
            input_type="document",
        )
        return result.embeddings[0]
    except Exception as e:
        logger.error("Profile embedding generation failed: %s", e)
        return None
