# backend/app/tasks.py
import asyncio
import logging
from datetime import date, timedelta

from sqlalchemy import func, select

from app.celery_app import celery_app
from app.collectors.registry import ALL_COLLECTORS
from app.database import async_session
from app.models import EmailLog, GrantProject, User

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


async def _send_daily_curation():
    from app.email_service import send_curation_email

    async with async_session() as db:
        # Get users who opted in
        users_result = await db.execute(
            select(User).where(User.email_opt_in == True)  # noqa: E712
        )
        users = users_result.scalars().all()

        # Get yesterday's new grants
        yesterday = date.today() - timedelta(days=1)
        grants_result = await db.execute(
            select(GrantProject)
            .where(
                GrantProject.status == "접수중",
                func.date(GrantProject.created_at) >= yesterday,
            )
            .order_by(GrantProject.end_date.asc().nullslast())
            .limit(20)
        )
        new_grants = grants_result.scalars().all()

        if not new_grants:
            logger.info("No new grants to curate")
            return

        for user in users:
            # TODO: Use embedding similarity for personalized matching
            # For now, send all new grants
            grants_data = [
                {
                    "title": g.title,
                    "category": g.category,
                    "organization": g.organization,
                    "amount_max": g.amount_max,
                    "end_date": g.end_date,
                    "detail_url": g.detail_url,
                }
                for g in new_grants[:10]
            ]

            email_id = send_curation_email(user.email, user.name, grants_data)

            if email_id:
                email_log = EmailLog(
                    user_id=user.id,
                    email_type="curation",
                    grant_ids=[g.id for g in new_grants[:10]],
                )
                db.add(email_log)

        await db.commit()
        logger.info(f"Sent curation emails to {len(users)} users")


@celery_app.task
def send_daily_curation():
    asyncio.run(_send_daily_curation())
