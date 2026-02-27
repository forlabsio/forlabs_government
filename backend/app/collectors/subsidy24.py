# backend/app/collectors/subsidy24.py
import httpx

from app.collectors.base import BaseCollector
from app.config import settings


class Subsidy24Collector(BaseCollector):
    source_name = "subsidy24"

    async def fetch_raw(self) -> list[dict]:
        url = "https://apis.data.go.kr/1741000/publicServSVC/getPublicServSVCList"
        params = {
            "serviceKey": settings.subsidy24_api_key,
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
            "title": raw.get("servNm", ""),
            "summary": raw.get("servDgst", raw.get("servDtlLink", "")),
            "category": self._map_category(raw.get("svcClNm", "")),
            "amount_min": None,
            "amount_max": None,
            "target_industry": [],
            "target_region": [raw.get("ctpvNm", "")] if raw.get("ctpvNm") else [],
            "target_age": self._parse_target_age(raw),
            "start_date": self._parse_date(raw.get("aplyBgnDt")),
            "end_date": self._parse_date(raw.get("aplyEndDt")),
            "status": self._map_status(raw.get("svcSttusNm", "")),
            "organization": raw.get("jurMnofNm", raw.get("jurOrgNm", "")),
            "detail_url": raw.get("servDtlLink", ""),
            "source_id": raw.get("servId", ""),
        }

    @staticmethod
    def _map_category(svc_cls: str) -> str:
        mapping = {
            "생활안정": "생활안정",
            "주거": "주거",
            "교육": "교육",
            "고용": "고용",
            "건강": "건강",
            "문화": "문화",
            "농림축산어업": "농림",
        }
        for key, val in mapping.items():
            if key in svc_cls:
                return val
        return "기타"

    @staticmethod
    def _parse_target_age(raw: dict) -> str | None:
        age_parts = []
        if raw.get("trgterIndvdlAgeLo"):
            age_parts.append(f"{raw['trgterIndvdlAgeLo']}세 이상")
        if raw.get("trgterIndvdlAgeHi"):
            age_parts.append(f"{raw['trgterIndvdlAgeHi']}세 이하")
        return " ~ ".join(age_parts) if age_parts else None

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
        if "접수" in status or "신청" in status:
            return "접수중"
        if "마감" in status or "종료" in status:
            return "마감"
        if "진행" in status:
            return "진행중"
        return status or "진행중"
