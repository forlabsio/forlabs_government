# backend/tests/test_collectors.py
from datetime import date

from app.collectors.base import BaseCollector
from app.collectors.bizinfo import BizinfoCollector
from app.collectors.kocca import KoccaCollector
from app.collectors.kstartup import KstartupCollector
from app.collectors.ntis import NtisCollector
from app.collectors.smes import SmesCollector
from app.collectors.subsidy24 import Subsidy24Collector


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


def test_ntis_normalize():
    collector = NtisCollector()
    raw = {
        "projNm": "AI 기반 신약 개발 플랫폼 구축",
        "projAbstrct": "인공지능을 활용한 신약 후보물질 탐색 기술 개발",
        "sstcCodeNm": "바이오/의료",
        "govBudget": 500000000,
        "totBudget": 800000000,
        "projBeginDt": "2026-01-01",
        "projEndDt": "2026-12-31",
        "projSttusNm": "수행중",
        "rcorgNm": "한국생명공학연구원",
        "detailUrl": "https://www.ntis.go.kr/project/123",
        "projNo": "NTIS_2026_001",
    }
    result = collector.normalize(raw)
    assert result["title"] == "AI 기반 신약 개발 플랫폼 구축"
    assert result["category"] == "R&D"
    assert result["amount_min"] == 500000000
    assert result["amount_max"] == 800000000
    assert result["start_date"] == date(2026, 1, 1)
    assert result["end_date"] == date(2026, 12, 31)
    assert result["status"] == "진행중"
    assert result["organization"] == "한국생명공학연구원"
    assert result["source_id"] == "NTIS_2026_001"
    assert "바이오/의료" in result["target_industry"]


def test_ntis_normalize_minimal():
    """Test NTIS normalize with missing optional fields."""
    collector = NtisCollector()
    raw = {
        "projNm": "기초연구과제",
        "projNo": "NTIS_MIN",
    }
    result = collector.normalize(raw)
    assert result["title"] == "기초연구과제"
    assert result["source_id"] == "NTIS_MIN"
    assert result["summary"] == ""
    assert result["amount_min"] is None
    assert result["amount_max"] is None
    assert result["start_date"] is None
    assert result["end_date"] is None


def test_kocca_normalize():
    collector = KoccaCollector()
    raw = {
        "bizNm": "2026 콘텐츠 창업 지원사업",
        "bizCn": "콘텐츠 분야 초기 창업기업 지원",
        "bizTypNm": "창업지원",
        "indstNm": "게임",
        "areaNm": "서울",
        "rcptBgnDt": "2026-03-01",
        "rcptEndDt": "2026-04-15",
        "anncSttus": "접수중",
        "anncInsttNm": "한국콘텐츠진흥원",
        "dtlPageUrl": "https://www.kocca.kr/biz/123",
        "anncId": "KOCCA_2026_001",
        "sprtAmt": 50000000,
    }
    result = collector.normalize(raw)
    assert result["title"] == "2026 콘텐츠 창업 지원사업"
    assert result["summary"] == "콘텐츠 분야 초기 창업기업 지원"
    assert result["category"] == "창업"
    assert result["amount_max"] == 50000000
    assert result["start_date"] == date(2026, 3, 1)
    assert result["end_date"] == date(2026, 4, 15)
    assert result["status"] == "접수중"
    assert result["organization"] == "한국콘텐츠진흥원"
    assert result["source_id"] == "KOCCA_2026_001"
    assert "게임" in result["target_industry"]
    assert "서울" in result["target_region"]


def test_kocca_normalize_defaults():
    """Test KOCCA normalize with missing optional fields uses defaults."""
    collector = KoccaCollector()
    raw = {
        "bizNm": "콘텐츠 사업",
        "anncId": "KOCCA_MIN",
    }
    result = collector.normalize(raw)
    assert result["title"] == "콘텐츠 사업"
    assert result["source_id"] == "KOCCA_MIN"
    assert result["organization"] == "한국콘텐츠진흥원"
    assert result["target_industry"] == ["콘텐츠"]
    assert result["category"] == "콘텐츠"


def test_kstartup_normalize():
    collector = KstartupCollector()
    raw = {
        "pblancNm": "2026 예비창업패키지",
        "bsnsSumryCn": "예비창업자 사업화 자금 및 멘토링 지원",
        "bizClsfNm": "창업사업화",
        "areaNm": "전국",
        "rcptBgnde": "2026-02-15",
        "rcptEndde": "2026-03-20",
        "pblancSttusNm": "접수중",
        "excInsttNm": "창업진흥원",
        "dtlPageUrl": "https://www.k-startup.go.kr/biz/456",
        "pblancId": "KS_2026_001",
        "sprtAmt": 100000000,
    }
    result = collector.normalize(raw)
    assert result["title"] == "2026 예비창업패키지"
    assert result["summary"] == "예비창업자 사업화 자금 및 멘토링 지원"
    assert result["category"] == "창업"
    assert result["amount_max"] == 100000000
    assert result["start_date"] == date(2026, 2, 15)
    assert result["end_date"] == date(2026, 3, 20)
    assert result["status"] == "접수중"
    assert result["organization"] == "창업진흥원"
    assert result["source_id"] == "KS_2026_001"
    assert "전국" in result["target_region"]


