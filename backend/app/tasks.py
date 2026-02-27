# backend/app/tasks.py
import asyncio
import logging

from app.celery_app import celery_app
from app.collectors.registry import ALL_COLLECTORS
from app.database import async_session

logger = logging.getLogger(__name__)


async def _run_collectors(schedule_time: str):
    async with async_session() as db:
        for collector in ALL_COLLECTORS:
            logger.info(f"Running {collector.source_name} at {schedule_time}")
            log = await collector.run(db, schedule_time)
            logger.info(
                f"{collector.source_name}: {log.status} "
                f"(new={log.new_count}, dup={log.duplicate_count})"
            )


@celery_app.task
def run_all_collectors(schedule_time: str):
    asyncio.run(_run_collectors(schedule_time))
