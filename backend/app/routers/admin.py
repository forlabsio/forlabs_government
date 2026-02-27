from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models.user import User, UserRole
from app.models.service import Service
from app.models.document import Document
from app.schemas.user import UserOut
from app.routers.auth import get_current_user

router = APIRouter(prefix="/admin", tags=["admin"])

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user

@router.get("/stats")
async def get_stats(db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    user_count = await db.scalar(select(func.count()).select_from(User))
    service_count = await db.scalar(select(func.count()).select_from(Service))
    document_count = await db.scalar(select(func.count()).select_from(Document))
    return {"users": user_count, "services": service_count, "documents": document_count}

@router.get("/users", response_model=list[UserOut])
async def list_users(db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    result = await db.execute(select(User))
    return result.scalars().all()
