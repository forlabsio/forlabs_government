import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.requirement_parser import parse_requirements

SAMPLE_SUMMARY = """
본 사업은 서울 소재 창업 후 7년 이내 중소기업(직원 50인 미만)을 대상으로
AI·소프트웨어 분야 기술 개발을 지원합니다. 연매출 30억 미만 기업에 한함.
최대 5,000만원 지원.
"""

MOCK_JSON = '{"max_company_age_years": 7, "min_company_age_years": null, "allowed_industries": ["AI", "소프트웨어"], "allowed_regions": ["서울"], "max_revenue_krw": 3000000000, "target_age_range": null, "employee_count_max": 50, "parse_confidence": "high"}'


@pytest.mark.asyncio
async def test_parse_requirements_returns_dict():
    with patch("app.services.requirement_parser.settings") as mock_settings, \
         patch("app.services.requirement_parser.anthropic.AsyncAnthropic") as mock_class:
        mock_settings.anthropic_api_key = "test-api-key"
        mock_client = AsyncMock()
        mock_class.return_value = mock_client
        mock_msg = MagicMock()
        mock_msg.content = [MagicMock(text=MOCK_JSON)]
        mock_client.messages.create = AsyncMock(return_value=mock_msg)

        result = await parse_requirements(SAMPLE_SUMMARY)

        assert result is not None
        assert isinstance(result, dict)
        assert result.get("parse_confidence") == "high"


@pytest.mark.asyncio
async def test_parse_requirements_empty_summary():
    result = await parse_requirements("")
    assert result is None


@pytest.mark.asyncio
async def test_parse_requirements_short_summary():
    result = await parse_requirements("짧은 텍스트")
    assert result is None
