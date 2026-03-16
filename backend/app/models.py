# backend/app/models.py
from __future__ import annotations

import uuid
from datetime import date, datetime

# pgvector is optional — embedding columns only added if extension is available in Postgres
try:
    from pgvector.sqlalchemy import Vector as _Vector
    _PGVECTOR_AVAILABLE = True
except ImportError:
    _Vector = None  # type: ignore[assignment]
    _PGVECTOR_AVAILABLE = False
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
from sqlalchemy.dialects.postgresql import JSONB as JSON
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    name: Mapped[str | None] = mapped_column(String)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    company_name: Mapped[str | None] = mapped_column(String)
    industry: Mapped[str | None] = mapped_column(String)
    company_age: Mapped[int | None] = mapped_column(Integer)
    region: Mapped[str | None] = mapped_column(String)
    employee_count: Mapped[int | None] = mapped_column(Integer)
    revenue_range: Mapped[str | None] = mapped_column(String)  # deprecated — kept for migration
    revenue_krw: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    certifications = mapped_column(ARRAY(String), default=list, server_default="{}")
    is_corporate: Mapped[bool] = mapped_column(Boolean, default=False)
    is_venture: Mapped[bool] = mapped_column(Boolean, default=False)
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
    parsed_requirements: Mapped[dict | None] = mapped_column(
        JSON, nullable=True, default=None
    )
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str | None] = mapped_column(String, default="접수중")
    organization: Mapped[str | None] = mapped_column(String)
    detail_url: Mapped[str | None] = mapped_column(String)
    view_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
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
