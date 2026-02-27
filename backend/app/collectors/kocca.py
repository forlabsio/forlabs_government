# backend/app/collectors/kocca.py
import httpx

from app.collectors.base import BaseCollector
from app.config import settings


class KoccaCollector(BaseCollector):
    source_name = "kocca"

    async def fetch_raw(self) -> list[dict]:
        url = "https://apis.data.go.kr/B553035/koccaSupportBizAnncApi/list"
        params = {
            "serviceKey": settings.kocca_api_key,
            "type": "json",
            "numOfRows": 100,
            "pageNo": 1,
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
        # 공공데이터포털 convention: response > body > items > item
        body = data.get("response", {}).get("body", {})
        items = body.get("items", {})
        item_list = items.get("item", [])
        if isinstance(item_list, dict):
            item_list = [item_list]
        return item_list

    def normalize(self, raw: dict) -> dict:
        return {
            "title": raw.get("bizNm", ""),
            "summary": raw.get("bizCn", raw.get("bizDesc", "")),
            "category": self._map_category(raw.get("bizTypNm", "")),
            "amount_min": None,
            "amount_max": self._parse_amount(raw.get("sprtAmt")),
            "target_industry": (
                [raw.get("indstNm", "")] if raw.get("indstNm") else ["콘텐츠"]
            ),
            "target_region": [raw.get("areaNm", "")] if raw.get("areaNm") else [],
            "target_age": None,
            "start_date": self._parse_date(raw.get("rcptBgnDt")),
            "end_date": self._parse_date(raw.get("rcptEndDt")),
            "status": self._map_status(raw.get("anncSttus", "")),
            "organization": raw.get("anncInsttNm", "한국콘텐츠진흥원"),
            "detail_url": raw.get("dtlPageUrl", ""),
            "source_id": raw.get("anncId", raw.get("bizAnncSn", "")),
        }

    @staticmethod
    def _map_category(biz_type: str) -> str:
        mapping = {
            "자금": "자금",
            "기술": "R&D",
            "인력": "인력",
            "수출": "수출",
            "창업": "창업",
            "콘텐츠": "콘텐츠",
        }
        for key, val in mapping.items():
            if key in biz_type:
                return val
        return "콘텐츠"

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
        if "접수" in status:
            return "접수중"
        if "마감" in status or "종료" in status:
            return "마감"
        if "공고" in status:
            return "공고중"
        return status or "공고중"
