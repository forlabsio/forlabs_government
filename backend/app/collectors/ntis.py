# backend/app/collectors/ntis.py
import httpx

from app.collectors.base import BaseCollector
from app.config import settings


class NtisCollector(BaseCollector):
    source_name = "ntis"

    async def fetch_raw(self) -> list[dict]:
        url = "https://www.ntis.go.kr/rndopen/api/search/projectSearch"
        params = {
            "apiKey": settings.ntis_api_key,
            "startPage": 1,
            "displayCnt": 100,
            "sortBy": "startDate",
            "sortOrder": "desc",
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
        # NTIS returns results under "ResultData" or similar wrapper
        return data.get("ResultData", data.get("data", []))

    def normalize(self, raw: dict) -> dict:
        return {
            "title": raw.get("projNm", ""),
            "summary": raw.get("projAbstrct", ""),
            "category": self._map_category(raw.get("sstcCodeNm", "")),
            "amount_min": self._parse_amount(raw.get("govBudget")),
            "amount_max": self._parse_amount(raw.get("totBudget")),
            "target_industry": [raw.get("sstcCodeNm", "")] if raw.get("sstcCodeNm") else [],
            "target_region": [],
            "target_age": None,
            "start_date": self._parse_date(raw.get("projBeginDt")),
            "end_date": self._parse_date(raw.get("projEndDt")),
            "status": self._map_status(raw.get("projSttusNm", "")),
            "organization": raw.get("rcorgNm", ""),
            "detail_url": raw.get("detailUrl", ""),
            "source_id": raw.get("projNo", ""),
        }

    @staticmethod
    def _map_category(raw_cat: str) -> str:
        mapping = {
            "정보/통신": "R&D",
            "기계": "R&D",
            "에너지": "R&D",
            "바이오": "R&D",
            "화학": "R&D",
            "환경": "R&D",
            "소재": "R&D",
            "건설/교통": "R&D",
            "농림수산식품": "R&D",
        }
        for key, val in mapping.items():
            if key in raw_cat:
                return val
        return "R&D"

    @staticmethod
    def _parse_amount(value) -> int | None:
        if value is None:
            return None
        try:
            return int(value)
        except (ValueError, TypeError):
            return None

    @staticmethod
    def _parse_date(date_str: str | None):
        if not date_str:
            return None
        from datetime import date

        try:
            clean = date_str.replace("-", "").replace(".", "").replace("/", "")[:8]
            return date(int(clean[:4]), int(clean[4:6]), int(clean[6:8]))
        except (ValueError, IndexError):
            return None

    @staticmethod
    def _map_status(status: str) -> str:
        if "진행" in status or "수행" in status:
            return "진행중"
        if "완료" in status or "종료" in status:
            return "종료"
        return status or "진행중"
