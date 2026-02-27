# backend/app/collectors/smes.py
import logging
from datetime import date, datetime, timedelta

import httpx

from app.collectors.base import BaseCollector
from app.config import settings

logger = logging.getLogger(__name__)

# 중소벤처24 자체 API (smes.go.kr)
# token must be passed URL-encoded; we build the URL manually to avoid double-encoding.
BASE_URL = "https://www.smes.go.kr/fnct/apiReqst/extPblancInfo"
# Fetch last 90 days of announcements per run to capture new + updated items
FETCH_DAYS = 90


class SmesCollector(BaseCollector):
    source_name = "smes"

    async def fetch_raw(self) -> list[dict]:
        token = settings.smes_api_key
        if not token:
            logger.warning("SMES: no API key configured, skipping")
            return []

        end_dt = date.today().strftime("%Y%m%d")
        start_dt = (date.today() - timedelta(days=FETCH_DAYS)).strftime("%Y%m%d")

        # Build URL manually because the token is already URL-encoded
        url = f"{BASE_URL}?token={token}&strDt={start_dt}&endDt={end_dt}&html=no"

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()

        result_cd = data.get("resultCd")
        if result_cd != "0":
            logger.error("SMES API error: resultCd=%s", result_cd)
            return []

        items = data.get("data", [])
        logger.info("SMES: fetched %d announcements (last %d days)", len(items), FETCH_DAYS)
        return items

    def normalize(self, raw: dict) -> dict:
        # Region
        area = raw.get("areaNm", "")
        regions = [area] if area else []

        # Industry from bizType or induty
        industry = raw.get("bizType", "")
        industries = [industry] if industry else []

        # Amount
        amount_min = self._parse_amount(raw.get("minSportAmt"))
        amount_max = self._parse_amount(raw.get("maxSportAmt"))

        # Target age
        age_parts = []
        min_age = raw.get("minRpsntAge")
        max_age = raw.get("maxRpsntAge")
        if min_age:
            age_parts.append(f"만 {min_age}세 이상")
        if max_age:
            age_parts.append(f"만 {max_age}세 이하")
        target_age = " ~ ".join(age_parts) if age_parts else None

        # Summary: combine policy contents + support target + support contents
        summary_parts = []
        if raw.get("policyCnts"):
            summary_parts.append(raw["policyCnts"])
        if raw.get("sportTrget"):
            summary_parts.append(f"[대상] {raw['sportTrget']}")
        if raw.get("sportCnts"):
            summary_parts.append(f"[지원내용] {raw['sportCnts']}")
        summary = " ".join(summary_parts)

        # Status from dates
        status = self._determine_status(raw.get("pblancBgnDt"), raw.get("pblancEndDt"))

        # Detail URL
        detail_url = raw.get("pblancDtlUrl") or raw.get("reqstLinkInfo") or ""

        # Organization
        org = raw.get("sportInsttNm") or "중소벤처24"

        return {
            "title": raw.get("pblancNm", ""),
            "summary": summary[:2000] if summary else "",
            "category": self._map_category(raw.get("bizType", ""), raw.get("sportType", "")),
            "amount_min": amount_min,
            "amount_max": amount_max,
            "target_industry": industries,
            "target_region": regions,
            "target_age": target_age,
            "start_date": self._parse_date(raw.get("pblancBgnDt")),
            "end_date": self._parse_date(raw.get("pblancEndDt")),
            "status": status,
            "organization": org,
            "detail_url": detail_url,
            "source_id": str(raw.get("pblancSeq", "")),
        }

    @staticmethod
    def _map_category(biz_type: str, sport_type: str) -> str:
        combined = f"{biz_type} {sport_type}"
        mapping = {
            "자금": "자금",
            "금융": "자금",
            "융자": "자금",
            "기술": "R&D",
            "인력": "인력",
            "수출": "수출",
            "내수": "내수",
            "창업": "창업",
            "경영": "경영",
            "소상공인": "소상공인",
            "중견": "경영",
        }
        for key, val in mapping.items():
            if key in combined:
                return val
        return "기타"

    @staticmethod
    def _parse_amount(value) -> int | None:
        if not value:
            return None
        try:
            return int(float(str(value).replace(",", "")))
        except (ValueError, TypeError):
            return None

    @staticmethod
    def _parse_date(date_str: str | None):
        if not date_str:
            return None
        try:
            # Format: "YYYY-MM-DD" or "YYYYMMDD"
            clean = date_str.replace("-", "").replace(".", "").replace("/", "")[:8]
            if len(clean) < 8:
                return None
            return date(int(clean[:4]), int(clean[4:6]), int(clean[6:8]))
        except (ValueError, IndexError):
            return None

    @staticmethod
    def _determine_status(start_str: str | None, end_str: str | None) -> str:
        today = date.today()
        try:
            if end_str:
                end = datetime.strptime(end_str[:10], "%Y-%m-%d").date()
                if end < today:
                    return "마감"
            if start_str:
                start = datetime.strptime(start_str[:10], "%Y-%m-%d").date()
                if start > today:
                    return "공고중"
            return "접수중"
        except (ValueError, TypeError):
            return "접수중"
