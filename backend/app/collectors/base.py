# backend/app/collectors/base.py
import hashlib
import logging
from abc import ABC, abstractmethod
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import FetchLog, GrantProject, GrantSource
from app.services.requirement_parser import parse_requirements

logger = logging.getLogger(__name__)


class BaseCollector(ABC):
    source_name: str  # e.g. "bizinfo"

    @abstractmethod
    async def fetch_raw(self) -> list[dict]:
        """Fetch raw data from API. Return list of raw dicts."""
        ...

    @abstractmethod
    def normalize(self, raw: dict) -> dict:
        """Normalize raw dict to GrantProject-compatible fields.
        Must return: title, summary, category, amount_min, amount_max,
        target_industry, target_region, target_age, start_date, end_date,
        status, organization, detail_url, source_id
        """
        ...

    @staticmethod
    def make_dedup_hash(title: str, organization: str | None, end_date: str | None) -> str:
        key = f"{title}|{organization or ''}|{end_date or ''}"
        return hashlib.sha256(key.encode()).hexdigest()

    async def run(self, db: AsyncSession, schedule_time: str) -> FetchLog:
        log = FetchLog(source=self.source_name, schedule_time=schedule_time)
        db.add(log)
        await db.flush()

        try:
            raw_items = await self.fetch_raw()
            log.total_fetched = len(raw_items)

            for raw in raw_items:
                normalized = self.normalize(raw)
                source_id = normalized.pop("source_id")
                dedup_hash = self.make_dedup_hash(
                    normalized["title"],
                    normalized.get("organization"),
                    str(normalized.get("end_date", "")),
                )

                # Check duplicate
                existing = await db.execute(
                    select(GrantProject).where(GrantProject.dedup_hash == dedup_hash)
                )
                grant = existing.scalar_one_or_none()

                # Check if this source record already exists
                src_exists = await db.execute(
                    select(GrantSource).where(
                        GrantSource.source == self.source_name,
                        GrantSource.source_id == source_id,
                    )
                )
                if src_exists.scalar_one_or_none():
                    log.duplicate_count += 1
                    continue

                if grant:
                    db.add(GrantSource(
                        grant_id=grant.id, source=self.source_name,
                        source_id=source_id, raw_data=raw,
                    ))
                    log.duplicate_count += 1
                else:
                    grant = GrantProject(dedup_hash=dedup_hash, **normalized)
                    db.add(grant)
                    await db.flush()
                    # Auto-parse requirements for new grant (non-blocking)
                    if grant.summary:
                        try:
                            parsed = await parse_requirements(grant.summary)
                            if parsed:
                                grant.parsed_requirements = parsed
                        except Exception as e:
                            logger.warning("Auto-parse failed for grant %s: %s", getattr(grant, 'dedup_hash', '?'), e)
                    db.add(GrantSource(
                        grant_id=grant.id, source=self.source_name,
                        source_id=source_id, raw_data=raw,
                    ))
                    log.new_count += 1
                    # Auto-sync new grant to Neo4j (non-blocking)
                    try:
                        from app.sync_graph import sync_grant_to_neo4j
                        await sync_grant_to_neo4j(grant)
                    except Exception as e:
                        logger.debug("Neo4j sync skipped for grant %s: %s", grant.id, e)

            log.status = "success"
        except Exception as e:
            logger.exception(f"Collector {self.source_name} failed")
            log.status = "failed"
            log.error_message = f"{type(e).__name__}: {e}" if str(e) else type(e).__name__
        finally:
            log.finished_at = datetime.now(timezone.utc)
            await db.commit()

        return log