def test_kstartup_normalize_fallback_fields():
    """Test K-Startup normalize with fallback fields."""
    collector = KstartupCollector()
    raw = {
        "pblancNm": "멘토링 프로그램",
        "pblancCn": "창업 멘토링",
        "bizClsfNm": "멘토링",
        "anncId": "KS_FALL",
    }
    result = collector.normalize(raw)
    assert result["title"] == "멘토링 프로그램"
    assert result["summary"] == "창업 멘토링"
    assert result["category"] == "창업"
    assert result["source_id"] == "KS_FALL"
    assert result["organization"] == "K-Startup"


def test_subsidy24_normalize():
    collector = Subsidy24Collector()
    raw = {
        "servNm": "청년 월세 지원",
        "servDgst": "청년층 주거비 부담 완화를 위한 월세 지원",
        "svcClNm": "주거-임대",
        "ctpvNm": "서울특별시",
        "trgterIndvdlAgeLo": "19",
        "trgterIndvdlAgeHi": "34",
        "aplyBgnDt": "2026-01-01",
        "aplyEndDt": "2026-12-31",
        "svcSttusNm": "접수중",
        "jurMnofNm": "국토교통부",
        "servDtlLink": "https://www.gov.kr/subsidy/789",
        "servId": "SUB24_2026_001",
    }
    result = collector.normalize(raw)
    assert result["title"] == "청년 월세 지원"
    assert result["summary"] == "청년층 주거비 부담 완화를 위한 월세 지원"
    assert result["category"] == "주거"
    assert result["target_age"] == "19세 이상 ~ 34세 이하"
    assert result["start_date"] == date(2026, 1, 1)
    assert result["end_date"] == date(2026, 12, 31)
    assert result["status"] == "접수중"
    assert result["organization"] == "국토교통부"
    assert result["source_id"] == "SUB24_2026_001"
    assert "서울특별시" in result["target_region"]


def test_subsidy24_normalize_no_age():
    """Test Subsidy24 normalize without age fields."""
    collector = Subsidy24Collector()
    raw = {
        "servNm": "교육 바우처",
        "svcClNm": "교육",
        "servId": "SUB24_MIN",
    }
    result = collector.normalize(raw)
    assert result["title"] == "교육 바우처"
    assert result["source_id"] == "SUB24_MIN"
    assert result["category"] == "교육"
    assert result["target_age"] is None
    assert result["target_region"] == []


def test_smes_normalize():
    collector = SmesCollector()
    raw = {
        "pblancNm": "2026 중소기업 수출 지원사업",
        "bsnsSumryCn": "중소기업의 해외시장 진출 지원",
        "bizClsfNm": "수출지원",
        "indstNm": "제조업",
        "areaNm": "경기",
        "rcptBgnde": "2026-03-01",
        "rcptEndde": "2026-04-30",
        "anncSttusNm": "공고중",
        "excInsttNm": "중소벤처기업부",
        "dtlPageUrl": "https://www.smes.go.kr/notice/321",
        "pblancId": "SMES_2026_001",
        "sprtAmtMin": 10000000,
        "sprtAmtMax": 100000000,
    }
    result = collector.normalize(raw)
    assert result["title"] == "2026 중소기업 수출 지원사업"
    assert result["summary"] == "중소기업의 해외시장 진출 지원"
    assert result["category"] == "수출"
    assert result["amount_min"] == 10000000
    assert result["amount_max"] == 100000000
    assert result["start_date"] == date(2026, 3, 1)
    assert result["end_date"] == date(2026, 4, 30)
    assert result["status"] == "공고중"
    assert result["organization"] == "중소벤처기업부"
    assert result["source_id"] == "SMES_2026_001"
    assert "제조업" in result["target_industry"]
    assert "경기" in result["target_region"]


def test_smes_normalize_minimal():
    """Test SMES normalize with minimal fields."""
    collector = SmesCollector()
    raw = {
        "pblancNm": "기본 공고",
        "pblancId": "SMES_MIN",
    }
    result = collector.normalize(raw)
    assert result["title"] == "기본 공고"
    assert result["source_id"] == "SMES_MIN"
    assert result["organization"] == "중소벤처기업부"
    assert result["amount_min"] is None
    assert result["amount_max"] is None
    assert result["category"] == "기타"


def test_registry_has_all_collectors():
    """Test that the registry contains all 6 collectors."""
    from app.collectors.registry import ALL_COLLECTORS

    assert len(ALL_COLLECTORS) == 6
    source_names = [c.source_name for c in ALL_COLLECTORS]
    assert "bizinfo" in source_names
    assert "ntis" in source_names
    assert "kocca" in source_names
    assert "kstartup" in source_names
    assert "subsidy24" in source_names
    assert "smes" in source_names


def test_all_collectors_are_base_collector_instances():
    """Test that all registry collectors are BaseCollector subclasses."""
    from app.collectors.registry import ALL_COLLECTORS

    for collector in ALL_COLLECTORS:
        assert isinstance(collector, BaseCollector)
        assert hasattr(collector, "source_name")
        assert hasattr(collector, "fetch_raw")
        assert hasattr(collector, "normalize")
