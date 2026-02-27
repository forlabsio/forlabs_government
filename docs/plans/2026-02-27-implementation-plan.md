# GovGrants Platform Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a government grant aggregation platform that collects data from 6 public APIs and serves it via a modern Next.js frontend with AI-powered search.

**Architecture:** Monorepo with `backend/` (FastAPI + Celery) and `frontend/` (Next.js). PostgreSQL + pgvector for storage and semantic search. Supabase Auth for authentication. Redis for caching and Celery broker.

**Tech Stack:** Python 3.11, FastAPI, SQLAlchemy async, Celery, PostgreSQL, pgvector, Redis, Next.js 15, Tailwind v4, TypeScript, Supabase Auth, OpenAI Embeddings

**Python:** Use `/opt/homebrew/bin/python3.11` (brew-installed)

---

## Phase 1: Project Scaffolding & DB Foundation

### Task 1: Backend Project Setup

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/app/__init__.py`
- Create: `backend/app/main.py`
- Create: `backend/app/config.py`
- Create: `backend/.env.example`
- Create: `.gitignore`

**Step 1: Create backend directory and virtual environment**

```bash
cd ~/govgrants
mkdir -p backend/app
/opt/homebrew/bin/python3.11 -m venv backend/.venv
```

**Step 2: Create pyproject.toml**

```toml
# backend/pyproject.toml
[project]
name = "govgrants-backend"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.34.0",
    "sqlalchemy[asyncio]>=2.0.0",
    "asyncpg>=0.30.0",
    "alembic>=1.14.0",
    "pgvector>=0.3.0",
    "celery[redis]>=5.4.0",
    "redis>=5.0.0",
    "httpx>=0.28.0",
    "pydantic>=2.0.0",
    "pydantic-settings>=2.0.0",
    "python-jose[cryptography]>=3.3.0",
    "openai>=1.0.0",
    "resend>=2.0.0",
    "supabase>=2.0.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.24.0",
    "pytest-cov>=5.0.0",
    "httpx>=0.28.0",
    "ruff>=0.8.0",
    "aiosqlite>=0.20.0",
]
```

**Step 3: Install dependencies**

```bash
cd ~/govgrants/backend
.venv/bin/pip install -e ".[dev]"
```

**Step 4: Create .env.example**

```env
# backend/.env.example
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/govgrants
REDIS_URL=redis://localhost:6379/0
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
OPENAI_API_KEY=sk-your-key
RESEND_API_KEY=re_your-key
ADMIN_EMAIL=your-admin@email.com

# Public API Keys (공공데이터포털)
BIZINFO_API_KEY=
NTIS_API_KEY=
KOCCA_API_KEY=
KSTARTUP_API_KEY=
SUBSIDY24_API_KEY=
SMES_API_KEY=
```

**Step 5: Create config.py**

```python
# backend/app/config.py
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/govgrants"
    redis_url: str = "redis://localhost:6379/0"
    supabase_url: str = ""
    supabase_key: str = ""
    supabase_service_key: str = ""
    openai_api_key: str = ""
    resend_api_key: str = ""
    admin_email: str = ""

    bizinfo_api_key: str = ""
    ntis_api_key: str = ""
    kocca_api_key: str = ""
    kstartup_api_key: str = ""
    subsidy24_api_key: str = ""
    smes_api_key: str = ""

    model_config = {"env_file": ".env"}


settings = Settings()
```

**Step 6: Create main.py**

```python
# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="GovGrants API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}
```

**Step 7: Create __init__.py and .gitignore**

```python
# backend/app/__init__.py
```

```gitignore
# .gitignore (root)
__pycache__/
*.pyc
.venv/
*.egg-info/
.env
node_modules/
.next/
dist/
.DS_Store
```

**Step 8: Verify backend starts**

```bash
cd ~/govgrants/backend
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 &
sleep 2
curl http://localhost:8000/health
kill %1
```

Expected: `{"status":"ok"}`

**Step 9: Commit**

```bash
cd ~/govgrants
git add .gitignore backend/
git commit -m "feat: scaffold backend with FastAPI, config, and dependencies"
```

---

### Task 2: Database Models & Migrations

**Files:**
- Create: `backend/app/database.py`
- Create: `backend/app/models.py`
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`
- Create: `backend/alembic/script.py.mako`
- Create: `backend/alembic/versions/` (empty dir)

**Step 1: Create database.py**

```python
# backend/app/database.py
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

engine = create_async_engine(settings.database_url, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        yield session
```

**Step 2: Create models.py with all 8 tables**

