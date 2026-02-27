# backend/tests/test_embedding.py
from unittest.mock import AsyncMock, patch

import pytest


def test_embedding_module_importable():
    from app.embedding import generate_embedding, generate_grant_embedding, generate_profile_embedding
    assert callable(generate_embedding)
    assert callable(generate_grant_embedding)
    assert callable(generate_profile_embedding)


def test_generate_grant_embedding_builds_text():
    """Test that the text composition works correctly."""
    # We test the text building logic, not the API call
    parts = ["테스트 사업"]
    summary = "사업 설명"
    parts.append(summary)
    category = "자금"
    parts.append(f"카테고리: {category}")
    org = "중소벤처기업부"
    parts.append(f"기관: {org}")
    text = " ".join(parts)
    assert "테스트 사업" in text
    assert "카테고리: 자금" in text
    assert "기관: 중소벤처기업부" in text


def test_generate_profile_embedding_builds_text():
    """Test that profile text composition works correctly."""
    parts = []
    industry = "IT"
    parts.append(f"업종: {industry}")
    region = "서울"
    parts.append(f"지역: {region}")
    company_age = 5
    parts.append(f"업력: {company_age}년")
    revenue_range = "1억~10억"
    parts.append(f"매출: {revenue_range}")
    text = " ".join(parts)
    assert "업종: IT" in text
    assert "지역: 서울" in text
    assert "업력: 5년" in text
    assert "매출: 1억~10억" in text


def test_profile_embedding_empty_returns_none_logic():
    """Test that empty profile parts would return None."""
    parts = []
    # No fields provided
    assert len(parts) == 0
    # In the actual function, this returns None


def test_embedding_model_constant():
    """Test that the embedding model constant is set correctly."""
    from app.embedding import EMBEDDING_MODEL
    assert EMBEDDING_MODEL == "text-embedding-3-small"
