# backend/app/tasks.py
import logging
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.collectors.registry import ALL_COLLECTORS
from app.database import async_session as _db_session_factory
from app.models import EmailLog, GrantProject, User


@dataclass
class _GrantLite:
    """경량 과제 DTO — send_daily_curation 전용. 전체 ORM 객체 대신 사용."""
    id: uuid.UUID
    title: str | None
    organization: str | None
    category: str | None
    amount_max: int | None
    end_date: date | None
    created_at: datetime | None
    parsed_requirements: dict | None

logger = logging.getLogger(__name__)

ELIGIBILITY_THRESHOLD = 60
URGENT_DAYS = 7


async def run_all_collectors(schedule_time: str):
    session_factory = _db_session_factory
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

    # 수집 완료 후 임베딩 없는 신규 과제만 증분 임베딩
    try:
        await embed_new_grants(session_factory)
    except Exception:
        logger.exception("embed_new_grants 실패 — 수집 결과는 정상 저장됨")


async def embed_new_grants(session_factory: async_sessionmaker[AsyncSession]) -> None:
    """접수중/공고중 과제 중 임베딩이 없는 것만 증분 처리."""
    from sqlalchemy import text
    from app.embedding import generate_grant_embedding

    # 필요한 컬럼만 선택해 ORM 객체 메모리 절약
    async with session_factory() as db:
        result = await db.execute(
            select(
                GrantProject.id,
                GrantProject.title,
                GrantProject.summary,
                GrantProject.category,
                GrantProject.organization,
            )
            .where(
                GrantProject.status.in_(["접수중", "공고중"]),
                GrantProject.content_embedding.is_(None),
            )
            .limit(200)
        )
        rows = result.all()

    if not rows:
        logger.info("embed_new_grants: 신규 임베딩 대상 없음")
        return

    logger.info(f"embed_new_grants: {len(rows)}건 임베딩 시작")
    # 임베딩은 외부 API라 순차 처리, UPDATE는 단일 세션에서 배치 처리
    updates: list[dict] = []
    for row in rows:
        try:
            emb = await generate_grant_embedding(
                title=row.title,
                summary=row.summary,
                category=row.category,
                organization=row.organization,
            )
            if emb:
                updates.append({
                    "emb": "[" + ",".join(f"{x:.7f}" for x in emb) + "]",
                    "id": str(row.id),
                })
        except Exception:
            logger.exception(f"embed_new_grants: {row.id} 임베딩 실패")

    if updates:
        async with session_factory() as db:
            for upd in updates:
                await db.execute(
                    text("UPDATE grant_projects SET content_embedding = :emb WHERE id = :id"),
                    upd,
                )
            await db.commit()

    logger.info(f"embed_new_grants: {len(updates)}/{len(rows)}건 완료")


