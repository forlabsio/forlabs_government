# backend/app/collectors/kstartup.py
import asyncio
import logging
import xml.etree.ElementTree as ET

import httpx

from app.collectors.base import BaseCollector
from app.config import settings

logger = logging.getLogger(__name__)

# New API (kisedKstartupService01) returns XML with <col name="..."> structure.
# We fetch only currently-recruiting announcements (rcrt_prgs_yn=Y) to avoid
# pulling the full 27k+ historical records every run.
BASE_URL = "https://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01"
PAGE_SIZE = 100
MAX_PAGES = 30  # safety cap: 3,000 items max per run
PAGE_DELAY = 0.5  # seconds between API calls to avoid rate limiting


def _parse_xml_items(xml_text: str) -> tuple[list[dict], int]:
    """Parse the custom XML format into a list of dicts + totalCount."""
    root = ET.fromstring(xml_text)
    total = int(root.findtext("totalCount") or "0")
    items = []
    for item_el in root.findall(".//item"):
        row = {}
        for col in item_el.findall("col"):
            name = col.get("name")
            if name:
                row[name] = (col.text or "").strip()
        items.append(row)
    return items, total


class KstartupCollector(BaseCollector):
    source_name = "kstartup"

    async def fetch_raw(self) -> list[dict]:
        all_items: list[dict] = []
        page = 1

        async with httpx.AsyncClient(timeout=30) as client:
            while page <= MAX_PAGES:
                params = {
                    "serviceKey": settings.kstartup_api_key,
                    "type": "json",  # required param even though response is XML
                    "numOfRows": PAGE_SIZE,
                    "pageNo": page,
                }
                try:
                    resp = await client.get(BASE_URL, params=params)
                    if resp.status_code == 429:
                        logger.warning("K-Startup: rate limited at page %d, stopping", page)
                        break
                    resp.raise_for_status()
                except httpx.HTTPStatusError:
                    logger.warning("K-Startup: HTTP error at page %d, stopping", page)
                    break

                items, total = _parse_xml_items(resp.text)
                if not items:
                    break

                # Only keep currently-recruiting announcements
                for item in items:
                    if item.get("rcrt_prgs_yn") == "Y":
                        all_items.append(item)

                fetched_so_far = page * PAGE_SIZE
                if fetched_so_far >= total:
                    break
                page += 1

                # Rate limit: small delay between pages
                await asyncio.sleep(PAGE_DELAY)

        logger.info(
            "K-Startup: fetched %d recruiting announcements (scanned %d pages)",
            len(all_items),
            page,
        )
        return all_items

    def normalize(self, raw: dict) -> dict:
        # Parse region: can be comma-separated
        region_str = raw.get("supt_regin", "")
        regions = [r.strip() for r in region_str.split(",") if r.strip()] if region_str else []

        # Parse target industry from support classification
        biz_cls = raw.get("supt_biz_clsfc", "")
        industries = [biz_cls] if biz_cls else []

        # Target age
        age_str = raw.get("biz_trgt_age", "")

        # Build summary from announcement content + target info
        summary_parts = []
        if raw.get("pbanc_ctnt"):
            summary_parts.append(raw["pbanc_ctnt"])
        if raw.get("aply_trgt_ctnt"):
            summary_parts.append(f"[대상] {raw['aply_trgt_ctnt']}")
        summary = " ".join(summary_parts)

        # Organization: use the announcing entity or department
        org = raw.get("pbanc_ntrp_nm") or raw.get("biz_prch_dprt_nm") or "K-Startup"

        # Detail URL
        detail_url = raw.get("detl_pg_url", "")
        if detail_url and not detail_url.startswith("http"):
            detail_url = f"https://{detail_url}"

        return {
            "title": raw.get("biz_pbanc_nm", ""),
            "summary": summary[:2000] if summary else "",
            "category": self._map_category(biz_cls),
            "amount_min": None,
            "amount_max": None,
            "target_industry": industries,
            "target_region": regions,
            "target_age": age_str or None,
            "start_date": self._parse_date(raw.get("pbanc_rcpt_bgng_dt")),
            "end_date": self._parse_date(raw.get("pbanc_rcpt_end_dt")),
            "status": "접수중" if raw.get("rcrt_prgs_yn") == "Y" else "마감",
            "organization": org,
            "detail_url": detail_url,
            "source_id": raw.get("pbanc_sn", ""),
        }

    @staticmethod
    def _map_category(biz_cls: str) -> str:
        mapping = {
            "창업": "창업",
            "자금": "자금",
            "기술": "R&D",
            "인력": "인력",
            "멘토링": "창업",
            "사업화": "창업",
            "수출": "수출",
            "시설": "시설·공간",
            "공간": "시설·공간",
            "보육": "시설·공간",
            "융자": "자금",
            "R&D": "R&D",
            "판로": "수출",
            "네트워크": "창업",
        }
        for key, val in mapping.items():
            if key in biz_cls:
                return val
        return "창업"

    @staticmethod
    def _parse_date(date_str: str | None):
        if not date_str:
            return None
        from datetime import date

        try:
            clean = date_str.replace("-", "").replace(".", "").replace("/", "")[:8]
            if len(clean) < 8:
                return None
            return date(int(clean[:4]), int(clean[4:6]), int(clean[6:8]))
        except (ValueError, IndexError):
            return None
