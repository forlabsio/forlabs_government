from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.document import Document
from app.models.user import User, UserRole
from app.schemas.document import DocumentCreate, DocumentUpdate, DocumentOut
from app.routers.auth import get_current_user

router = APIRouter(prefix="/documents", tags=["documents"])

@router.get("/", response_model=list[DocumentOut])
async def list_documents(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role in (UserRole.staff, UserRole.admin):
        result = await db.execute(select(Document))
    else:
        result = await db.execute(select(Document).where(Document.user_id == current_user.id))
    return result.scalars().all()

@router.post("/", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def create_document(
    doc_in: DocumentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = Document(**doc_in.model_dump(), user_id=current_user.id)
    db.add(document)
    await db.commit()
    await db.refresh(document)
    return document

@router.patch("/{document_id}", response_model=DocumentOut)
async def update_document(
    document_id: int,
    doc_in: DocumentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Document).where(Document.id == document_id))
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if current_user.role not in (UserRole.staff, UserRole.admin) and document.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    for field, value in doc_in.model_dump(exclude_unset=True).items():
        setattr(document, field, value)
    await db.commit()
    await db.refresh(document)
    return document
