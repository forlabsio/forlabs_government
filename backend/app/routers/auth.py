# backend/app/routers/auth.py
from fastapi import APIRouter, Depends

from app.deps import get_current_user
from app.models import User
from app.schemas import UserResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    """Return the current authenticated user's profile."""
    return UserResponse.model_validate(user)
