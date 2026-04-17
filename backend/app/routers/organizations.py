import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import Organization, User
from app.schemas import OrganizationCreate, OrganizationResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/organizations", tags=["organizations"])


@router.post("", response_model=OrganizationResponse, status_code=201)
async def create_organization(
    body: OrganizationCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.organization_id:
        raise HTTPException(status_code=400, detail="이미 조직에 소속되어 있습니다")

    org = Organization(name=body.name, owner_id=user.id)
    db.add(org)
    await db.flush()

    user.organization_id = org.id
    user.role = "consultant"

    await db.commit()
    await db.refresh(org)
    logger.info("Organization created: id=%s name=%s owner=%s", org.id, org.name, user.id)
    return org
