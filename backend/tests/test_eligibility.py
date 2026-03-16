import pytest
from app.services.eligibility import compute_eligibility, EligibilityResult, CheckItem

USER_PROFILE = {
    "company_age": 4,
    "industry": "IT/소프트웨어",
    "region": "서울",
    "employee_count": 15,
    "revenue_range": "5억~10억",
}

PARSED_HIGH = {
    "max_company_age_years": 7,
    "min_company_age_years": None,
    "allowed_industries": ["AI", "소프트웨어", "IT"],
    "allowed_regions": ["서울", "경기"],
    "max_revenue_krw": 3000000000,
    "target_age_range": None,
    "employee_count_max": 50,
    "parse_confidence": "high",
}

PARSED_FAIL_AGE = {
    "max_company_age_years": 3,
    "min_company_age_years": None,
    "allowed_industries": ["AI"],
    "allowed_regions": ["서울"],
    "max_revenue_krw": None,
    "target_age_range": None,
    "employee_count_max": None,
    "parse_confidence": "high",
}

PARSED_EMPTY = {
    "max_company_age_years": None,
    "min_company_age_years": None,
    "allowed_industries": [],
    "allowed_regions": [],
    "max_revenue_krw": None,
    "target_age_range": None,
    "employee_count_max": None,
    "parse_confidence": "low",
}


def test_perfect_match():
    result = compute_eligibility(USER_PROFILE, PARSED_HIGH)
    assert result.score is not None
    assert result.score >= 80
    assert result.confidence == "high"
    passed = [c for c in result.checklist if c.status == "pass"]
    assert len(passed) >= 3


def test_age_fail():
    result = compute_eligibility(USER_PROFILE, PARSED_FAIL_AGE)
    failed = [c for c in result.checklist if c.status == "fail"]
    assert any("업력" in c.message for c in failed)
    assert result.score is not None
    assert result.score < 60


def test_no_requirements_returns_none_score():
    result = compute_eligibility(USER_PROFILE, PARSED_EMPTY)
    assert result.confidence == "low"
    # No checkable items → score is None
    assert result.score is None


def test_empty_profile():
    empty_profile = {
        "company_age": None,
        "industry": None,
        "region": None,
        "employee_count": None,
        "revenue_range": None,
    }
    result = compute_eligibility(empty_profile, PARSED_HIGH)
    unknowns = [c for c in result.checklist if c.status == "unknown"]
    assert len(unknowns) >= 3


def test_deterministic():
    r1 = compute_eligibility(USER_PROFILE, PARSED_HIGH)
    r2 = compute_eligibility(USER_PROFILE, PARSED_HIGH)
    assert r1.score == r2.score
    assert [c.status for c in r1.checklist] == [c.status for c in r2.checklist]
