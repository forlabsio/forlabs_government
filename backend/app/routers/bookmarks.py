# backend/app/routers/bookmarks.py
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.deps import get_current_user
from app.models import GrantProject, GrantSource, User, UserBookmark
from app.schemas import BookmarkCreate, BookmarkResponse, GrantListItem

router = APIRouter(prefix="/api/bookmarks", tags=["bookmarks"])


@router.get("")
async def list_bookmarks(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List the authenticated user's bookmarked grants with full grant info."""
    result = await db.execute(
        select(UserBookmark)
        .where(UserBookmark.user_id == user.id)
        .order_by(UserBookmark.created_at.desc())
    )
    bookmarks = result.scalars().all()

    items = []
    for bm in bookmarks:
        grant_result = await db.execute(
            select(GrantProject)
            .options(selectinload(GrantProject.sources))
            .where(GrantProject.id == bm.grant_id)
        )
        grant = grant_result.scalar_one_or_none()
        if grant:
            source_names = [gs.source for gs in grant.sources] if grant.sources else []
            item = GrantListItem.model_validate({
                "id": grant.id,
                "title": grant.title,
                "summary": grant.summary,
                "category": grant.category,
                "amount_min": grant.amount_min,
                "amount_max": grant.amount_max,
                "organization": grant.organization,
                "end_date": grant.end_date,
                "status": grant.status,
                "detail_url": grant.detail_url,
                "sources": source_names,
            })
            items.append(item)
    return items


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
