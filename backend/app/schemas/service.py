from pydantic import BaseModel
from datetime import datetime

class ServiceCreate(BaseModel):
    name: str
    description: str | None = None
    category: str

class ServiceUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    category: str | None = None
    is_active: bool | None = None

class ServiceOut(BaseModel):
    id: int
    name: str
    description: str | None
    category: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
