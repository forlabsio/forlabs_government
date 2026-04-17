import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_consultant_user
from app.models import (
    ClientActivity, ClientInterest, ConsultingNote, GrantProject, Notification, User,
)
from app.schemas import (
    ClientActivityCreate, ClientActivityResponse,
    ClientDetailResponse, ClientInterestResponse, ClientSummary,
    ConsultingNoteCreate, ConsultingNoteResponse, DashboardActivity,
    UserProfile,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/clients", tags=["clients"])


# ── All activities (calendar view) ─────────────────────────────────

@router.get("/calendar/activities", response_model=list[ClientActivityResponse])
async def calendar_activities(
    user: User = Depends(get_consultant_user),
    db: AsyncSession = Depends(get_db),
):
    """All activities across all clients for this consultant (calendar view)."""
    if user.is_admin:
        stmt = select(ClientActivity).order_by(ClientActivity.scheduled_at.desc().nullslast())
    else:
        # Get client IDs owned by this consultant
        client_ids_stmt = select(User.id).where(and_(User.invited_by == user.id, User.role == "client"))
        stmt = (
            select(ClientActivity)
            .where(ClientActivity.client_user_id.in_(client_ids_stmt))
            .order_by(ClientActivity.scheduled_at.desc().nullslast())
        )
    result = await db.execute(stmt)
    return result.scalars().all()


# ── Ownership check helper ────────────────────────────────────────

async def _get_owned_client(client_id: uuid.UUID, user: User, db: AsyncSession) -> User:
    """Verify consultant owns this client (via invited_by). Admin can access all."""
    if user.is_admin:
        result = await db.execute(select(User).where(and_(User.id == client_id, User.role == "client")))
    else:
        result = await db.execute(
            select(User).where(and_(User.id == client_id, User.invited_by == user.id, User.role == "client"))
        )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="고객을 찾을 수 없습니다")
    return client


# ── Client list ───────────────────────────────────────────────────

@router.get("", response_model=list[ClientSummary])
async def list_clients(
    user: User = Depends(get_consultant_user),
    db: AsyncSession = Depends(get_db),
):
    if user.is_admin:
        stmt = select(User, func.count(ClientInterest.id).label("cnt")) \
            .outerjoin(ClientInterest, ClientInterest.user_id == User.id) \
            .where(User.role == "client") \
            .group_by(User.id)
    else:
        stmt = select(User, func.count(ClientInterest.id).label("cnt")) \
            .outerjoin(ClientInterest, ClientInterest.user_id == User.id) \
            .where(and_(User.invited_by == user.id, User.role == "client")) \
            .group_by(User.id)

    result = await db.execute(stmt)
    return [
        ClientSummary(
            id=u.id, email=u.email, name=u.name,
            company_name=u.company_name, industry=u.industry,
            region=u.region, onboarding_completed=u.onboarding_completed,
            interest_count=cnt,
        )
        for u, cnt in result.all()
    ]


# ── Dashboard feed ────────────────────────────────────────────────

