# backend/app/collectors/ntis.py
import asyncio
import logging
import re
from datetime import date
from xml.etree import ElementTree

import httpx

from app.collectors.base import BaseCollector
from app.config import settings

logger = logging.getLogger(__name__)

# Search keywords to find R&D projects relevant to government grants
SEARCH_KEYWORDS = [
    "지원사업",
    "연구개발",
    "기술개발",
    "사업화",
    "중소기업",
    "창업",
]

PAGE_SIZE = 100
MAX_PER_KEYWORD = 1000  # safety cap per keyword
PAGE_DELAY = 0.3  # seconds between API calls


class NtisCollector(BaseCollector):
    source_name = "ntis"

    async def fetch_raw(self) -> list[dict]:
        """Fetch R&D projects from NTIS OpenAPI (XML response).

        Searches current year and previous year to catch recently
        registered projects whose ProjectYear may still be last year.
        """
        url = "https://www.ntis.go.kr/rndopen/openApi/public_project"
        all_items: list[dict] = []
        seen_ids: set[str] = set()
        current_year = date.today().year

        year_filters = [
            f"PY={current_year}/SAME",
        ]

        async with httpx.AsyncClient(timeout=60) as client:
            for year_filter in year_filters:
                for keyword in SEARCH_KEYWORDS:
                    start = 1

                    while True:
                        params = {
                            "apprvKey": settings.ntis_api_key,
                            "collection": "project",
                            "SRWR": keyword,
                            "searchFd": "BI",
                            "searchRnkn": "DATE/DESC",
                            "startPosition": start,
                            "displayCnt": PAGE_SIZE,
                            "addQuery": year_filter,
                            "cmbnApiYn": "Y",
                        }
                        try:
                            resp = await client.get(url, params=params)
                            resp.raise_for_status()
                        except httpx.HTTPError as e:
                            logger.warning(
                                "NTIS API error for keyword '%s' (filter=%s): %s",
                                keyword, year_filter, e,
                            )
                            break

                        items, total_hits = self._parse_xml(resp.text)
                        if start == 1:
                            logger.info(
                                "NTIS '%s' (%s): totalHits=%d parsed=%d respLen=%d",
                                keyword, year_filter, total_hits, len(items), len(resp.text),
                            )
                        if not items:
                            break

                        for item in items:
                            pid = item.get("ProjectNumber", "")
                            if pid and pid not in seen_ids:
                                seen_ids.add(pid)
                                all_items.append(item)

                        # Check if we got fewer results than requested (last page)
                        if len(items) < PAGE_SIZE:
                            break

                        start += PAGE_SIZE

                        # Safety limit per keyword
                        if start > MAX_PER_KEYWORD:
                            break

                        await asyncio.sleep(PAGE_DELAY)

        logger.info("NTIS fetched %d unique projects", len(all_items))
        return all_items

    @staticmethod
    def _parse_xml(xml_text: str) -> tuple[list[dict], int]:
        """Parse NTIS XML response into list of dicts + total hits."""
        try:
            root = ElementTree.fromstring(xml_text)
        except ElementTree.ParseError:
            logger.error("Failed to parse NTIS XML response")
            return [], 0

        total_hits = int(_text(root, "TOTALHITS") or "0")

        result_set = root.find("RESULTSET")
        if result_set is None:
            return [], total_hits

        items = []
        for hit in result_set.findall("HIT"):
            item = {}
            item["ProjectNumber"] = _text(hit, "ProjectNumber")

            # Project title
            title_el = hit.find("ProjectTitle")
            if title_el is not None:
                item["ProjectTitle_Korean"] = _text(title_el, "Korean")
                item["ProjectTitle_English"] = _text(title_el, "English")

            # Manager
            mgr = hit.find("Manager")
            if mgr is not None:
                item["Manager_Name"] = _text(mgr, "Name")

            # Goal & Abstract
            for section in ("Goal", "Abstract", "Effect"):
                el = hit.find(section)
                if el is not None:
                    item[f"{section}_Full"] = _text(el, "Full")
                    item[f"{section}_Teaser"] = _text(el, "Teaser")

            # Keyword
            kw = hit.find("Keyword")
            if kw is not None:
                item["Keyword_Korean"] = _text(kw, "Korean")
                item["Keyword_English"] = _text(kw, "English")

            # Agencies
            for tag in ("OrderAgency", "ResearchAgency", "ManageAgency"):
                el = hit.find(tag)
                if el is not None:
                    item[f"{tag}_Name"] = _text(el, "Name")

            # Ministry
            ministry = hit.find("Ministry")
            if ministry is not None:
                item["Ministry_Name"] = _text(ministry, "Name")

            # Budget project / Business name
            bp = hit.find("BudgetProject")
            if bp is not None:
                item["BudgetProject_Name"] = _text(bp, "Name")
            item["BusinessName"] = _text(hit, "BusinessName")

            # Project year & period
            item["ProjectYear"] = _text(hit, "ProjectYear")
            period = hit.find("ProjectPeriod")
            if period is not None:
                item["Period_Start"] = _text(period, "Start")
                item["Period_End"] = _text(period, "End")
                item["Period_TotalStart"] = _text(period, "TotalStart")
                item["Period_TotalEnd"] = _text(period, "TotalEnd")

            # Funds
            item["GovernmentFunds"] = _text(hit, "GovernmentFunds")
            item["TotalFunds"] = _text(hit, "TotalFunds")

            # Science classification
            for sc in hit.findall("ScienceClass"):
                if sc.get("type") == "new" and sc.get("sequence") == "1":
                    item["ScienceClass_Large"] = _text(sc, "Large")
                    item["ScienceClass_Medium"] = _text(sc, "Medium")

            # Region, development phase
            region = hit.find("Region")
            if region is not None:
                item["Region"] = region.text or ""

            dev = hit.find("DevelopmentPhases")
            if dev is not None:
                item["DevelopmentPhases"] = dev.text or ""

            items.append(item)

        return items, total_hits

    def normalize(self, raw: dict) -> dict:
        title = _strip_highlight(raw.get("ProjectTitle_Korean", ""))
        summary = _strip_highlight(
            raw.get("Abstract_Full", "")
            or raw.get("Abstract_Teaser", "")
            or raw.get("Goal_Full", "")
            or raw.get("Goal_Teaser", "")
        )
        organization = _strip_highlight(raw.get("ResearchAgency_Name", ""))
        ministry = _strip_highlight(raw.get("Ministry_Name", ""))

        # Build detail URL
        proj_no = raw.get("ProjectNumber", "")
        detail_url = (
            f"https://www.ntis.go.kr/project/pjtInfo.do?pjtId={proj_no}"
            if proj_no
            else ""
        )

        return {
            "title": title,
            "summary": summary[:2000] if summary else "",
            "category": "R&D",
            "amount_min": _parse_amount(raw.get("GovernmentFunds")),
            "amount_max": _parse_amount(raw.get("TotalFunds")),
            "target_industry": (
                [raw.get("ScienceClass_Large", "")]
                if raw.get("ScienceClass_Large")
                else []
            ),
            "target_region": (
                [raw.get("Region", "")] if raw.get("Region") else []
            ),
            "target_age": None,
            "start_date": _parse_date(raw.get("Period_Start")),
            "end_date": _parse_date(raw.get("Period_End")),
            "status": "진행중",
            "organization": f"{ministry} / {organization}" if ministry else organization,
            "detail_url": detail_url,
            "source_id": proj_no,
        }


def _text(parent, tag: str) -> str:
    """Safely get text from an XML sub-element."""
    el = parent.find(tag)
    return (el.text or "").strip() if el is not None else ""


def _strip_highlight(text: str) -> str:
    """Remove NTIS search highlight <span> tags."""
    return re.sub(r'<span class="?search_word"?>|</span>', "", text).strip()


def _parse_amount(value: str | None) -> int | None:
    if not value:
        return None
    try:
        return int(value)
    except (ValueError, TypeError):
        return None


def _parse_date(date_str: str | None):
    if not date_str:
        return None
    try:
        clean = date_str.replace("-", "").replace(".", "").replace("/", "").replace(" ", "")[:8]
        if len(clean) < 8:
            return None
        return date(int(clean[:4]), int(clean[4:6]), int(clean[6:8]))
    except (ValueError, IndexError):
        return None