```python
# backend/app/models.py
import uuid
from datetime import date, datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    name: Mapped[str | None] = mapped_column(String)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    company_name: Mapped[str | None] = mapped_column(String)
    industry: Mapped[str | None] = mapped_column(String)
    company_age: Mapped[int | None] = mapped_column(Integer)
    region: Mapped[str | None] = mapped_column(String)
    employee_count: Mapped[int | None] = mapped_column(Integer)
    revenue_range: Mapped[str | None] = mapped_column(String)
    profile_embedding = mapped_column(Vector(1536), nullable=True)
    email_opt_in: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    bookmarks: Mapped[list["UserBookmark"]] = relationship(back_populates="user")
    search_logs: Mapped[list["SearchLog"]] = relationship(back_populates="user")
    email_logs: Mapped[list["EmailLog"]] = relationship(back_populates="user")


class GrantProject(Base):
    __tablename__ = "grant_projects"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String, nullable=False)
    summary: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(String)
    amount_min: Mapped[int | None] = mapped_column(BigInteger)
    amount_max: Mapped[int | None] = mapped_column(BigInteger)
    target_industry = mapped_column(ARRAY(String), default=list)
    target_region = mapped_column(ARRAY(String), default=list)
    target_age: Mapped[str | None] = mapped_column(String)
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str | None] = mapped_column(String, default="접수중")
    organization: Mapped[str | None] = mapped_column(String)
    detail_url: Mapped[str | None] = mapped_column(String)
    content_embedding = mapped_column(Vector(1536), nullable=True)
    dedup_hash: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    sources: Mapped[list["GrantSource"]] = relationship(back_populates="grant")
    bookmarks: Mapped[list["UserBookmark"]] = relationship(back_populates="grant")


class GrantSource(Base):
    __tablename__ = "grant_sources"
    __table_args__ = (UniqueConstraint("source", "source_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    grant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("grant_projects.id"), nullable=False)
    source: Mapped[str] = mapped_column(String, nullable=False)
    source_id: Mapped[str] = mapped_column(String, nullable=False)
    raw_data = mapped_column(JSONB, default=dict)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    grant: Mapped["GrantProject"] = relationship(back_populates="sources")


class UserBookmark(Base):
    __tablename__ = "user_bookmarks"
    __table_args__ = (UniqueConstraint("user_id", "grant_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    grant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("grant_projects.id"), nullable=False)
    calendar_synced: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="bookmarks")
    grant: Mapped["GrantProject"] = relationship(back_populates="bookmarks")


class SearchLog(Base):
    __tablename__ = "search_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    query_text: Mapped[str] = mapped_column(String, nullable=False)
    result_count: Mapped[int] = mapped_column(Integer, default=0)
    filters_used = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User | None"] = relationship(back_populates="search_logs")


class FetchLog(Base):
    __tablename__ = "fetch_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source: Mapped[str] = mapped_column(String, nullable=False)
    schedule_time: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, default="running")
    total_fetched: Mapped[int] = mapped_column(Integer, default=0)
    new_count: Mapped[int] = mapped_column(Integer, default=0)
    updated_count: Mapped[int] = mapped_column(Integer, default=0)
    duplicate_count: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Banner(Base):
    __tablename__ = "banners"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String, nullable=False)
    image_url: Mapped[str] = mapped_column(String, nullable=False)
    link_url: Mapped[str] = mapped_column(String, nullable=False)
    target_industry = mapped_column(ARRAY(String), default=list)
    target_region = mapped_column(ARRAY(String), default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    impressions: Mapped[int] = mapped_column(Integer, default=0)
    clicks: Mapped[int] = mapped_column(Integer, default=0)
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class EmailLog(Base):
    __tablename__ = "email_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    email_type: Mapped[str] = mapped_column(String, nullable=False)
    grant_ids = mapped_column(ARRAY(UUID(as_uuid=True)), default=list)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    clicked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped["User"] = relationship(back_populates="email_logs")
```

**Step 3: Initialize Alembic**

```bash
cd ~/govgrants/backend
.venv/bin/alembic init alembic
```

Then update `alembic/env.py` to use async engine and import models:

```python
# backend/alembic/env.py — replace target_metadata line and run_migrations_online
import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.config import settings
from app.database import Base
from app.models import *  # noqa: F401,F403

config = context.config
config.set_main_option("sqlalchemy.url", settings.database_url.replace("+asyncpg", ""))

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True, dialect_opts={"paramstyle": "named"})
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations():
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        url=settings.database_url,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online():
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

**Step 4: Write model import test**

```python
# backend/tests/test_models.py
from app.models import (
    Banner,
    EmailLog,
    FetchLog,
    GrantProject,
    GrantSource,
    SearchLog,
    User,
    UserBookmark,
)


def test_all_models_importable():
    models = [User, GrantProject, GrantSource, UserBookmark, SearchLog, FetchLog, Banner, EmailLog]
    assert len(models) == 8
    for model in models:
        assert hasattr(model, "__tablename__")


def test_grant_project_has_dedup_hash():
    cols = [c.name for c in GrantProject.__table__.columns]
    assert "dedup_hash" in cols
    assert "content_embedding" in cols


def test_user_has_profile_embedding():
    cols = [c.name for c in User.__table__.columns]
    assert "profile_embedding" in cols
    assert "is_admin" in cols
```

**Step 5: Run tests**

```bash
cd ~/govgrants/backend
.venv/bin/pytest tests/test_models.py -v
```

Expected: 3 PASSED

**Step 6: Commit**

```bash
cd ~/govgrants
git add backend/
git commit -m "feat: add SQLAlchemy models (8 tables) and Alembic migration setup"
```

---

### Task 3: Backend API Schemas & CRUD Endpoints

**Files:**
- Create: `backend/app/schemas.py`
- Create: `backend/app/routers/__init__.py`
- Create: `backend/app/routers/grants.py`
- Create: `backend/app/routers/auth.py`
- Create: `backend/app/routers/bookmarks.py`
- Create: `backend/app/routers/search.py`
- Create: `backend/app/routers/admin.py`
- Create: `backend/app/deps.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_grants_api.py`

**Step 1: Create Pydantic schemas**

```python
# backend/app/schemas.py
import uuid
from datetime import date, datetime

