# backend/app/collectors/smes.py
import httpx

from app.collectors.base import BaseCollector
from app.config import settings


class SmesCollector(BaseCollector):
    source_name = "smes"

    async def fetch_raw(self) -> list[dict]:
        url = "https://apis.data.go.kr/B553080/smesAnnounceInfoService/getSmesAnnounceList"
        params = {
            "serviceKey": settings.smes_api_key,
            "type": "json",
            "numOfRows": 100,
            "pageNo": 1,
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
        body = data.get("response", {}).get("body", {})
        items = body.get("items", {})
        item_list = items.get("item", [])
        if isinstance(item_list, dict):
            item_list = [item_list]
        return item_list

    def normalize(self, raw: dict) -> dict:
        return {
            "title": raw.get("pblancNm", ""),
            "summary": raw.get("bsnsSumryCn", raw.get("pblancCn", "")),
            "category": self._map_category(raw.get("bizClsfNm", "")),
            "amount_min": self._parse_amount(raw.get("sprtAmtMin")),
            "amount_max": self._parse_amount(raw.get("sprtAmtMax")),
            "target_industry": [raw.get("indstNm", "")] if raw.get("indstNm") else [],
            "target_region": [raw.get("areaNm", "")] if raw.get("areaNm") else [],
            "target_age": None,
            "start_date": self._parse_date(raw.get("rcptBgnde")),
            "end_date": self._parse_date(raw.get("rcptEndde")),
            "status": self._map_status(raw.get("anncSttusNm", "")),
            "organization": raw.get("excInsttNm", "중소벤처기업부"),
            "detail_url": raw.get("dtlPageUrl", ""),
            "source_id": raw.get("pblancId", raw.get("anncSn", "")),
        }

    @staticmethod
    def _map_category(biz_cls: str) -> str:
        mapping = {
            "자금": "자금",
            "기술": "R&D",
            "인력": "인력",
            "수출": "수출",
            "내수": "내수",
            "창업": "창업",
            "경영": "경영",
        }
        for key, val in mapping.items():
            if key in biz_cls:
                return val
        return "기타"

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
