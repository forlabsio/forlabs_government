from __future__ import annotations
# backend/app/embedding.py
import logging

from openai import AsyncOpenAI

from app.config import settings

logger = logging.getLogger(__name__)

client = AsyncOpenAI(api_key=settings.openai_api_key)

EMBEDDING_MODEL = "text-embedding-3-small"


async def generate_embedding(text: str) -> list[float] | None:
    """Generate embedding vector for given text using OpenAI."""
    if not settings.openai_api_key:
        logger.warning("OpenAI API key not set, skipping embedding")
        return None
    try:
        response = await client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=text[:8000],  # Truncate to avoid token limit
        )
        return response.data[0].embedding
    except Exception as e:
        logger.error(f"Embedding generation failed: {e}")
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
    return await generate_embedding(text)


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
    text = " ".join(parts)
    return await generate_embedding(text)