@router.get("/dashboard", response_model=list[DashboardActivity])
async def dashboard_feed(
    limit: int = 50,
    user: User = Depends(get_consultant_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Notification)
        .where(
            and_(
                Notification.user_id == user.id,
                Notification.type.in_(["client_interest", "pipeline_moved", "invite_accepted"]),
            )
        )
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


# ── Client detail ─────────────────────────────────────────────────

@router.get("/{client_id}", response_model=ClientDetailResponse)
async def get_client(
    client_id: uuid.UUID,
    user: User = Depends(get_consultant_user),
    db: AsyncSession = Depends(get_db),
):
    client = await _get_owned_client(client_id, user, db)

    interest_cnt = (await db.execute(
        select(func.count(ClientInterest.id)).where(ClientInterest.user_id == client_id)
    )).scalar() or 0

    activity_cnt = (await db.execute(
        select(func.count(ClientActivity.id)).where(ClientActivity.client_user_id == client_id)
    )).scalar() or 0

    note_cnt = (await db.execute(
        select(func.count(ConsultingNote.id)).where(ConsultingNote.client_user_id == client_id)
    )).scalar() or 0

    return ClientDetailResponse(
        id=client.id, email=client.email, name=client.name,
        company_name=client.company_name, industry=client.industry,
        region=client.region, employee_count=client.employee_count,
        revenue_krw=client.revenue_krw, company_age=client.company_age,
        certifications=client.certifications or [],
        is_corporate=client.is_corporate, is_venture=client.is_venture,
        onboarding_completed=client.onboarding_completed,
        created_at=client.created_at,
        interest_count=interest_cnt, activity_count=activity_cnt, note_count=note_cnt,
    )


# ── Update client info ────────────────────────────────────────────

@router.put("/{client_id}", response_model=ClientDetailResponse)
async def update_client(
    client_id: uuid.UUID,
    body: UserProfile,
    user: User = Depends(get_consultant_user),
    db: AsyncSession = Depends(get_db),
):
    client = await _get_owned_client(client_id, user, db)

    for field in ["company_name", "industry", "region", "employee_count",
                   "revenue_krw", "company_age", "certifications",
                   "is_corporate", "is_venture"]:
        val = getattr(body, field, None)
        if val is not None:
            setattr(client, field, val)

    await db.commit()
    await db.refresh(client)
    logger.info("Client updated: %s by %s", client_id, user.id)

    # Re-fetch counts
    return await get_client(client_id, user, db)


# ── Activities (미팅/상담/연락 기록) ──────────────────────────────

@router.get("/{client_id}/activities", response_model=list[ClientActivityResponse])
async def list_activities(
    client_id: uuid.UUID,
    user: User = Depends(get_consultant_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_client(client_id, user, db)
    stmt = (
        select(ClientActivity)
        .where(ClientActivity.client_user_id == client_id)
        .order_by(ClientActivity.scheduled_at.desc().nullslast(), ClientActivity.created_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/{client_id}/activities", response_model=ClientActivityResponse, status_code=201)
async def create_activity(
    client_id: uuid.UUID,
    body: ClientActivityCreate,
    user: User = Depends(get_consultant_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_client(client_id, user, db)
    activity = ClientActivity(
        consultant_id=user.id,
        client_user_id=client_id,
        activity_type=body.activity_type,
        title=body.title,
        description=body.description,
        scheduled_at=body.scheduled_at,
    )
    db.add(activity)
    await db.commit()
    await db.refresh(activity)
    logger.info("Activity created: type=%s client=%s", body.activity_type, client_id)
    return activity


@router.patch("/{client_id}/activities/{activity_id}/complete", response_model=ClientActivityResponse)
async def complete_activity(
    client_id: uuid.UUID,
    activity_id: uuid.UUID,
    user: User = Depends(get_consultant_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_client(client_id, user, db)
    result = await db.execute(
        select(ClientActivity).where(and_(ClientActivity.id == activity_id, ClientActivity.client_user_id == client_id))
    )
    activity = result.scalar_one_or_none()
    if not activity:
        raise HTTPException(status_code=404, detail="활동을 찾을 수 없습니다")
    activity.completed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(activity)
    return activity


# ── Interests ─────────────────────────────────────────────────────

@router.get("/{client_id}/interests", response_model=list[ClientInterestResponse])
async def list_client_interests(
    client_id: uuid.UUID,
    user: User = Depends(get_consultant_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_client(client_id, user, db)
    stmt = select(ClientInterest).where(ClientInterest.user_id == client_id).order_by(ClientInterest.updated_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


# ── Consulting notes ──────────────────────────────────────────────

@router.get("/{client_id}/notes", response_model=list[ConsultingNoteResponse])
async def list_consulting_notes(
    client_id: uuid.UUID,
    user: User = Depends(get_consultant_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_client(client_id, user, db)
    stmt = (
        select(ConsultingNote)
        .where(ConsultingNote.client_user_id == client_id)
        .order_by(ConsultingNote.created_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/{client_id}/notes", response_model=ConsultingNoteResponse, status_code=201)
async def create_consulting_note(
    client_id: uuid.UUID,
    body: ConsultingNoteCreate,
    user: User = Depends(get_consultant_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_client(client_id, user, db)
    note = ConsultingNote(
        consultant_id=user.id,
        client_user_id=client_id,
        grant_id=body.grant_id,
        content=body.content,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    logger.info("Note created: consultant=%s client=%s", user.id, client_id)
    return note
