import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, get_consultant_user
from app.models import ClientInterest, GrantProject, Notification, User
from app.schemas import ClientInterestCreate, ClientInterestResponse, PipelineTransition
from app.services.eligibility import compute_eligibility

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/interests", tags=["pipeline"])

# Pipeline state machine
VALID_TRANSITIONS = {
    "관심": ["상담"],
    "상담": ["관심", "신청"],  # 역방향: 직전만
    "신청": ["상담", "결과"],
    "결과": ["신청"],
}

# Who can trigger each transition
CONSULTANT_ONLY_TRANSITIONS = {"상담", "신청", "결과"}


@router.post("", response_model=ClientInterestResponse, status_code=201)
async def create_interest(
    body: ClientInterestCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify grant exists
    result = await db.execute(select(GrantProject).where(GrantProject.id == body.grant_id))
    grant = result.scalar_one_or_none()
    if not grant:
        raise HTTPException(status_code=404, detail="지원사업을 찾을 수 없습니다")

    # Check duplicate
    result = await db.execute(
        select(ClientInterest).where(
            and_(ClientInterest.user_id == user.id, ClientInterest.grant_id == body.grant_id)
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="이미 관심 표시한 사업입니다")

    # Compute eligibility
    elig_status = None
    elig_detail = None
    if grant.parsed_requirements:
        elig_result = compute_eligibility(user, grant)
        total = elig_result.passed + elig_result.failed
        if total > 0:
            if elig_result.failed == 0:
                elig_status = "가능"
            elif any(c.status == "fail" for c in elig_result.checks if c.field in ("industry", "region", "revenue", "employee_count")):
                elig_status = "불가능"
            else:
                elig_status = "조건부"
        elig_detail = {
            "matched": [c.field for c in elig_result.checks if c.status == "pass"],
            "missing": [c.field for c in elig_result.checks if c.status == "fail"],
        }

    interest = ClientInterest(
        user_id=user.id,
        grant_id=body.grant_id,
        notes=body.notes,
        eligibility_status=elig_status,
        eligibility_detail=elig_detail,
    )
    db.add(interest)

    # Notify consultant if user is a client
    if user.role == "client" and user.invited_by:
        notification = Notification(
            user_id=user.invited_by,
            type="client_interest",
            title=f"{user.name or user.email}님이 관심 사업을 체크했습니다",
            body=grant.title,
            metadata_json={"grant_id": str(grant.id), "client_id": str(user.id)},
        )
        db.add(notification)

    await db.commit()
    await db.refresh(interest)
    logger.info("Interest created: user=%s grant=%s status=%s", user.id, body.grant_id, elig_status)
    return interest


@router.patch("/{interest_id}", response_model=ClientInterestResponse)
async def transition_pipeline(
    interest_id: uuid.UUID,
    body: PipelineTransition,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ClientInterest).where(ClientInterest.id == interest_id))
    interest = result.scalar_one_or_none()
    if not interest:
        raise HTTPException(status_code=404, detail="관심 사업을 찾을 수 없습니다")

    current = interest.pipeline_status
    target = body.pipeline_status

    # Validate transition
    allowed = VALID_TRANSITIONS.get(current, [])
    if target not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"'{current}'에서 '{target}'(으)로 전환할 수 없습니다. 허용: {allowed}",
        )

    # Check role permission
    if target in CONSULTANT_ONLY_TRANSITIONS and user.role not in ("consultant", "admin"):
        raise HTTPException(status_code=403, detail="컨설턴트만 이 전환을 할 수 있습니다")

    interest.pipeline_status = target
    if target == "결과" and body.result_type:
        interest.result_type = body.result_type

    # Notify both parties
    # Get client and grant info
    client_result = await db.execute(select(User).where(User.id == interest.user_id))
    client = client_result.scalar_one_or_none()
    grant_result = await db.execute(select(GrantProject).where(GrantProject.id == interest.grant_id))
    grant = grant_result.scalar_one_or_none()

    if client and grant:
        meta = {"grant_id": str(grant.id), "client_id": str(client.id), "from": current, "to": target}
        # Notify client
        db.add(Notification(
            user_id=client.id, type="pipeline_moved",
            title=f"'{grant.title}' 상태가 {target}(으)로 변경되었습니다",
            metadata_json=meta,
        ))
        # Notify consultant
        if client.invited_by and client.invited_by != user.id:
            db.add(Notification(
                user_id=client.invited_by, type="pipeline_moved",
                title=f"{client.name or client.email} — '{grant.title}' → {target}",
                metadata_json=meta,
            ))

    await db.commit()
    await db.refresh(interest)
    logger.info("Pipeline transition: interest=%s %s→%s by=%s", interest_id, current, target, user.id)
    return interest


@router.get("/my", response_model=list[ClientInterestResponse])
async def list_my_interests(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(ClientInterest)
        .where(ClientInterest.user_id == user.id)
        .order_by(ClientInterest.updated_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()
