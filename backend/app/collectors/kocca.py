# backend/app/collectors/kocca.py
import logging
import re

import httpx

from app.collectors.base import BaseCollector
from app.config import settings

logger = logging.getLogger(__name__)

# KOCCA 자체 Open API (kocca.kr/api/pims/List.do)
# - serviceKey: KOCCA 웹사이트에서 발급받은 키
# - pageNo / numOfRows: 페이지네이션
# - Response: {"INFO": {"resultCode": "INFO-000", "list": [...]}}
BASE_URL = "https://www.kocca.kr/api/pims/List.do"


class KoccaCollector(BaseCollector):
    source_name = "kocca"

    async def fetch_raw(self) -> list[dict]:
        if not settings.kocca_api_key:
            logger.warning("KOCCA: API key not set, skipping")
            return []

        params = {
            "serviceKey": settings.kocca_api_key,
            "pageNo": 1,
            "numOfRows": 100,
        }
        async with httpx.AsyncClient(timeout=30) as client:
            try:
                resp = await client.get(BASE_URL, params=params)
                resp.raise_for_status()
            except httpx.HTTPStatusError:
                logger.warning("KOCCA: HTTP error %s", resp.status_code)
                return []

            data = resp.json()

        info = data.get("INFO", {})
        result_code = info.get("resultCode", "")

        if result_code != "INFO-000":
            logger.warning("KOCCA: API error %s - %s", result_code, info.get("resultMgs", ""))
            return []

        items = info.get("list", [])
        logger.info("KOCCA: fetched %d items", len(items))
        return items

    def normalize(self, raw: dict) -> dict:
        # Detail URL
        link = raw.get("link") or ""
        if link and not link.startswith("http"):
            link = f"https://{link}"

        # Parse content for summary
        content = raw.get("content") or ""
        summary = content[:2000] if content else ""

        # Category from cate field
        cate = raw.get("cate") or ""

        return {
            "title": raw.get("title") or "",
            "summary": summary,
            "category": self._map_category(cate),
            "amount_min": None,
            "amount_max": None,
            "target_industry": ["콘텐츠"],
            "target_region": [],
            "target_age": None,
            "start_date": self._parse_date(raw.get("startDt")),
            "end_date": self._parse_date(raw.get("endDt")),
            "status": self._map_status(cate),
            "organization": "한국콘텐츠진흥원",
            "detail_url": link,
            "source_id": self._extract_source_id(raw),
        }

    @staticmethod
    def _extract_source_id(raw: dict) -> str:
        """Extract unique ID from link URL (intcNo param) since intcNoSeq is not unique."""
        link = raw.get("link") or ""
        match = re.search(r"intcNo=([^&]+)", link)
        if match:
            return match.group(1)
        # Fallback: combine intcNoSeq with title hash for uniqueness
        seq = raw.get("intcNoSeq") or ""
        title = raw.get("title") or ""
        if seq and title:
            return f"{seq}_{hash(title) & 0xFFFFFFFF:08x}"
        return seq

    @staticmethod
    def _map_category(cate: str) -> str:
        if "공모" in cate:
            return "창업"
        if "지명" in cate:
            return "R&D"
        if "채용" in cate:
            return "인력"
        return "콘텐츠"

    @staticmethod
    def _map_status(cate: str) -> str:
        if "완료" in cate or "마감" in cate:
            return "마감"
        return "접수중"

    @staticmethod
    def _parse_date(date_str: str | None):
        if not date_str:
            return None
        from datetime import date

        try:
            clean = str(date_str).replace("-", "").replace(".", "").replace("/", "").replace(" ", "")[:8]
            if len(clean) < 8:
                return None
            return date(int(clean[:4]), int(clean[4:6]), int(clean[6:8]))
        except (ValueError, IndexError):
            return None