from pydantic import BaseModel


# --- Grant ---
class GrantListItem(BaseModel):
    id: uuid.UUID
    title: str
    summary: str | None
    category: str | None
    amount_min: int | None
    amount_max: int | None
    organization: str | None
    end_date: date | None
    status: str | None
    detail_url: str | None
    days_left: int | None = None
    sources: list[str] = []

    model_config = {"from_attributes": True}


class GrantDetail(GrantListItem):
    target_industry: list[str] = []
    target_region: list[str] = []
    target_age: str | None
    start_date: date | None
    created_at: datetime

    model_config = {"from_attributes": True}


class GrantListResponse(BaseModel):
    items: list[GrantListItem]
    total: int
    page: int
    page_size: int


# --- User ---
class UserProfile(BaseModel):
    company_name: str | None = None
    industry: str | None = None
    company_age: int | None = None
    region: str | None = None
    employee_count: int | None = None
    revenue_range: str | None = None
    email_opt_in: bool = True


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    name: str | None
    is_admin: bool
    company_name: str | None
    industry: str | None
    company_age: int | None
    region: str | None

    model_config = {"from_attributes": True}


# --- Bookmark ---
class BookmarkCreate(BaseModel):
    grant_id: uuid.UUID


class BookmarkResponse(BaseModel):
    id: uuid.UUID
    grant_id: uuid.UUID
    calendar_synced: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Search ---
class SearchRequest(BaseModel):
    query: str
    category: str | None = None
    region: str | None = None
    source: str | None = None
    page: int = 1
    page_size: int = 20


class SearchLogResponse(BaseModel):
    query_text: str
    count: int


# --- Admin ---
class FetchLogResponse(BaseModel):
    id: uuid.UUID
    source: str
    schedule_time: str
    status: str
    total_fetched: int
    new_count: int
    duplicate_count: int
    error_message: str | None
    started_at: datetime
    finished_at: datetime | None

    model_config = {"from_attributes": True}


class BannerCreate(BaseModel):
    title: str
    image_url: str
    link_url: str
    target_industry: list[str] = []
    target_region: list[str] = []
    start_date: date | None = None
    end_date: date | None = None


class BannerResponse(BaseModel):
    id: uuid.UUID
    title: str
    image_url: str
    link_url: str
    target_industry: list[str]
    target_region: list[str]
    is_active: bool
    impressions: int
    clicks: int

    model_config = {"from_attributes": True}


class DashboardStats(BaseModel):
    total_grants: int
    active_grants: int
    total_users: int
    today_searches: int
    fetch_logs_today: list[FetchLogResponse]
```

**Step 2: Create auth dependency**

```python
# backend/app/deps.py
import uuid

from fastapi import Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import User


