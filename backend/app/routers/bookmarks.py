# backend/app/routers/bookmarks.py
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import User, UserBookmark
from app.schemas import BookmarkCreate, BookmarkResponse

router = APIRouter(prefix="/api/bookmarks", tags=["bookmarks"])


@router.get("", response_model=list[BookmarkResponse])
async def list_bookmarks(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List the authenticated user's bookmarks."""
    result = await db.execute(
        select(UserBookmark)
        .where(UserBookmark.user_id == user.id)
        .order_by(UserBookmark.created_at.desc())
    )
    bookmarks = result.scalars().all()
    return [BookmarkResponse.model_validate(b) for b in bookmarks]


@router.post("", response_model=BookmarkResponse, status_code=status.HTTP_201_CREATED)
async def create_bookmark(
    body: BookmarkCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a bookmark. Returns 409 if already bookmarked."""
    # Check for duplicate
    existing = await db.execute(
        select(UserBookmark).where(
            UserBookmark.user_id == user.id,
            UserBookmark.grant_id == body.grant_id,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bookmark already exists",
        )

    bookmark = UserBookmark(user_id=user.id, grant_id=body.grant_id)
    db.add(bookmark)
    await db.commit()
    await db.refresh(bookmark)
    return BookmarkResponse.model_validate(bookmark)


@router.delete("/{grant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bookmark(
    grant_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a bookmark by grant_id."""
    result = await db.execute(
        select(UserBookmark).where(
            UserBookmark.user_id == user.id,
            UserBookmark.grant_id == grant_id,
        )
    )
    bookmark = result.scalar_one_or_none()
    if bookmark is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bookmark not found",
        )
    await db.delete(bookmark)
    await db.commit()
