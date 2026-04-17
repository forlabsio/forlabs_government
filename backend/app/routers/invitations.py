import logging
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_consultant_user
from app.email_service import send_invite_email
from app.models import Invitation, Organization, User
from app.schemas import InvitationCreate, InvitationResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/invitations", tags=["invitations"])

INVITE_EXPIRY_DAYS = 7


@router.post("", response_model=InvitationResponse, status_code=status.HTTP_201_CREATED)
async def create_invitation(
    body: InvitationCreate,
    user: User = Depends(get_consultant_user),
    db: AsyncSession = Depends(get_db),
):
    if not user.organization_id:
        raise HTTPException(status_code=400, detail="조직이 설정되지 않았습니다")

    # Check if email is already in another org
    result = await db.execute(
        select(User).where(
            and_(User.email == body.email, User.organization_id.isnot(None), User.organization_id != user.organization_id)
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="이미 다른 컨설턴트의 고객입니다")

    # Check existing invitation for this org+email
    result = await db.execute(
        select(Invitation).where(
            and_(Invitation.organization_id == user.organization_id, Invitation.email == body.email)
        )
    )
    existing = result.scalar_one_or_none()

    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=INVITE_EXPIRY_DAYS)

    if existing:
        if existing.accepted_at:
            raise HTTPException(status_code=400, detail="이미 수락된 초대입니다")
        if existing.expires_at > datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="이미 초대 메일이 발송되었습니다")
        # Expired: update token
        existing.token = token
        existing.expires_at = expires_at
        existing.invited_by = user.id
        invitation = existing
    else:
        invitation = Invitation(
            organization_id=user.organization_id,
            invited_by=user.id,
            email=body.email,
            token=token,
            expires_at=expires_at,
        )
        db.add(invitation)

    await db.commit()
    await db.refresh(invitation)

    # Send email (non-blocking on failure)
    try:
        send_invite_email(body.email, user.name or user.email, token)
    except Exception:
        logger.exception("Failed to send invite email to %s", body.email)

    logger.info("Invitation created: org=%s email=%s by=%s", user.organization_id, body.email, user.id)
    return invitation


@router.get("/accept/{token}")
async def accept_invitation(token: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Invitation).where(Invitation.token == token))
    invitation = result.scalar_one_or_none()

    if not invitation:
        raise HTTPException(status_code=404, detail="초대를 찾을 수 없습니다")
    if invitation.accepted_at:
        raise HTTPException(status_code=409, detail="이미 수락된 초대입니다")
    if invitation.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="초대가 만료되었습니다. 컨설턴트에게 재초대를 요청해주세요.")

    return {
        "valid": True,
        "email": invitation.email,
        "organization_id": str(invitation.organization_id),
        "invitation_id": str(invitation.id),
    }


@router.post("/accept/{token}")
async def confirm_accept_invitation(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Invitation).where(Invitation.token == token))
    invitation = result.scalar_one_or_none()

    if not invitation:
        raise HTTPException(status_code=404, detail="초대를 찾을 수 없습니다")
    if invitation.accepted_at:
        raise HTTPException(status_code=409, detail="이미 수락된 초대입니다")
    if invitation.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="초대가 만료되었습니다")

    # Find or expect user (frontend handles signup/login before calling this)
    result = await db.execute(select(User).where(User.email == invitation.email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="먼저 회원가입을 완료해주세요")

    user.organization_id = invitation.organization_id
    user.role = "client"
    user.invited_by = invitation.invited_by
    user.onboarding_completed = False
    invitation.accepted_at = datetime.now(timezone.utc)

    await db.commit()
    logger.info("Invitation accepted: user=%s org=%s", user.id, invitation.organization_id)

    return {"accepted": True, "user_id": str(user.id)}
