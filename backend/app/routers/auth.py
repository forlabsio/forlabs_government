# backend/app/routers/auth.py
import random
import string

import bcrypt
import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.email_service import send_verification_email
from app.models import User
from app.schemas import (
    AuthResponse,
    LoginRequest,
    SendVerificationRequest,
    SendVerificationResponse,
    SignupRequest,
    UserProfile,
    UserResponse,
    VerifyCodeRequest,
    VerifyCodeResponse,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Redis client for verification codes
redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)

VERIFICATION_CODE_TTL = 600  # 10 minutes
VERIFICATION_PREFIX = "email_verify:"


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


def _generate_code() -> str:
    return "".join(random.choices(string.digits, k=6))


@router.post("/send-verification", response_model=SendVerificationResponse)
async def send_verification(
    body: SendVerificationRequest, db: AsyncSession = Depends(get_db)
):
    """Send a 6-digit verification code to the given email."""
    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="이미 가입된 이메일입니다.",
        )

    code = _generate_code()
    redis_key = f"{VERIFICATION_PREFIX}{body.email}"
    await redis_client.setex(redis_key, VERIFICATION_CODE_TTL, code)

    send_verification_email(body.email, code)

    return SendVerificationResponse(message="인증코드가 발송되었습니다.")


@router.post("/verify-code", response_model=VerifyCodeResponse)
async def verify_code(body: VerifyCodeRequest):
    """Verify the 6-digit code sent to the email."""
    redis_key = f"{VERIFICATION_PREFIX}{body.email}"
    stored_code = await redis_client.get(redis_key)

    if not stored_code or stored_code != body.code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="인증코드가 올바르지 않거나 만료되었습니다.",
        )

    return VerifyCodeResponse(verified=True)


@router.post("/signup", response_model=AuthResponse)
async def signup(body: SignupRequest, db: AsyncSession = Depends(get_db)):
    """Create a new user account after email verification."""
    # Re-verify the code
    redis_key = f"{VERIFICATION_PREFIX}{body.email}"
    stored_code = await redis_client.get(redis_key)

    if not stored_code or stored_code != body.verification_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="인증코드가 올바르지 않거나 만료되었습니다.",
        )

    # Check duplicate email
    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="이미 가입된 이메일입니다.",
        )

    # Validate password length
    if len(body.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="비밀번호는 8자 이상이어야 합니다.",
        )

    user = User(
        email=body.email,
        name=body.name or body.email.split("@")[0],
        password_hash=_hash_password(body.password),
        company_name=body.company_name,
        industry=body.industry,
        company_age=body.company_age,
        region=body.region,
        employee_count=body.employee_count,
        revenue_range=body.revenue_range,
        email_opt_in=body.email_opt_in,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Delete the used verification code
    await redis_client.delete(redis_key)

    return AuthResponse(
        token=str(user.id),
        user=UserResponse.model_validate(user),
    )


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Login with email and password."""
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="이메일 또는 비밀번호가 올바르지 않습니다.",
        )

    if not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="비밀번호가 설정되지 않았습니다. 회원가입을 다시 진행해주세요.",
        )

    if not _verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="이메일 또는 비밀번호가 올바르지 않습니다.",
        )

    return AuthResponse(
        token=str(user.id),
        user=UserResponse.model_validate(user),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    """Return the current authenticated user's profile."""
    return UserResponse.model_validate(user)


@router.put("/me", response_model=UserResponse)
async def update_me(
    body: UserProfile,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the current user's profile."""
    user.company_name = body.company_name
    user.industry = body.industry
    user.company_age = body.company_age
    user.region = body.region
    user.employee_count = body.employee_count
    user.revenue_range = body.revenue_range
    user.email_opt_in = body.email_opt_in
    await db.commit()
    await db.refresh(user)
    return UserResponse.model_validate(user)
