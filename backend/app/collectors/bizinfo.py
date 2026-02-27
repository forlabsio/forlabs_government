# backend/app/collectors/bizinfo.py
import httpx
from datetime import date

from app.collectors.base import BaseCollector
from app.config import settings


class BizinfoCollector(BaseCollector):
    source_name = "bizinfo"

    async def fetch_raw(self) -> list[dict]:
        url = "https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do"
        all_items = []
        page = 1
        page_size = 100

        async with httpx.AsyncClient(timeout=30) as client:
            while True:
                params = {
                    "crtfcKey": settings.bizinfo_api_key,
                    "dataType": "json",
                    "searchCnt": page_size,
                    "pageUnit": page_size,
                    "pageIndex": page,
                }
                resp = await client.get(url, params=params)
                resp.raise_for_status()
                data = resp.json()

                if "reqErr" in data:
                    break

                items = data.get("jsonArray", [])
                if not items:
                    break

                all_items.extend(items)

                total = items[0].get("totCnt", 0) if items else 0
                if len(all_items) >= total:
                    break

                page += 1

        return all_items

    def normalize(self, raw: dict) -> dict:
        start_date, end_date = self._parse_date_range(raw.get("reqstBeginEndDe", ""))
        status = self._determine_status(end_date)

        # detail_url: 상대경로인 경우 절대경로로 변환
        detail_url = raw.get("pblancUrl", "")
        if detail_url and not detail_url.startswith("http"):
            detail_url = f"https://www.bizinfo.go.kr{detail_url}"

        return {
            "title": raw.get("pblancNm", ""),
            "summary": self._strip_html(raw.get("bsnsSumryCn", "")),
            "category": self._map_category(raw.get("pldirSportRealmLclasCodeNm", "")),
            "amount_min": None,
            "amount_max": None,
            "target_industry": [],
            "target_region": [raw.get("jrsdInsttNm", "")] if raw.get("jrsdInsttNm") else [],
            "target_age": None,
            "start_date": start_date,
            "end_date": end_date,
            "status": status,
            "organization": raw.get("excInsttNm", ""),
            "detail_url": detail_url,
            "source_id": raw.get("pblancId", ""),
        }

    @staticmethod
    def _parse_date_range(date_range_str: str) -> tuple[date | None, date | None]:
        """Parse '2026-02-23 ~ 2026-03-20' format into (start_date, end_date)."""
        if not date_range_str or "~" not in date_range_str:
            return None, None
        try:
            parts = date_range_str.split("~")
            start_str = parts[0].strip().replace("-", "").replace(".", "").replace("/", "")[:8]
            end_str = parts[1].strip().replace("-", "").replace(".", "").replace("/", "")[:8]
            start = date(int(start_str[:4]), int(start_str[4:6]), int(start_str[6:8]))
            end = date(int(end_str[:4]), int(end_str[4:6]), int(end_str[6:8]))
            return start, end
        except (ValueError, IndexError):
            return None, None

    @staticmethod
    def _determine_status(end_date: date | None) -> str:
        if not end_date:
            return "접수중"
        today = date.today()
        if today > end_date:
            return "마감"
        return "접수중"

    @staticmethod
    def _map_category(raw_cat: str) -> str:
        mapping = {"자금": "자금", "기술": "R&D", "인력": "인력", "수출": "수출", "내수": "내수", "창업": "창업", "경영": "경영"}
        for key, val in mapping.items():
            if key in raw_cat:
                return val
        return "기타"

    @staticmethod
    def _strip_html(html: str) -> str:
        """Remove HTML tags from summary."""
        import re
        text = re.sub(r"<[^>]+>", "", html)
        text = text.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
        return text.strip()
