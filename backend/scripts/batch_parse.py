"""
One-time batch script to parse existing grants without parsed_requirements.

Usage:
    cd /Users/peterchae/forlabs_government/backend
    python -m scripts.batch_parse [--limit N] [--dry-run] [--all]

Cost estimate (active only): ~8,000 grants × ~150 output tokens ≈ ~$0.60 (haiku pricing)
Rate limit: 10,000 output tokens/min → CONCURRENCY=5 is safe (~750 tokens/min per slot)
"""
from __future__ import annotations

import argparse
import asyncio
import logging
from datetime import date

from sqlalchemy import or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.config import settings
from app.models import GrantProject
from app.services.requirement_parser import parse_requirements

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

BATCH_SIZE = 30        # DB commit frequency
CONCURRENCY = 3        # parallel Claude API calls
REQUEST_DELAY = 0.5    # seconds between requests


async def batch_parse(limit: int | None = None, dry_run: bool = False, all_grants: bool = False) -> None:
    engine = create_async_engine(settings.database_url, echo=False, pool_size=5, max_overflow=10)
    SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with SessionLocal() as db:
        q = (
            select(GrantProject)
            .where(GrantProject.parsed_requirements.is_(None))
            .where(GrantProject.summary.isnot(None))
        )

        if not all_grants:
            # Default: active grants only — saves ~39% API cost
            q = q.where(GrantProject.status == "접수중").where(
                or_(
                    GrantProject.end_date >= date.today(),
                    GrantProject.end_date.is_(None),
                )
            )

        q = q.order_by(GrantProject.created_at.desc())

        if limit:
            q = q.limit(limit)

        result = await db.execute(q)
        grants = result.scalars().all()

    mode = "ALL" if all_grants else "active only (접수중)"
    logger.info("Found %d grants to parse — mode=%s, concurrency=%d", len(grants), mode, CONCURRENCY)

    if dry_run:
        logger.info("Dry run — exiting without API calls")
        return

    processed = 0
    failed = 0
    sem = asyncio.Semaphore(CONCURRENCY)

    async def parse_one(grant: GrantProject) -> tuple:
        async with sem:
            await asyncio.sleep(REQUEST_DELAY)
            try:
                parsed = await parse_requirements(grant.summary or "")
                return (grant.id, parsed, None)
            except Exception as e:
                return (grant.id, None, e)

    async with SessionLocal() as db:
        for i in range(0, len(grants), BATCH_SIZE):
            batch = grants[i : i + BATCH_SIZE]
            logger.info(
                "Batch %d/%d (%d-%d) — total progress: %d/%d",
                i // BATCH_SIZE + 1,
                (len(grants) + BATCH_SIZE - 1) // BATCH_SIZE,
                i,
                min(i + BATCH_SIZE, len(grants)),
                processed,
                len(grants),
            )

            results = await asyncio.gather(*[parse_one(g) for g in batch])

            for grant_id, parsed, err in results:
                if err:
                    failed += 1
                    logger.error("Error grant %s: %s", grant_id, err)
                elif parsed:
                    await db.execute(
                        update(GrantProject)
                        .where(GrantProject.id == grant_id)
                        .values(parsed_requirements=parsed)
                    )
                    processed += 1
                else:
                    failed += 1

            await db.commit()
            logger.info("Progress: %d done, %d failed/skipped (%.1f%%)", processed, failed, processed / len(grants) * 100)

    logger.info(
        "Batch parse complete. Processed: %d, Failed/skipped: %d", processed, failed
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Batch parse grant requirements")
    parser.add_argument("--limit", type=int, default=None, help="Max grants to process")
    parser.add_argument("--dry-run", action="store_true", help="Show count without calling API")
    parser.add_argument("--all", action="store_true", help="Parse ALL unparsed grants (default: active 접수중 only)")
    args = parser.parse_args()

    asyncio.run(batch_parse(limit=args.limit, dry_run=args.dry_run, all_grants=args.all))
