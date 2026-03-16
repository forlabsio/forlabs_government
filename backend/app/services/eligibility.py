"""
Rule-based eligibility scoring: user profile vs parsed_requirements.

Design: 100% deterministic, no API calls, runs from DB data only.
Score = passed_checks / (passed_checks + failed_checks) * 100
Unknown checks (missing data on either side) excluded from denominator.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal


REVENUE_UPPER_BOUNDS: dict[str, int] = {
    "1억 미만":   100_000_000,
    "1억~5억":    500_000_000,
    "5억~10억":   1_000_000_000,
    "10억~50억":  5_000_000_000,
    "50억~100억": 10_000_000_000,
    "100억 이상": 999_999_999_999,
}

INDUSTRY_ALIASES: dict[str, list[str]] = {
    "IT/소프트웨어": ["IT", "소프트웨어", "AI", "정보통신", "ICT", "SW"],
    "바이오/의료":   ["바이오", "의료", "헬스케어", "제약", "바이오헬스"],
    "문화/콘텐츠":  ["문화", "콘텐츠", "엔터테인먼트", "게임", "미디어"],
    "에너지/환경":  ["에너지", "환경", "그린", "신재생"],
    "제조업":       ["제조", "하드웨어", "공정"],
    "농업/식품":    ["농업", "식품", "푸드테크", "농촌"],
}


@dataclass
class CheckItem:
    field: str
    status: Literal["pass", "fail", "unknown"]
    message: str


@dataclass
class EligibilityResult:
    score: float | None
    confidence: Literal["high", "medium", "low"]
    checklist: list[CheckItem] = field(default_factory=list)


def _industry_matches(user_industry: str, allowed: list[str]) -> bool:
    if not user_industry or not allowed:
        return False
    user_lower = user_industry.lower()
    aliases = INDUSTRY_ALIASES.get(user_industry, [user_industry])
    for allowed_item in allowed:
        allowed_lower = allowed_item.lower()
        if allowed_lower in user_lower or user_lower in allowed_lower:
            return True
        for alias in aliases:
            if alias.lower() in allowed_lower or allowed_lower in alias.lower():
                return True
    return False


def compute_eligibility(
    profile: dict,
    parsed_requirements: dict,
) -> EligibilityResult:
    """
    Compare user profile against parsed grant requirements.

    profile keys: company_age (int), industry (str), region (str),
                  employee_count (int), revenue_range (str)
    """
    checklist: list[CheckItem] = []

    # 1. Company age check
    user_age = profile.get("company_age")
    max_age = parsed_requirements.get("max_company_age_years")
    min_age = parsed_requirements.get("min_company_age_years")

    if user_age is not None and (max_age is not None or min_age is not None):
        age_ok = True
        msg_parts = []
        if max_age is not None:
            if user_age > max_age:
                age_ok = False
                msg_parts.append(f"업력 {user_age}년 > 최대 {max_age}년")
            else:
                msg_parts.append(f"업력 {user_age}년 ≤ 최대 {max_age}년")
        if min_age is not None:
            if user_age < min_age:
                age_ok = False
                msg_parts.append(f"업력 {user_age}년 < 최소 {min_age}년")
        checklist.append(CheckItem(
            field="company_age",
            status="pass" if age_ok else "fail",
            message=" / ".join(msg_parts) or f"업력 {user_age}년",
        ))
    elif max_age is not None or min_age is not None:
        checklist.append(CheckItem(
            field="company_age",
            status="unknown",
            message="업력 미입력 → 직접 확인 필요",
        ))

    # 2. Industry check
    user_industry = profile.get("industry")
    allowed_industries = parsed_requirements.get("allowed_industries") or []

    if allowed_industries:
        if user_industry:
            matches = _industry_matches(user_industry, allowed_industries)
            checklist.append(CheckItem(
                field="industry",
                status="pass" if matches else "fail",
                message=f"업종 {user_industry} {'일치' if matches else '불일치'} (요건: {', '.join(allowed_industries[:3])})",
            ))
        else:
            checklist.append(CheckItem(
                field="industry",
                status="unknown",
                message="업종 미입력 → 직접 확인 필요",
            ))

    # 3. Region check
    user_region = profile.get("region")
    allowed_regions = parsed_requirements.get("allowed_regions") or []

    if allowed_regions:
        if user_region:
            region_ok = (
                user_region == "전국"
                or any(r in user_region or user_region in r for r in allowed_regions)
            )
            checklist.append(CheckItem(
                field="region",
                status="pass" if region_ok else "fail",
                message=f"지역 {user_region} {'충족' if region_ok else '불충족'} (요건: {', '.join(allowed_regions[:3])})",
            ))
        else:
            checklist.append(CheckItem(
                field="region",
                status="unknown",
                message="소재지 미입력 → 직접 확인 필요",
            ))

    # 4. Employee count check
    user_emp = profile.get("employee_count")
    max_emp = parsed_requirements.get("employee_count_max")

    if max_emp is not None:
        if user_emp is not None:
            emp_ok = user_emp <= max_emp
            checklist.append(CheckItem(
                field="employee_count",
                status="pass" if emp_ok else "fail",
                message=f"직원 {user_emp}명 {'≤' if emp_ok else '>'} 최대 {max_emp}명",
            ))
        else:
            checklist.append(CheckItem(
                field="employee_count",
                status="unknown",
                message="직원수 미입력 → 직접 확인 필요",
            ))

    # 5. Revenue check
    user_rev_range = profile.get("revenue_range")
    max_rev = parsed_requirements.get("max_revenue_krw")

    if max_rev is not None:
        if user_rev_range and user_rev_range in REVENUE_UPPER_BOUNDS:
            user_upper = REVENUE_UPPER_BOUNDS[user_rev_range]
            rev_ok = user_upper <= max_rev
            def fmt(v: int) -> str:
                return f"{v // 100_000_000}억" if v >= 100_000_000 else f"{v // 10_000}만"
            checklist.append(CheckItem(
                field="revenue",
                status="pass" if rev_ok else "fail",
                message=f"매출 상한 {fmt(user_upper)} {'≤' if rev_ok else '>'} 요건 {fmt(max_rev)}",
            ))
        else:
            checklist.append(CheckItem(
                field="revenue",
                status="unknown",
                message="매출 미입력 → 공고문 확인 필요",
            ))

    # Score calculation
    # Failed checks are weighted 2x to make disqualifying failures more impactful.
    passed = sum(1 for c in checklist if c.status == "pass")
    failed = sum(1 for c in checklist if c.status == "fail")
    # Weight: each fail counts as 2 toward the denominator
    weighted_denominator = passed + failed * 2

    confidence = parsed_requirements.get("parse_confidence", "low")

    if weighted_denominator == 0:
        return EligibilityResult(score=None, confidence=confidence, checklist=checklist)

    score = round(passed / weighted_denominator * 100)
    return EligibilityResult(score=score, confidence=confidence, checklist=checklist)
