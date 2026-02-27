from pydantic import BaseModel
from datetime import datetime
from app.models.document import DocumentStatus

class DocumentCreate(BaseModel):
    title: str
    description: str | None = None
    service_id: int | None = None

class DocumentUpdate(BaseModel):
    status: DocumentStatus | None = None
    description: str | None = None

class DocumentOut(BaseModel):
    id: int
    title: str
    description: str | None
    status: DocumentStatus
    user_id: int
    service_id: int | None
    created_at: datetime

    model_config = {"from_attributes": True}
