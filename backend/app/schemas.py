from __future__ import annotations
# backend/app/schemas.py
import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, computed_field


# ── Grant Schemas ──────────────────────────────────────────────


class GrantListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    summary: str | None = None
    category: str | None = None
    amount_min: int | None = None
    amount_max: int | None = None
    organization: str | None = None
    end_date: date | None = None
    start_date: date | None = None
    status: str | None = None
    detail_url: str | None = None
    sources: list[str] = []
    view_count: int = 0
    created_at: datetime | None = None

    @computed_field  # type: ignore[prop-decorator]
    @property
    def days_left(self) -> int | None:
        if self.end_date is None:
            return None
        delta = self.end_date - date.today()
        return max(delta.days, 0)


class GrantDetail(GrantListItem):
    target_industry: list[str] = []
    target_region: list[str] = []
    target_age: str | None = None


class GrantListResponse(BaseModel):
    items: list[GrantListItem]
    total: int
    page: int
    page_size: int


# ── User Schemas ───────────────────────────────────────────────


class UserProfile(BaseModel):
    company_name: str | None = None
    industry: str | None = None
    company_age: int | None = None
    region: str | None = None
    employee_count: int | None = None
    revenue_range: str | None = None  # deprecated
    revenue_krw: int | None = None
    certifications: list[str] = []
    is_corporate: bool = False
    is_venture: bool = False
    email_opt_in: bool = True


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    name: str | None = None
    is_admin: bool = False
    role: str = "user"
    organization_id: uuid.UUID | None = None
    onboarding_completed: bool = False
    company_name: str | None = None
    industry: str | None = None
    company_age: int | None = None
    region: str | None = None
    employee_count: int | None = None
    revenue_range: str | None = None  # deprecated
    revenue_krw: int | None = None
    certifications: list[str] = []
    is_corporate: bool = False
    is_venture: bool = False
    email_opt_in: bool = True
    created_at: datetime | None = None


class AdminUserResponse(UserResponse):
    """Extended user info for admin views."""
    bookmark_count: int = 0


# ── Auth Schemas ──────────────────────────────────────────────


class SendVerificationRequest(BaseModel):
    email: str


class SendVerificationResponse(BaseModel):
    message: str


class VerifyCodeRequest(BaseModel):
    email: str
    code: str


class VerifyCodeResponse(BaseModel):
    verified: bool


class SignupRequest(BaseModel):
    email: str
    password: str
    name: str | None = None
    company_name: str | None = None
    industry: str | None = None
    company_age: int | None = None
    region: str | None = None
    employee_count: int | None = None
    revenue_range: str | None = None  # deprecated
    revenue_krw: int | None = None
    certifications: list[str] = []
    email_opt_in: bool = True
    verification_code: str


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    token: str
    user: UserResponse


# ── Bookmark Schemas ───────────────────────────────────────────


class BookmarkCreate(BaseModel):
    grant_id: uuid.UUID


class BookmarkResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    grant_id: uuid.UUID
    calendar_synced: bool = False
    created_at: datetime | None = None


# ── Search Schemas ─────────────────────────────────────────────


class SearchRequest(BaseModel):
    query: str
    category: str | None = None
    region: str | None = None
    source: str | None = None
    sort: str | None = None  # "deadline" | "recent" | None (RRF order)
    page: int = 1
    page_size: int = 20


class SearchLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    query_text: str
    count: int


# ── FetchLog Schemas ───────────────────────────────────────────


class FetchLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    source: str
    schedule_time: str
    status: str
    total_fetched: int = 0
    new_count: int = 0
    updated_count: int = 0
    duplicate_count: int = 0
    error_message: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None


# ── Banner Schemas ─────────────────────────────────────────────


class BannerCreate(BaseModel):
    title: str
    image_url: str
    link_url: str
    target_industry: list[str] = []
    target_region: list[str] = []
    start_date: date | None = None
    end_date: date | None = None


class BannerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    image_url: str
    link_url: str
    target_industry: list[str] = []
    target_region: list[str] = []
    is_active: bool = True
    impressions: int = 0
    clicks: int = 0


