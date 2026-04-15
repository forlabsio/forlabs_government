"""
Rule-based eligibility scoring: user profile vs parsed_requirements.

Design: 100% deterministic, no API calls, runs from DB data only.
Score = passed_checks / (passed_checks + failed_checks) * 100
Unknown checks (missing data on either side) excluded from denominator.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Literal

logger = logging.getLogger(__name__)


METROPOLITAN_REGIONS: set[str] = {"서울", "경기", "인천"}

REVENUE_UPPER_BOUNDS: dict[str, int] = {
    "1억 미만":   100_000_000,
    "1억~5억":    500_000_000,
    "5억~10억":   1_000_000_000,
    "10억~50억":  5_000_000_000,
    "50억~100억": 10_000_000_000,
    "100억 이상": 999_999_999_999,
}

def _to_int(v) -> int | None:
    """Safely coerce parsed_requirements values to int.
    Claude sometimes returns {"value": 30} or "30명" instead of bare int.
    """
    if v is None:
        return None
    if isinstance(v, int):
        return v
    if isinstance(v, float):
        return int(v)
    if isinstance(v, dict):
        for key in ("value", "max", "count", "number"):
            if key in v and isinstance(v[key], (int, float)):
                return int(v[key])
        return None
    if isinstance(v, str):
        m = re.search(r"\d+", v)
        if not m:
            logger.debug("_to_int: no digits found in %r — treating as no restriction", v)
        return int(m.group()) if m else None
    return None


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
        if not allowed_item:
            continue
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
                  employee_count (int), revenue_krw (int), certifications (list[str])
    """
    checklist: list[CheckItem] = []

    # Sanitize list fields upfront — Claude API sometimes returns [None, "value"] or non-string types
    def _clean_list(key: str) -> list[str]:
        raw = parsed_requirements.get(key) or []
        if isinstance(raw, str):
            return [raw] if raw else []
        return [x for x in raw if isinstance(x, str) and x]

    # 1. Company age check
    user_age = _to_int(profile.get("company_age"))
    max_age = _to_int(parsed_requirements.get("max_company_age_years"))
    min_age = _to_int(parsed_requirements.get("min_company_age_years"))

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
    allowed_industries = _clean_list("allowed_industries")

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
    allowed_regions = _clean_list("allowed_regions")

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
    user_emp = _to_int(profile.get("employee_count"))
    max_emp = _to_int(parsed_requirements.get("employee_count_max"))

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

    # 5. Revenue check (max)
    user_rev_krw = _to_int(profile.get("revenue_krw"))
    # fallback: revenue_range string → upper bound
    if user_rev_krw is None:
        user_rev_range = profile.get("revenue_range")
        if user_rev_range and user_rev_range in REVENUE_UPPER_BOUNDS:
            user_rev_krw = REVENUE_UPPER_BOUNDS[user_rev_range]
    max_rev = _to_int(parsed_requirements.get("max_revenue_krw"))

    def _fmt_krw(v: int) -> str:
        return f"{v // 100_000_000}억" if v >= 100_000_000 else f"{v // 10_000}만"

    if max_rev is not None:
        if user_rev_krw is not None:
            rev_ok = user_rev_krw <= max_rev
            checklist.append(CheckItem(
                field="revenue",
                status="pass" if rev_ok else "fail",
                message=f"매출 {_fmt_krw(user_rev_krw)} {'≤' if rev_ok else '>'} 요건 {_fmt_krw(max_rev)}",
            ))
        else:
            checklist.append(CheckItem(
                field="revenue",
                status="unknown",
                message="매출 미입력 → 공고문 확인 필요",
            ))

    # 6. Excluded industry check
    user_industry2 = profile.get("industry")
    excluded_industries = _clean_list("excluded_industries")

    if excluded_industries and user_industry2:
        is_excluded = _industry_matches(user_industry2, excluded_industries)
        if is_excluded:
            checklist.append(CheckItem(
                field="excluded_industry",
                status="fail",
                message=f"업종 {user_industry2} → 지원 제외 업종 ({', '.join(excluded_industries[:3])})",
            ))

    # 7. Metropolitan / non-metropolitan check
    user_region2 = profile.get("region")
    metro_only = parsed_requirements.get("metropolitan_only")

    if metro_only is not None:
        if user_region2:
            is_metro = user_region2 in METROPOLITAN_REGIONS
            if metro_only is True:
                region_ok = is_metro
                checklist.append(CheckItem(
                    field="metropolitan",
                    status="pass" if region_ok else "fail",
                    message=f"{user_region2} {'수도권 ✓' if region_ok else '→ 수도권 소재 기업만 지원 가능'}",
                ))
            else:  # metro_only is False → non-metropolitan only
                region_ok = not is_metro
                checklist.append(CheckItem(
                    field="metropolitan",
                    status="pass" if region_ok else "fail",
                    message=f"{user_region2} {'비수도권 ✓' if region_ok else '→ 비수도권 기업만 지원 가능'}",
                ))
        else:
            checklist.append(CheckItem(
                field="metropolitan",
                status="unknown",
                message="소재지 미입력 → 수도권/비수도권 제한 직접 확인 필요",
            ))

    # 8. Minimum employee count check
    user_emp2 = _to_int(profile.get("employee_count"))
    min_emp = _to_int(parsed_requirements.get("employee_count_min"))

    if min_emp is not None:
        if user_emp2 is not None:
            emp_min_ok = user_emp2 >= min_emp
            checklist.append(CheckItem(
                field="employee_count_min",
                status="pass" if emp_min_ok else "fail",
                message=f"직원 {user_emp2}명 {'≥' if emp_min_ok else '<'} 최소 {min_emp}명",
            ))
        else:
            checklist.append(CheckItem(
                field="employee_count_min",
                status="unknown",
                message="직원수 미입력 → 직접 확인 필요",
            ))

    # 9. Minimum revenue check
    min_rev = _to_int(parsed_requirements.get("min_revenue_krw"))

    if min_rev is not None:
        if user_rev_krw is not None:
            min_rev_ok = user_rev_krw >= min_rev
            checklist.append(CheckItem(
                field="min_revenue",
                status="pass" if min_rev_ok else "fail",
                message=f"매출 {_fmt_krw(user_rev_krw)} {'≥' if min_rev_ok else '<'} 최소 요건 {_fmt_krw(min_rev)}",
            ))
        else:
            checklist.append(CheckItem(
                field="min_revenue",
                status="unknown",
                message="매출 미입력 → 최소 매출 요건 직접 확인 필요",
            ))

    # 10. Corporate status check
    require_corporate = parsed_requirements.get("require_corporate")

    if require_corporate is True:
        user_is_corporate = profile.get("is_corporate")
        if user_is_corporate is True:
            checklist.append(CheckItem(
                field="corporate",
                status="pass",
                message="법인 기업 ✓ (법인 필수 요건 충족)",
            ))
        elif user_is_corporate is False:
            checklist.append(CheckItem(
                field="corporate",
                status="fail",
                message="개인사업자 → 법인만 지원 가능",
            ))
        else:
            checklist.append(CheckItem(
                field="corporate",
                status="unknown",
                message="법인/개인사업자 미입력 → 직접 확인 필요",
            ))

    # 11. Venture certification check
    require_venture = parsed_requirements.get("require_venture_cert")

    if require_venture is True:
        user_is_venture = profile.get("is_venture")
        if user_is_venture is True:
            checklist.append(CheckItem(
                field="venture_cert",
                status="pass",
                message="벤처기업 인증 ✓",
            ))
        elif user_is_venture is False:
            checklist.append(CheckItem(
                field="venture_cert",
                status="fail",
                message="벤처기업 미인증 → 벤처기업 인증 필수",
            ))
        else:
            checklist.append(CheckItem(
                field="venture_cert",
                status="unknown",
                message="벤처기업 인증 여부 미입력 → 직접 확인 필요",
            ))

    # 12. Certifications check (이노비즈, 메인비즈, 여성기업 등)
    CERT_KEYWORDS = {
        "이노비즈": "이노비즈",
        "메인비즈": "메인비즈",
        "여성기업": "여성기업",
        "사회적기업": "사회적기업",
        "장애인기업": "장애인기업",
        "벤처": "벤처기업",
    }
    user_certs: list[str] = profile.get("certifications") or []
    unextracted_for_cert = _clean_list("unextracted_conditions")
    for condition in unextracted_for_cert:
        for keyword, cert_name in CERT_KEYWORDS.items():
            if keyword in condition and "필수" in condition:
                has_cert = any(keyword in c for c in user_certs)
                checklist.append(CheckItem(
                    field="certification",
                    status="pass" if has_cert else "fail" if user_certs else "unknown",
                    message=f"{cert_name} 인증 {'보유 ✓' if has_cert else '필요 (미보유)' if user_certs else '→ 직접 확인 필요'}",
                ))
                break

    # 13. Unextracted conditions (always unknown — flag for manual review)
    unextracted = _clean_list("unextracted_conditions")
    for condition in unextracted[:3]:  # cap at 3 to avoid bloat
        checklist.append(CheckItem(
            field="manual_check",
            status="unknown",
            message=f"직접 확인 필요: {condition}",
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
