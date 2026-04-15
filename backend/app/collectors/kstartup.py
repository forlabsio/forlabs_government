# backend/app/collectors/kstartup.py
import asyncio
import logging

import httpx

from app.collectors.base import BaseCollector
from app.config import settings

logger = logging.getLogger(__name__)

# API guide (v2.0, 2025-01-08) specifies:
#   - Endpoint: getAnnouncementInformation01
#   - Pagination: page / perPage (NOT pageNo / numOfRows)
#   - Format selector: returnType=json (NOT type=json)
#   - Rcrt_prgs_yn is a request parameter but does NOT filter server-side;
#     all 27k+ records are returned regardless. Client-side filtering required.
BASE_URL = "https://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01"
PAGE_SIZE = 100
MAX_PAGES = 30  # safety cap: 3,000 items max per run
PAGE_DELAY = 0.3  # seconds between API calls to avoid rate limiting
# Stop scanning after this many consecutive pages with zero recruiting items
EMPTY_PAGE_LIMIT = 3


class KstartupCollector(BaseCollector):
    source_name = "kstartup"

    async def fetch_raw(self) -> list[dict]:
        all_items: list[dict] = []
        page = 1
        consecutive_empty = 0

        async with httpx.AsyncClient(timeout=30) as client:
            while page <= MAX_PAGES:
                params = {
                    "ServiceKey": settings.kstartup_api_key,
                    "returnType": "json",
                    "perPage": PAGE_SIZE,
                    "page": page,
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

                try:
                    data = resp.json()
                except Exception:
                    logger.warning("K-Startup: failed to parse JSON at page %d, stopping", page)
                    break

                items = data.get("data", [])
                if not items:
                    break

                # Filter: only keep currently-recruiting announcements
                recruiting = [item for item in items if item.get("rcrt_prgs_yn") == "Y"]
                all_items.extend(recruiting)

                if not recruiting:
                    consecutive_empty += 1
                    if consecutive_empty >= EMPTY_PAGE_LIMIT:
                        logger.info(
                            "K-Startup: %d consecutive pages with no recruiting items, stopping",
                            EMPTY_PAGE_LIMIT,
                        )
                        break
                else:
                    consecutive_empty = 0

                total = data.get("totalCount", 0)
                fetched_so_far = page * PAGE_SIZE
                if fetched_so_far >= total:
                    break
                page += 1

                await asyncio.sleep(PAGE_DELAY)

        logger.info(
            "K-Startup: fetched %d recruiting announcements (scanned %d pages)",
            len(all_items),
            page,
        )
        return all_items

    def normalize(self, raw: dict) -> dict:
        # Parse region: can be comma-separated
        region_str = raw.get("supt_regin") or ""
        regions = [r.strip() for r in region_str.split(",") if r.strip()] if region_str else []

        # Parse target industry from support classification
        biz_cls = raw.get("supt_biz_clsfc") or ""
        industries = [biz_cls] if biz_cls else []

        # Target age
        age_str = raw.get("biz_trgt_age") or ""

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
        detail_url = raw.get("detl_pg_url") or ""
        if detail_url and not detail_url.startswith("http"):
            detail_url = f"https://{detail_url}"

        from app.utils.amount_parser import parse_amount_max
        summary_text = summary[:2000] if summary else ""
        return {
            "title": raw.get("biz_pbanc_nm") or "",
            "summary": summary_text,
            "category": self._map_category(biz_cls),
            "amount_min": None,
            "amount_max": parse_amount_max(summary_text),
            "target_industry": industries,
            "target_region": regions,
            "target_age": age_str or None,
            "start_date": self._parse_date(raw.get("pbanc_rcpt_bgng_dt")),
            "end_date": self._parse_date(raw.get("pbanc_rcpt_end_dt")),
            "status": "접수중" if raw.get("rcrt_prgs_yn") == "Y" else "마감",
            "organization": org,
            "detail_url": detail_url,
            "source_id": str(raw.get("pbanc_sn") or ""),
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
            "글로벌": "수출",
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
            clean = str(date_str).replace("-", "").replace(".", "").replace("/", "").replace(" ", "")[:8]
            if len(clean) < 8:
                return None
            return date(int(clean[:4]), int(clean[4:6]), int(clean[6:8]))
        except (ValueError, IndexError):
            return None
