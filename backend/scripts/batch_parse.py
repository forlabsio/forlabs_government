"""
One-time batch script to parse existing grants without parsed_requirements.

Usage:
    cd /Users/peterchae/forlabs_government/backend
    python -m scripts.batch_parse [--limit N] [--dry-run]

Cost estimate: 10,000 grants × ~200 tokens ≈ ~$0.20 total (haiku pricing)
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import time

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.config import settings
from app.models import GrantProject
from app.services.requirement_parser import parse_requirements

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

BATCH_SIZE = 50
DELAY_BETWEEN_BATCHES = 2.0  # seconds, to respect rate limits


async def batch_parse(limit: int | None = None, dry_run: bool = False) -> None:
    engine = create_async_engine(settings.database_url, echo=False)
    SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with SessionLocal() as db:
        q = (
            select(GrantProject)
            .where(GrantProject.parsed_requirements.is_(None))
            .where(GrantProject.summary.isnot(None))
            .order_by(GrantProject.created_at.desc())
        )
        if limit:
            q = q.limit(limit)

        result = await db.execute(q)
        grants = result.scalars().all()

    logger.info("Found %d grants to parse", len(grants))

    if dry_run:
        logger.info("Dry run — exiting without API calls")
        return

    processed = 0
    failed = 0

    async with SessionLocal() as db:
        for i in range(0, len(grants), BATCH_SIZE):
            batch = grants[i : i + BATCH_SIZE]
            logger.info(
                "Processing batch %d/%d (grants %d-%d)",
                i // BATCH_SIZE + 1,
                (len(grants) + BATCH_SIZE - 1) // BATCH_SIZE,
                i,
                min(i + BATCH_SIZE, len(grants)),
            )

            for grant in batch:
                try:
                    parsed = await parse_requirements(grant.summary or "")
                    if parsed:
                        await db.execute(
                            update(GrantProject)
                            .where(GrantProject.id == grant.id)
                            .values(parsed_requirements=parsed)
                        )
                        processed += 1
                    else:
                        failed += 1
                        logger.debug("No requirements extracted for grant %s", grant.id)
                except Exception as e:
                    failed += 1
                    logger.error("Error parsing grant %s: %s", grant.id, e)

            await db.commit()
            logger.info(
                "Batch done. Total processed: %d, failed/skipped: %d",
                processed,
                failed,
            )

            if i + BATCH_SIZE < len(grants):
                time.sleep(DELAY_BETWEEN_BATCHES)

    logger.info(
        "Batch parse complete. Processed: %d, Failed/skipped: %d", processed, failed
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Batch parse grant requirements")
    parser.add_argument("--limit", type=int, default=None, help="Max grants to process")
    parser.add_argument(
        "--dry-run", action="store_true", help="Show count without calling API"
    )
    args = parser.parse_args()

    asyncio.run(batch_parse(limit=args.limit, dry_run=args.dry_run))
