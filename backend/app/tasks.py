# backend/app/tasks.py
import logging
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.collectors.registry import ALL_COLLECTORS
from app.config import settings
from app.models import EmailLog, GrantProject, User

logger = logging.getLogger(__name__)


def _make_session() -> async_sessionmaker[AsyncSession]:
    engine = create_async_engine(settings.async_database_url, echo=False)
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def run_all_collectors(schedule_time: str):
    session_factory = _make_session()
    for collector in ALL_COLLECTORS:
        async with session_factory() as db:
            logger.info(f"Running {collector.source_name} at {schedule_time}")
            try:
                log = await collector.run(db, schedule_time)
                logger.info(
                    f"{collector.source_name}: {log.status} "
                    f"(new={log.new_count}, dup={log.duplicate_count})"
                )
            except Exception:
                logger.exception(f"Failed to run {collector.source_name}")


async def send_daily_curation():
    from app.email_service import send_curation_email

    session_factory = _make_session()
    async with session_factory() as db:
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
            # Personalized matching: filter grants by user profile
            matched = _match_grants_for_user(user, new_grants)

            if not matched:
                # If no profile match, send top 5 general grants
                matched = new_grants[:5]

            grants_data = [
                {
                    "title": g.title,
                    "category": g.category,
                    "organization": g.organization,
                    "amount_max": g.amount_max,
                    "end_date": g.end_date,
                    "detail_url": g.detail_url,
                }
                for g in matched[:10]
            ]

            company = user.company_name or user.name or "대표님"
            matched_count = len(matched)
            total_count = len(new_grants)
            email_id = send_curation_email(
                user.email, company, grants_data,
                matched_count=matched_count, total_count=total_count,
            )

            if email_id:
                email_log = EmailLog(
                    user_id=user.id,
                    email_type="curation",
                    grant_ids=[g.id for g in matched[:10]],
                )
                db.add(email_log)

        await db.commit()
        logger.info(f"Sent personalized curation emails to {len(users)} users")


def _match_grants_for_user(user: User, grants: list[GrantProject]) -> list[GrantProject]:
    """Filter and score grants based on user profile (industry, region, company age)."""
    if not user.industry and not user.region:
        return []  # No profile = no personalization

    scored = []
    for g in grants:
        score = 0

        # Region match
        if user.region and g.target_region:
            if user.region in g.target_region or "전국" in g.target_region:
                score += 3
            # Also match partial (e.g., user="서울", grant region contains "서울")
            elif any(user.region in r for r in g.target_region):
                score += 2

        # Industry match (keyword-based)
        if user.industry and g.target_industry:
            for ind in g.target_industry:
                if user.industry in ind or ind in user.industry:
                    score += 3
                    break

        # Category relevance based on industry
        if user.industry and g.category:
            industry_category_map = {
                "IT/소프트웨어": ["R&D", "창업", "수출"],
                "제조업": ["R&D", "자금", "수출", "인력"],
                "바이오/의료": ["R&D", "자금"],
                "문화/콘텐츠": ["창업", "내수", "수출"],
                "농업/식품": ["자금", "내수"],
            }
            preferred = industry_category_map.get(user.industry, [])
            if g.category in preferred:
                score += 2

        # Company age match
        if user.company_age and g.target_age:
            age_str = str(user.company_age)
            if age_str in g.target_age:
                score += 1

        if score > 0:
            scored.append((score, g))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [g for _, g in scored]