async def send_daily_curation():
    """매일 오전 8시 — 각 유저의 프로필 기반 맞춤 브리핑 이메일 발송."""
    from app.email_service import send_briefing_email
    from app.services.eligibility import compute_eligibility

    session_factory = _db_session_factory
    today = date.today()
    week_ago = today - timedelta(days=7)

    async with session_factory() as db:
        # 수신 동의 유저
        users_result = await db.execute(
            select(User).where(User.email_opt_in == True)  # noqa: E712
        )
        users = users_result.scalars().all()

        if not users:
            logger.info("send_daily_curation: 수신 동의 유저 없음")
            return

        # parsed_requirements 가 있는 활성 과제 — 필요한 컬럼만 로드 (ORM 전체 객체 대신)
        grants_result = await db.execute(
            select(
                GrantProject.id,
                GrantProject.title,
                GrantProject.organization,
                GrantProject.category,
                GrantProject.amount_max,
                GrantProject.end_date,
                GrantProject.created_at,
                GrantProject.parsed_requirements,
            ).where(
                GrantProject.status.in_(["접수중", "공고중", "진행중"]),
                (GrantProject.end_date >= today) | GrantProject.end_date.is_(None),
                GrantProject.parsed_requirements.isnot(None),
            )
        )
        active_grants = [
            _GrantLite(
                id=r.id,
                title=r.title,
                organization=r.organization,
                category=r.category,
                amount_max=r.amount_max,
                end_date=r.end_date,
                created_at=r.created_at,
                parsed_requirements=r.parsed_requirements,
            )
            for r in grants_result.all()
        ]

        if not active_grants:
            logger.info("send_daily_curation: parsed_requirements 있는 활성 과제 없음")
            return

        sent_count = 0
        for user in users:
            profile = {
                "company_age": user.company_age,
                "industry": user.industry,
                "region": user.region,
                "employee_count": user.employee_count,
                "revenue_range": user.revenue_range,
                "revenue_krw": getattr(user, "revenue_krw", None),
                "certifications": getattr(user, "certifications", []) or [],
                "is_corporate": getattr(user, "is_corporate", False),
                "is_venture": getattr(user, "is_venture", False),
            }

            # 적격성 계산
            eligible = []
            for grant in active_grants:
                try:
                    elig = compute_eligibility(profile, grant.parsed_requirements)
                    if elig.score is not None and elig.score >= ELIGIBILITY_THRESHOLD:
                        eligible.append((grant, elig.score, elig.checklist, elig.confidence))
                except Exception:
                    pass

            if not eligible:
                logger.debug(f"send_daily_curation: {user.email} 매칭 과제 없음")
                continue

            eligible.sort(key=lambda x: x[1], reverse=True)

            urgent = [
                x for x in eligible
                if x[0].end_date and (x[0].end_date - today).days <= URGENT_DAYS
            ]
            new_grants = [
                x for x in eligible
                if x[0].created_at and x[0].created_at.date() >= week_ago
            ]
            total_opportunity = sum(g.amount_max for g, _, _, _ in eligible if g.amount_max)

            # 기업 레이블
            parts = []
            if user.company_name:
                parts.append(user.company_name)
            if user.industry:
                parts.append(user.industry)
            if user.region:
                parts.append(user.region)
            company_label = " · ".join(parts) if parts else (user.name or "회원")

            # 미완성 프로필 필드
            missing = []
            if not user.industry:         missing.append("업종")
            if user.company_age is None:  missing.append("업력")
            if not user.region:           missing.append("소재지")
            if user.employee_count is None: missing.append("직원수")

            email_id = send_briefing_email(
                to_email=user.email,
                company_label=company_label,
                available_count=len(eligible),
                urgent_grants=urgent[:5],
                new_grants=new_grants[:5],
                top_grants=eligible[:5],
                total_opportunity_krw=total_opportunity,
                missing_fields=missing,
            )

            if email_id:
                email_log = EmailLog(
                    user_id=user.id,
                    email_type="curation",
                    grant_ids=[g.id for g, _, _, _ in eligible[:10]],
                )
                db.add(email_log)
                sent_count += 1

        await db.commit()
        logger.info(f"send_daily_curation: {sent_count}/{len(users)}명 발송 완료")


BACKFILL_BATCH_SIZE = 500


async def backfill_amount_max() -> None:
    """amount_max가 NULL이고 summary가 있는 과제에 대해 amount_max를 파싱하여 채운다.

    메모리 절약을 위해 BACKFILL_BATCH_SIZE 단위로 처리한다.
    WHERE amount_max IS NULL 조건 덕분에 재시작 시 이미 채워진 rows는 건너뜀 (idempotent).
    """
    from sqlalchemy import text as _text
    from app.utils.amount_parser import parse_amount_max

    session_factory = _db_session_factory
    total_updated = 0
    total_skipped = 0
    offset = 0

    while True:
        async with session_factory() as db:
            result = await db.execute(
                select(GrantProject.id, GrantProject.summary)
                .where(
                    GrantProject.amount_max.is_(None),
                    GrantProject.summary.isnot(None),
                    GrantProject.summary != "",
                )
                .order_by(GrantProject.id)
                .limit(BACKFILL_BATCH_SIZE)
                .offset(offset)
            )
            rows = result.all()

        if not rows:
            break

        updates: list[dict] = []
        for row in rows:
            amount = parse_amount_max(row.summary)
            if amount:
                updates.append({"id": str(row.id), "amount": amount})
            else:
                total_skipped += 1

        if updates:
            async with session_factory() as db:
                for upd in updates:
                    await db.execute(
                        _text("UPDATE grant_projects SET amount_max = :amount WHERE id = :id"),
                        upd,
                    )
                await db.commit()
                total_updated += len(updates)

        offset += len(rows)
        if len(rows) < BACKFILL_BATCH_SIZE:
            break

    logger.info(
        "backfill_amount_max: updated=%d, no_amount=%d",
        total_updated, total_skipped,
    )


def _match_grants_for_user(user: User, grants: list[GrantProject]) -> list[GrantProject]:
    """Filter and score grants based on user profile (industry, region, company age)."""
    if not user.industry and not user.region:
        return []

    scored = []
    for g in grants:
        score = 0

        if user.region and g.target_region:
            if user.region in g.target_region or "전국" in g.target_region:
                score += 3
            elif any(user.region in r for r in g.target_region):
                score += 2

        if user.industry and g.target_industry:
            for ind in g.target_industry:
                if user.industry in ind or ind in user.industry:
                    score += 3
                    break

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

        if user.company_age and g.target_age:
            age_str = str(user.company_age)
            if age_str in g.target_age:
                score += 1

        if score > 0:
            scored.append((score, g))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [g for _, g in scored]
