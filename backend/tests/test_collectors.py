# backend/tests/test_collectors.py
from datetime import date

from app.collectors.base import BaseCollector
from app.collectors.bizinfo import BizinfoCollector


def test_dedup_hash_consistent():
    h1 = BaseCollector.make_dedup_hash("사업A", "기관B", "2026-03-01")
    h2 = BaseCollector.make_dedup_hash("사업A", "기관B", "2026-03-01")
    h3 = BaseCollector.make_dedup_hash("사업A", "기관C", "2026-03-01")
    assert h1 == h2
    assert h1 != h3


def test_bizinfo_normalize():
    collector = BizinfoCollector()
    raw = {
        "pblancNm": "2026 스마트 제조 지원사업",
        "bsnsSumryCn": "중소기업 스마트 공장 도입 지원",
        "pldirSportRealmLclasCodeNm": "자금",
        "jrsdInsttNm": "서울",
        "reqstBeginEndde": "2026-02-01",
        "reqstEndEndde": "2026-03-15",
        "progrmRegistSttusNm": "접수중",
        "excInsttNm": "중소벤처기업부",
        "pblancUrl": "https://example.com/123",
        "pblancId": "PBLN_123",
    }
    result = collector.normalize(raw)
    assert result["title"] == "2026 스마트 제조 지원사업"
    assert result["category"] == "자금"
    assert result["end_date"] == date(2026, 3, 15)
    assert result["source_id"] == "PBLN_123"


def test_bizinfo_parse_date_edge_cases():
    collector = BizinfoCollector()
    assert collector._parse_date(None) is None
    assert collector._parse_date("") is None
    assert collector._parse_date("20260315") == date(2026, 3, 15)
    assert collector._parse_date("2026.03.15") == date(2026, 3, 15)