async def get_current_user(
    authorization: str = Header(...),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Validate Supabase JWT and return user. Simplified for now."""
    # TODO: Full Supabase JWT verification
    # For development: accept user_id directly
    token = authorization.replace("Bearer ", "")
    try:
        user_id = uuid.UUID(token)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid token")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def get_admin_user(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
```

**Step 3: Create grants router**

```python
# backend/app/routers/__init__.py
```

```python
# backend/app/routers/grants.py
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import GrantProject, GrantSource
from app.schemas import GrantDetail, GrantListItem, GrantListResponse

router = APIRouter(prefix="/api/grants", tags=["grants"])


@router.get("", response_model=GrantListResponse)
async def list_grants(
    category: str | None = None,
    source: str | None = None,
    region: str | None = None,
    status: str | None = Query(default="접수중"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    query = select(GrantProject).options(selectinload(GrantProject.sources))

    if category:
        query = query.where(GrantProject.category == category)
    if source:
        query = query.join(GrantSource).where(GrantSource.source == source)
    if region:
        query = query.where(GrantProject.target_region.any(region))
    if status:
        query = query.where(GrantProject.status == status)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(GrantProject.end_date.asc().nullslast())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    grants = result.scalars().unique().all()

    today = date.today()
    items = []
    for g in grants:
        days_left = (g.end_date - today).days if g.end_date else None
        items.append(
            GrantListItem(
                id=g.id,
                title=g.title,
                summary=g.summary,
                category=g.category,
                amount_min=g.amount_min,
                amount_max=g.amount_max,
                organization=g.organization,
                end_date=g.end_date,
                status=g.status,
                detail_url=g.detail_url,
                days_left=days_left,
                sources=[s.source for s in g.sources],
            )
        )

    return GrantListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/{grant_id}", response_model=GrantDetail)
async def get_grant(grant_id: str, db: AsyncSession = Depends(get_db)):
    import uuid as _uuid

    result = await db.execute(
        select(GrantProject)
        .options(selectinload(GrantProject.sources))
        .where(GrantProject.id == _uuid.UUID(grant_id))
    )
    grant = result.scalar_one_or_none()
    if not grant:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Grant not found")
    return grant
```

**Step 4: Create search router**

```python
# backend/app/routers/search.py
from fastapi import APIRouter, Depends
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import GrantProject, SearchLog
from app.schemas import GrantListResponse, GrantListItem, SearchRequest

router = APIRouter(prefix="/api/search", tags=["search"])


@router.post("", response_model=GrantListResponse)
async def search_grants(
    req: SearchRequest,
    db: AsyncSession = Depends(get_db),
    # user: User | None = None  # optional auth later
):
    """Search grants using text matching. Vector search added in Phase 3."""
    query = (
        select(GrantProject)
        .options(selectinload(GrantProject.sources))
        .where(
            func.concat(GrantProject.title, ' ', func.coalesce(GrantProject.summary, ''))
            .ilike(f"%{req.query}%")
        )
    )

    if req.category:
        query = query.where(GrantProject.category == req.category)
    if req.region:
        query = query.where(GrantProject.target_region.any(req.region))

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(GrantProject.end_date.asc().nullslast())
    query = query.offset((req.page - 1) * req.page_size).limit(req.page_size)
    result = await db.execute(query)
    grants = result.scalars().unique().all()

    from datetime import date
    today = date.today()
    items = [
        GrantListItem(
            id=g.id, title=g.title, summary=g.summary, category=g.category,
            amount_min=g.amount_min, amount_max=g.amount_max,
            organization=g.organization, end_date=g.end_date,
            status=g.status, detail_url=g.detail_url,
            days_left=(g.end_date - today).days if g.end_date else None,
            sources=[s.source for s in g.sources],
        )
        for g in grants
    ]

    # Log search
    log = SearchLog(query_text=req.query, result_count=total)
    db.add(log)
    await db.commit()

    return GrantListResponse(items=items, total=total, page=req.page, page_size=req.page_size)
```

**Step 5: Create bookmarks router**

```python
# backend/app/routers/bookmarks.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
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
    result = await db.execute(
        select(UserBookmark).where(UserBookmark.user_id == user.id)
    )
    return result.scalars().all()


@router.post("", response_model=BookmarkResponse, status_code=201)
async def create_bookmark(
    body: BookmarkCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(
        select(UserBookmark).where(
            UserBookmark.user_id == user.id,
            UserBookmark.grant_id == body.grant_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Already bookmarked")

    bookmark = UserBookmark(user_id=user.id, grant_id=body.grant_id)
    db.add(bookmark)
    await db.commit()
    await db.refresh(bookmark)
    return bookmark


@router.delete("/{grant_id}", status_code=204)
async def remove_bookmark(
    grant_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    import uuid
    await db.execute(
        delete(UserBookmark).where(
            UserBookmark.user_id == user.id,
            UserBookmark.grant_id == uuid.UUID(grant_id),
        )
    )
    await db.commit()
```

**Step 6: Create admin router**

```python
# backend/app/routers/admin.py
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_admin_user
from app.models import (
    Banner,
    FetchLog,
    GrantProject,
    SearchLog,
    User,
)
from app.schemas import (
    BannerCreate,
    BannerResponse,
    DashboardStats,
    FetchLogResponse,
    SearchLogResponse,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/dashboard", response_model=DashboardStats)
async def dashboard(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    today = date.today()
    total_grants = (await db.execute(select(func.count(GrantProject.id)))).scalar() or 0
    active_grants = (
        await db.execute(
            select(func.count(GrantProject.id)).where(GrantProject.status == "접수중")
        )
    ).scalar() or 0
    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    today_searches = (
        await db.execute(
            select(func.count(SearchLog.id)).where(func.date(SearchLog.created_at) == today)
        )
    ).scalar() or 0

    fetch_logs_result = await db.execute(
        select(FetchLog).where(func.date(FetchLog.started_at) == today).order_by(FetchLog.started_at.desc())
    )
    fetch_logs = fetch_logs_result.scalars().all()

    return DashboardStats(
        total_grants=total_grants,
        active_grants=active_grants,
        total_users=total_users,
        today_searches=today_searches,
        fetch_logs_today=[FetchLogResponse.model_validate(fl) for fl in fetch_logs],
    )


@router.get("/search-insights", response_model=list[SearchLogResponse])
async def search_insights(
    days: int = 7,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(SearchLog.query_text, func.count(SearchLog.id).label("count"))
        .where(SearchLog.created_at >= since)
        .group_by(SearchLog.query_text)
        .order_by(func.count(SearchLog.id).desc())
        .limit(50)
    )
    return [SearchLogResponse(query_text=row.query_text, count=row.count) for row in result.all()]


@router.get("/search-insights/zero-results", response_model=list[SearchLogResponse])
async def zero_result_searches(
    days: int = 7,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(SearchLog.query_text, func.count(SearchLog.id).label("count"))
        .where(SearchLog.created_at >= since, SearchLog.result_count == 0)
        .group_by(SearchLog.query_text)
        .order_by(func.count(SearchLog.id).desc())
        .limit(50)
    )
    return [SearchLogResponse(query_text=row.query_text, count=row.count) for row in result.all()]


# --- Banners CRUD ---
@router.get("/banners", response_model=list[BannerResponse])
async def list_banners(admin: User = Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Banner).order_by(Banner.created_at.desc()))
    return result.scalars().all()


@router.post("/banners", response_model=BannerResponse, status_code=201)
async def create_banner(body: BannerCreate, admin: User = Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    banner = Banner(**body.model_dump())
    db.add(banner)
    await db.commit()
    await db.refresh(banner)
    return banner


@router.delete("/banners/{banner_id}", status_code=204)
async def delete_banner(banner_id: str, admin: User = Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    import uuid
    await db.execute(delete(Banner).where(Banner.id == uuid.UUID(banner_id)))
    await db.commit()
```

**Step 7: Register all routers in main.py**

```python
# backend/app/main.py (replace entire file)
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import admin, bookmarks, grants, search

app = FastAPI(title="GovGrants API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(grants.router)
app.include_router(search.router)
app.include_router(bookmarks.router)
app.include_router(admin.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
```

**Step 8: Write API test**

```python
# backend/tests/test_grants_api.py
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_openapi_docs_loads():
    resp = client.get("/openapi.json")
    assert resp.status_code == 200
    paths = resp.json()["paths"]
    assert "/api/grants" in paths
    assert "/api/search" in paths
    assert "/api/bookmarks" in paths
    assert "/api/admin/dashboard" in paths
    assert "/api/admin/banners" in paths
```

**Step 9: Run tests**

```bash
cd ~/govgrants/backend
.venv/bin/pytest tests/ -v
```

Expected: 5 PASSED (3 model + 2 API)

**Step 10: Commit**

```bash
cd ~/govgrants
git add backend/
git commit -m "feat: add API routers (grants, search, bookmarks, admin) with schemas"
```

---

## Phase 2: Data Collection Pipeline

### Task 4: Base Collector & Bizinfo Collector

**Files:**
- Create: `backend/app/collectors/__init__.py`
- Create: `backend/app/collectors/base.py`
- Create: `backend/app/collectors/bizinfo.py`
- Create: `backend/app/collectors/dedup.py`
- Create: `backend/tests/test_collectors.py`

**Step 1: Create base collector**

```python
# backend/app/collectors/__init__.py
```

```python
# backend/app/collectors/base.py
import hashlib
import logging
from abc import ABC, abstractmethod
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import FetchLog, GrantProject, GrantSource

logger = logging.getLogger(__name__)


class BaseCollector(ABC):
    source_name: str  # e.g. "bizinfo"

    @abstractmethod
    async def fetch_raw(self) -> list[dict]:
        """Fetch raw data from API. Return list of raw dicts."""
        ...

    @abstractmethod
    def normalize(self, raw: dict) -> dict:
        """Normalize raw dict to GrantProject-compatible fields.
        Must return: title, summary, category, amount_min, amount_max,
        target_industry, target_region, target_age, start_date, end_date,
        status, organization, detail_url, source_id
        """
        ...

    @staticmethod
    def make_dedup_hash(title: str, organization: str | None, end_date: str | None) -> str:
        key = f"{title}|{organization or ''}|{end_date or ''}"
        return hashlib.sha256(key.encode()).hexdigest()

    async def run(self, db: AsyncSession, schedule_time: str) -> FetchLog:
        log = FetchLog(source=self.source_name, schedule_time=schedule_time)
        db.add(log)
        await db.flush()

        try:
            raw_items = await self.fetch_raw()
            log.total_fetched = len(raw_items)

            for raw in raw_items:
                normalized = self.normalize(raw)
                source_id = normalized.pop("source_id")
                dedup_hash = self.make_dedup_hash(
                    normalized["title"],
                    normalized.get("organization"),
                    str(normalized.get("end_date", "")),
                )

                # Check duplicate
                existing = await db.execute(
                    select(GrantProject).where(GrantProject.dedup_hash == dedup_hash)
                )
                grant = existing.scalar_one_or_none()

                if grant:
                    # Check if source already recorded
                    src_exists = await db.execute(
                        select(GrantSource).where(
                            GrantSource.source == self.source_name,
                            GrantSource.source_id == source_id,
                        )
                    )
                    if not src_exists.scalar_one_or_none():
                        db.add(GrantSource(
                            grant_id=grant.id, source=self.source_name,
                            source_id=source_id, raw_data=raw,
                        ))
                    log.duplicate_count += 1
                else:
                    grant = GrantProject(dedup_hash=dedup_hash, **normalized)
                    db.add(grant)
                    await db.flush()
                    db.add(GrantSource(
                        grant_id=grant.id, source=self.source_name,
                        source_id=source_id, raw_data=raw,
                    ))
                    log.new_count += 1

            log.status = "success"
        except Exception as e:
            logger.exception(f"Collector {self.source_name} failed")
            log.status = "failed"
            log.error_message = str(e)
        finally:
            log.finished_at = datetime.now(timezone.utc)
            await db.commit()

        return log
```

**Step 2: Create Bizinfo collector**

```python
# backend/app/collectors/bizinfo.py
import httpx

from app.collectors.base import BaseCollector
from app.config import settings


class BizinfoCollector(BaseCollector):
    source_name = "bizinfo"

    async def fetch_raw(self) -> list[dict]:
        url = "https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do"
        params = {
            "crtfcKey": settings.bizinfo_api_key,
            "dataType": "json",
            "searchCnt": 100,
            "pageUnit": 100,
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
        return data.get("jsonArray", [])

    def normalize(self, raw: dict) -> dict:
        return {
            "title": raw.get("pblancNm", ""),
            "summary": raw.get("bsnsSumryCn", ""),
            "category": self._map_category(raw.get("pldirSportRealmLclasCodeNm", "")),
            "amount_min": None,
            "amount_max": None,
            "target_industry": [],
            "target_region": [raw.get("jrsdInsttNm", "")] if raw.get("jrsdInsttNm") else [],
            "target_age": None,
            "start_date": self._parse_date(raw.get("reqstBeginEndde")),
            "end_date": self._parse_date(raw.get("reqstEndEndde")),
            "status": "접수중" if raw.get("progrmRegistSttusNm") == "접수중" else raw.get("progrmRegistSttusNm", ""),
            "organization": raw.get("excInsttNm", ""),
            "detail_url": raw.get("pblancUrl", ""),
            "source_id": raw.get("pblancId", ""),
        }

    @staticmethod
    def _map_category(raw_cat: str) -> str:
        mapping = {"자금": "자금", "기술": "R&D", "인력": "인력", "수출": "수출", "내수": "내수", "창업": "창업", "경영": "경영"}
        for key, val in mapping.items():
            if key in raw_cat:
                return val
        return "기타"

    @staticmethod
    def _parse_date(date_str: str | None):
        if not date_str:
            return None
        from datetime import date
        try:
            clean = date_str.replace("-", "").replace(".", "").replace("/", "")[:8]
            return date(int(clean[:4]), int(clean[4:6]), int(clean[6:8]))
        except (ValueError, IndexError):
            return None
```

**Step 3: Write collector tests**

```python
# backend/tests/test_collectors.py
from datetime import date

from app.collectors.base import BaseCollector
from app.collectors.bizinfo import BizinfoCollector


def test_dedup_hash_consistent():
    h1 = BaseCollector.make_dedup_hash("사업A", "기관B", "2026-03-01")
    h2 = BaseCollector.make_dedup_hash("사업A", "기관B", "2026-03-01")
    h3 = BaseCollector.make_dedup_hash("사업A", "기관C", "2026-03-01")
    assert h1 == h2
    assert h1 != h3


def test_bizinfo_normalize():
    collector = BizinfoCollector()
    raw = {
        "pblancNm": "2026 스마트 제조 지원사업",
        "bsnsSumryCn": "중소기업 스마트 공장 도입 지원",
        "pldirSportRealmLclasCodeNm": "자금",
        "jrsdInsttNm": "서울",
        "reqstBeginEndde": "2026-02-01",
        "reqstEndEndde": "2026-03-15",
        "progrmRegistSttusNm": "접수중",
        "excInsttNm": "중소벤처기업부",
        "pblancUrl": "https://example.com/123",
        "pblancId": "PBLN_123",
    }
    result = collector.normalize(raw)
    assert result["title"] == "2026 스마트 제조 지원사업"
    assert result["category"] == "자금"
    assert result["end_date"] == date(2026, 3, 15)
    assert result["source_id"] == "PBLN_123"


def test_bizinfo_parse_date_edge_cases():
    collector = BizinfoCollector()
    assert collector._parse_date(None) is None
    assert collector._parse_date("") is None
    assert collector._parse_date("20260315") == date(2026, 3, 15)
    assert collector._parse_date("2026.03.15") == date(2026, 3, 15)
```

**Step 4: Run tests**

```bash
cd ~/govgrants/backend
.venv/bin/pytest tests/test_collectors.py -v
```

Expected: 3 PASSED

**Step 5: Commit**

```bash
cd ~/govgrants
git add backend/app/collectors/ backend/tests/test_collectors.py
git commit -m "feat: add base collector framework and Bizinfo collector with dedup"
```

---

### Task 5: Remaining 5 Collectors (NTIS, KOCCA, K-Startup, 보조금24, 중소벤처24)

**Files:**
- Create: `backend/app/collectors/ntis.py`
- Create: `backend/app/collectors/kocca.py`
- Create: `backend/app/collectors/kstartup.py`
- Create: `backend/app/collectors/subsidy24.py`
- Create: `backend/app/collectors/smes.py`
- Create: `backend/app/collectors/registry.py`
- Modify: `backend/tests/test_collectors.py`

Each collector follows the same pattern as Bizinfo: subclass BaseCollector, implement `fetch_raw()` and `normalize()`. The actual API endpoints and field mappings differ per source.

**Step 1: Create all 5 collector files** (one at a time, following BizinfoCollector pattern)

Each file:
- Imports httpx and BaseCollector
- Sets `source_name`
- Implements `fetch_raw()` with the correct API endpoint and params
- Implements `normalize()` mapping source-specific fields to our schema

**Step 2: Create registry**

```python
# backend/app/collectors/registry.py
from app.collectors.bizinfo import BizinfoCollector
from app.collectors.kocca import KoccaCollector
from app.collectors.kstartup import KstartupCollector
from app.collectors.ntis import NtisCollector
from app.collectors.smes import SmesCollector
from app.collectors.subsidy24 import Subsidy24Collector

ALL_COLLECTORS = [
    BizinfoCollector(),
    NtisCollector(),
    KoccaCollector(),
    KstartupCollector(),
    Subsidy24Collector(),
    SmesCollector(),
]
```

**Step 3: Add tests for each collector's normalize()**

**Step 4: Run tests**

```bash
cd ~/govgrants/backend
.venv/bin/pytest tests/test_collectors.py -v
```

**Step 5: Commit**

```bash
cd ~/govgrants
git add backend/app/collectors/ backend/tests/
git commit -m "feat: add all 6 API collectors with normalization and registry"
```

---

### Task 6: Celery Setup & Scheduled Tasks

**Files:**
- Create: `backend/app/celery_app.py`
- Create: `backend/app/tasks.py`
- Modify: `backend/app/main.py` (add manual trigger endpoint)

**Step 1: Create Celery app**

```python
# backend/app/celery_app.py
from celery import Celery
from celery.schedules import crontab

from app.config import settings

celery_app = Celery("govgrants", broker=settings.redis_url, backend=settings.redis_url)

celery_app.conf.timezone = "Asia/Seoul"
celery_app.conf.beat_schedule = {
    "collect-10am": {
        "task": "app.tasks.run_all_collectors",
        "schedule": crontab(hour=10, minute=0),
        "args": ("10:00",),
    },
    "collect-1pm": {
        "task": "app.tasks.run_all_collectors",
        "schedule": crontab(hour=13, minute=0),
        "args": ("13:00",),
    },
    "collect-5pm": {
        "task": "app.tasks.run_all_collectors",
        "schedule": crontab(hour=17, minute=0),
        "args": ("17:00",),
    },
}
```

**Step 2: Create tasks**

```python
# backend/app/tasks.py
import asyncio
import logging

from app.celery_app import celery_app
from app.collectors.registry import ALL_COLLECTORS
from app.database import async_session

logger = logging.getLogger(__name__)


async def _run_collectors(schedule_time: str):
    async with async_session() as db:
        for collector in ALL_COLLECTORS:
            logger.info(f"Running {collector.source_name} at {schedule_time}")
            log = await collector.run(db, schedule_time)
            logger.info(
                f"{collector.source_name}: {log.status} "
                f"(new={log.new_count}, dup={log.duplicate_count})"
            )


@celery_app.task
def run_all_collectors(schedule_time: str):
    asyncio.run(_run_collectors(schedule_time))
```

**Step 3: Add manual trigger in admin router**

Add to `backend/app/routers/admin.py`:

```python
@router.post("/trigger-collect")
async def trigger_collect(admin: User = Depends(get_admin_user)):
    from app.tasks import run_all_collectors
    run_all_collectors.delay("manual")
    return {"message": "Collection triggered"}
```

**Step 4: Commit**

```bash
cd ~/govgrants
git add backend/app/celery_app.py backend/app/tasks.py backend/app/routers/admin.py
git commit -m "feat: add Celery Beat with 3x daily schedule (10am, 1pm, 5pm KST)"
```

---

## Phase 3: Frontend

### Task 7: Next.js Project Setup

**Files:**
- Create: `frontend/` (via create-next-app)
- Modify: `frontend/package.json`

**Step 1: Create Next.js project**

```bash
cd ~/govgrants
npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

**Step 2: Install additional deps**

```bash
cd ~/govgrants/frontend
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs lucide-react date-fns
```

**Step 3: Create env file**

```env
# frontend/.env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**Step 4: Verify it runs**

```bash
cd ~/govgrants/frontend
npm run dev &
sleep 5
curl -s http://localhost:3000 | head -20
kill %1
```

**Step 5: Commit**

```bash
cd ~/govgrants
git add frontend/
git commit -m "feat: scaffold Next.js 15 frontend with Tailwind v4"
```

---

### Task 8: Frontend Core Pages — Layout, Home, Grant List

**Files:**
- Modify: `frontend/src/app/layout.tsx`
- Modify: `frontend/src/app/page.tsx`
- Create: `frontend/src/app/grants/page.tsx`
- Create: `frontend/src/app/grants/[id]/page.tsx`
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/lib/supabase.ts`
- Create: `frontend/src/components/GrantCard.tsx`
- Create: `frontend/src/components/SearchBar.tsx`
- Create: `frontend/src/components/FilterBar.tsx`

**Step 1: Create API client**

```typescript
// frontend/src/lib/api.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function fetchGrants(params: Record<string, string> = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${API_URL}/api/grants?${query}`);
  if (!res.ok) throw new Error("Failed to fetch grants");
  return res.json();
}

export async function fetchGrantDetail(id: string) {
  const res = await fetch(`${API_URL}/api/grants/${id}`);
  if (!res.ok) throw new Error("Failed to fetch grant");
  return res.json();
}

export async function searchGrants(body: { query: string; page?: number }) {
  const res = await fetch(`${API_URL}/api/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to search");
  return res.json();
}
```

**Step 2: Create Supabase client**

```typescript
// frontend/src/lib/supabase.ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

**Step 3: Create GrantCard component** — Toss/Notion-style card with D-Day badge and amount highlight.

**Step 4: Create SearchBar component** — Full-width search input with AI search placeholder.

**Step 5: Create FilterBar component** — Category/region/source filter chips.

**Step 6: Build home page** — Hero section + search bar + latest grants preview.

**Step 7: Build grants list page** — Paginated grant list with filters.

**Step 8: Build grant detail page** — Full detail view with bookmark button.

**Step 9: Verify pages render**

```bash
cd ~/govgrants/frontend && npm run build
```

Expected: Build succeeds with no errors.

**Step 10: Commit**

```bash
cd ~/govgrants
git add frontend/
git commit -m "feat: add home, grant list, grant detail pages with search and filters"
```

---

### Task 9: Auth Pages & User Profile

**Files:**
- Create: `frontend/src/app/login/page.tsx`
- Create: `frontend/src/app/mypage/page.tsx`
- Create: `frontend/src/app/mypage/bookmarks/page.tsx`
- Create: `frontend/src/middleware.ts`
- Create: `frontend/src/components/AuthProvider.tsx`

**Step 1-5:** Login page (email + Google/Kakao), middleware for protected routes, mypage with company profile form, bookmarks list, auth context provider.

**Step 6: Commit**

```bash
cd ~/govgrants
git add frontend/
git commit -m "feat: add auth pages, user profile, and bookmarks"
```

---

### Task 10: Admin Dashboard Pages

**Files:**
- Create: `frontend/src/app/admin/layout.tsx`
- Create: `frontend/src/app/admin/page.tsx` (dashboard)
- Create: `frontend/src/app/admin/search-insights/page.tsx`
- Create: `frontend/src/app/admin/banners/page.tsx`
- Create: `frontend/src/app/admin/fetch-logs/page.tsx`

**Step 1:** Admin layout with sidebar navigation + admin guard middleware.

**Step 2:** Dashboard page — stats cards (DAU, total grants, active grants, today searches) + fetch log table.

**Step 3:** Search insights page — top queries table + zero-result queries table.

**Step 4:** Banners management page — CRUD table with create/edit modal.

**Step 5:** Fetch logs page — detailed log table with status badges per source.

**Step 6: Commit**

```bash
cd ~/govgrants
git add frontend/
git commit -m "feat: add admin dashboard, search insights, banner management"
```

---

## Phase 4: AI Search & Embedding

### Task 11: Embedding Pipeline

**Files:**
- Create: `backend/app/embedding.py`
- Modify: `backend/app/collectors/base.py` (add embedding after insert)
- Modify: `backend/app/routers/search.py` (add vector search)
- Create: `backend/tests/test_embedding.py`

**Step 1:** Create embedding service using OpenAI `text-embedding-3-small`.

**Step 2:** In BaseCollector.run(), after inserting a new GrantProject, generate embedding and store in `content_embedding`.

**Step 3:** In search router, convert user query to embedding, then use pgvector `<=>` cosine distance for similarity search.

**Step 4:** Write tests with mocked OpenAI responses.

**Step 5: Commit**

```bash
cd ~/govgrants
git add backend/
git commit -m "feat: add embedding pipeline and vector search"
```

---

## Phase 5: Email Curation & Polish

### Task 12: Email Curation System

**Files:**
- Create: `backend/app/email_service.py`
- Modify: `backend/app/celery_app.py` (add morning curation schedule)
- Modify: `backend/app/tasks.py` (add curation task)

**Step 1:** Create email service using Resend with HTML template.

**Step 2:** Add daily 8:00 AM curation task: for each user with `email_opt_in=True`, find top-matching grants from yesterday's new entries using profile embedding similarity.

**Step 3:** Track open/click via Resend webhooks → update `email_logs`.

**Step 4: Commit**

```bash
cd ~/govgrants
git add backend/
git commit -m "feat: add daily email curation with profile matching"
```

---

### Task 13: Docker Compose for Local Dev

**Files:**
- Create: `docker-compose.yml`
- Create: `backend/Dockerfile`
- Create: `frontend/Dockerfile`

**Step 1:** Docker Compose with PostgreSQL (+ pgvector), Redis, backend, celery worker, celery beat.

**Step 2:** Verify full stack starts:

```bash
cd ~/govgrants
docker compose up -d
docker compose ps
curl http://localhost:8000/health
```

**Step 3: Commit**

```bash
cd ~/govgrants
git add docker-compose.yml backend/Dockerfile frontend/Dockerfile
git commit -m "feat: add Docker Compose for local development"
```

---

### Task 14: Railway & Vercel Deployment Config

**Files:**
- Create: `backend/Procfile`
- Create: `backend/railway.toml`
- Create: `frontend/vercel.json` (if needed)

**Step 1:** Railway config for backend (web + worker + beat processes).

**Step 2:** Environment variables setup guide.

**Step 3: Commit**

```bash
cd ~/govgrants
git add backend/Procfile backend/railway.toml
git commit -m "feat: add Railway deployment config"
```

---

## Task Summary

| Phase | Task | Description |
|-------|------|-------------|
| 1 | Task 1 | Backend scaffolding (FastAPI + config) |
| 1 | Task 2 | DB models (8 tables) + Alembic |
| 1 | Task 3 | API routers (grants, search, bookmarks, admin) |
| 2 | Task 4 | Base collector + Bizinfo collector |
| 2 | Task 5 | Remaining 5 collectors + registry |
| 2 | Task 6 | Celery Beat (10am/1pm/5pm schedule) |
| 3 | Task 7 | Next.js project setup |
| 3 | Task 8 | Core pages (home, grants, detail) |
| 3 | Task 9 | Auth + user profile + bookmarks |
| 3 | Task 10 | Admin dashboard pages |
| 4 | Task 11 | Embedding pipeline + vector search |
| 5 | Task 12 | Email curation system |
| 5 | Task 13 | Docker Compose |
| 5 | Task 14 | Railway/Vercel deployment |