# ── Dashboard Schemas ──────────────────────────────────────────


class DashboardStats(BaseModel):
    total_grants: int
    active_grants: int
    total_users: int
    today_searches: int
    fetch_logs_today: list[FetchLogResponse] = []


# ── Eligibility Schemas ─────────────────────────────────────────


class ChecklistItem(BaseModel):
    field: str
    status: str  # "pass" | "fail" | "unknown"
    message: str


# ── Match Schemas ───────────────────────────────────────────────


class MatchRequest(BaseModel):
    industry: str = ""
    region: str = ""
    employee_count: int | None = None
    company_age: int | None = None
    revenue_range: str | None = None  # deprecated
    revenue_krw: int | None = None
    certifications: list[str] = []
    is_corporate: bool | None = None
    is_venture: bool | None = None


# ── Briefing Schemas ────────────────────────────────────────────


# ── B2B2C Schemas ──────────────────────────────────────────────


class OrganizationCreate(BaseModel):
    name: str


class OrganizationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    plan_type: str = "free"
    owner_id: uuid.UUID
    created_at: datetime | None = None


class InvitationCreate(BaseModel):
    email: str


class InvitationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    email: str
    expires_at: datetime
    accepted_at: datetime | None = None
    created_at: datetime | None = None


class ClientInterestCreate(BaseModel):
    grant_id: uuid.UUID
    notes: str | None = None


class PipelineTransition(BaseModel):
    pipeline_status: str  # 관심|상담|신청|결과
    result_type: str | None = None  # 선정|탈락|보류 (결과 시만)


class ClientInterestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    user_id: uuid.UUID
    grant_id: uuid.UUID
    pipeline_status: str
    result_type: str | None = None
    eligibility_status: str | None = None
    eligibility_detail: dict | None = None
    notes: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ConsultingNoteCreate(BaseModel):
    client_user_id: uuid.UUID
    grant_id: uuid.UUID | None = None
    content: str


class ConsultingNoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    consultant_id: uuid.UUID
    client_user_id: uuid.UUID
    grant_id: uuid.UUID | None = None
    content: str
    created_at: datetime | None = None


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    type: str
    title: str
    body: str | None = None
    metadata_json: dict = {}
    read_at: datetime | None = None
    created_at: datetime | None = None


class ClientSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    email: str
    name: str | None = None
    company_name: str | None = None
    industry: str | None = None
    region: str | None = None
    onboarding_completed: bool = False
    interest_count: int = 0


class ClientActivityCreate(BaseModel):
    activity_type: str  # meeting|call|email|visit|note|other
    title: str
    description: str | None = None
    scheduled_at: datetime | None = None


class ClientActivityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    consultant_id: uuid.UUID
    client_user_id: uuid.UUID
    activity_type: str
    title: str
    description: str | None = None
    scheduled_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime | None = None


class ClientDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    email: str
    name: str | None = None
    company_name: str | None = None
    industry: str | None = None
    region: str | None = None
    employee_count: int | None = None
    revenue_krw: int | None = None
    company_age: int | None = None
    certifications: list[str] = []
    is_corporate: bool = False
    is_venture: bool = False
    onboarding_completed: bool = False
    created_at: datetime | None = None
    interest_count: int = 0
    activity_count: int = 0
    note_count: int = 0


class DashboardActivity(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    type: str
    title: str
    body: str | None = None
    metadata_json: dict = {}
    created_at: datetime | None = None


# ── Briefing Schemas ────────────────────────────────────────────


class BriefingGrant(BaseModel):
    grant_id: str
    title: str
    amount_max: int | None = None
    end_date: str | None = None
    days_left: int | None = None
    eligibility_score: float | None = None
    eligibility_checklist: list[ChecklistItem] = []
    eligibility_confidence: str = "low"


class BriefingResponse(BaseModel):
    week_label: str
    date_label: str
    company_label: str
    available_count: int
    urgent_count: int
    total_opportunity_krw: int
    urgent_grants: list[BriefingGrant]
    new_grants: list[BriefingGrant]
    profile_incomplete: bool
    missing_profile_fields: list[str]
