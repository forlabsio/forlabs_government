# backend/app/collectors/subsidy24.py
import asyncio
import logging

import httpx

from app.collectors.base import BaseCollector
from app.config import settings

logger = logging.getLogger(__name__)

# 행정안전부_대한민국 공공서비스(혜택) 정보 (gov24 v3)
BASE_URL = "https://api.odcloud.kr/api/gov24/v3/serviceList"
PAGE_SIZE = 1000
MAX_PAGES = 15  # safety cap: 15,000 items max
PAGE_DELAY = 0.3  # seconds between API calls


class Subsidy24Collector(BaseCollector):
    source_name = "subsidy24"

    async def fetch_raw(self) -> list[dict]:
        token = settings.subsidy24_api_key
        if not token:
            logger.warning("Subsidy24: no API key configured, skipping")
            return []

        all_items: list[dict] = []
        page = 1

        async with httpx.AsyncClient(timeout=60) as client:
            while page <= MAX_PAGES:
                params = {
                    "serviceKey": token,
                    "page": page,
                    "perPage": PAGE_SIZE,
                }
                try:
                    resp = await client.get(BASE_URL, params=params)
                    resp.raise_for_status()
                except httpx.HTTPStatusError:
                    logger.warning("Subsidy24: HTTP error at page %d, stopping", page)
                    break

                data = resp.json()
                items = data.get("data", [])
                if not items:
                    break

                all_items.extend(items)

                total = data.get("totalCount", 0)
                if page * PAGE_SIZE >= total:
                    break
                page += 1
                await asyncio.sleep(PAGE_DELAY)

        logger.info("Subsidy24: fetched %d services (scanned %d pages)", len(all_items), page)
        return all_items

    def normalize(self, raw: dict) -> dict:
        # Region from 소관기관명 or service name hints
        org = raw.get("소관기관명", "")
        dept = raw.get("부서명", "")

        # Summary: combine purpose + support content + eligibility
        summary_parts = []
        if raw.get("서비스목적요약"):
            summary_parts.append(raw["서비스목적요약"])
        if raw.get("지원내용"):
            summary_parts.append(f"[지원내용] {raw['지원내용']}")
        if raw.get("지원대상"):
            summary_parts.append(f"[대상] {raw['지원대상']}")
        summary = " ".join(summary_parts)

        # Detail URL
        detail_url = raw.get("상세조회URL", "")

        # Application period
        deadline_str = raw.get("신청기한", "")

        return {
            "title": raw.get("서비스명", ""),
            "summary": summary[:2000] if summary else "",
            "category": "보조금",
            "amount_min": None,
            "amount_max": None,
            "target_industry": [],
            "target_region": [],
            "target_age": None,
            "start_date": None,
            "end_date": None,
            "status": "접수중" if "상시" in deadline_str else "진행중",
            "organization": org or dept or "정부24",
            "detail_url": detail_url,
            "source_id": raw.get("서비스ID", ""),
        }

    @staticmethod
    def _map_category(field: str, support_type: str) -> str:
        combined = f"{field} {support_type}"
        mapping = {
            "창업": "창업",
            "고용": "고용",
            "교육": "교육",
            "주거": "주거",
            "건강": "건강",
            "의료": "건강",
            "보육": "교육",
            "문화": "문화",
            "농림": "농림",
            "환경": "환경",
            "안전": "생활안정",
            "생활": "생활안정",
            "복지": "생활안정",
        }
        for key, val in mapping.items():
            if key in combined:
                return val
        return "기타"
