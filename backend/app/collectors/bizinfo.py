# backend/app/collectors/bizinfo.py
import httpx

from app.collectors.base import BaseCollector
from app.config import settings


class BizinfoCollector(BaseCollector):
    source_name = "bizinfo"

    async def fetch_raw(self) -> list[dict]:
        url = "https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do"
        params = {
            "crtfcKey": settings.bizinfo_api_key,
            "dataType": "json",
            "searchCnt": 100,
            "pageUnit": 100,
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
        return data.get("jsonArray", [])

    def normalize(self, raw: dict) -> dict:
        return {
            "title": raw.get("pblancNm", ""),
            "summary": raw.get("bsnsSumryCn", ""),
            "category": self._map_category(raw.get("pldirSportRealmLclasCodeNm", "")),
            "amount_min": None,
            "amount_max": None,
            "target_industry": [],
            "target_region": [raw.get("jrsdInsttNm", "")] if raw.get("jrsdInsttNm") else [],
            "target_age": None,
            "start_date": self._parse_date(raw.get("reqstBeginEndde")),
            "end_date": self._parse_date(raw.get("reqstEndEndde")),
            "status": "접수중" if raw.get("progrmRegistSttusNm") == "접수중" else raw.get("progrmRegistSttusNm", ""),
            "organization": raw.get("excInsttNm", ""),
            "detail_url": raw.get("pblancUrl", ""),
            "source_id": raw.get("pblancId", ""),
        }

    @staticmethod
    def _map_category(raw_cat: str) -> str:
        mapping = {"자금": "자금", "기술": "R&D", "인력": "인력", "수출": "수출", "내수": "내수", "창업": "창업", "경영": "경영"}
        for key, val in mapping.items():
            if key in raw_cat:
                return val
        return "기타"

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
