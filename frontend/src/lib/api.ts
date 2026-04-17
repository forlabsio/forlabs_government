const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface Grant {
  id: string;
  title: string;
  summary?: string;
  category?: string;
  amount_min?: number;
  amount_max?: number;
  organization?: string;
  end_date?: string;
  start_date?: string;
  status?: string;
  detail_url?: string;
  sources: string[];
  days_left?: number;
  view_count?: number;
  created_at?: string;
  // Detail fields
  target_industry?: string[];
  target_region?: string[];
  target_age?: string;
}

export interface GrantListResponse {
  items: Grant[];
  total: number;
  page: number;
  page_size: number;
}

export interface SearchResponse {
  items: Grant[];
  total: number;
  page: number;
  page_size: number;
}

export async function fetchGrants(
  params: Record<string, string> = {}
): Promise<GrantListResponse> {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${API_URL}/api/grants?${query}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error("Failed to fetch grants");
  return res.json();
}

export async function fetchGrantDetail(id: string): Promise<Grant> {
  const res = await fetch(`${API_URL}/api/grants/${id}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error("Failed to fetch grant");
  return res.json();
}

export async function searchGrants(body: {
  query: string;
  category?: string;
  region?: string;
  source?: string;
  sort?: string;
  page?: number;
  page_size?: number;
}): Promise<SearchResponse> {
  const res = await fetch(`${API_URL}/api/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to search");
  return res.json();
}

// ─── Auth API ────────────────────────────────────────────

export interface AuthResponse {
  token: string;
  user: UserInfo;
}

export async function sendVerificationCode(
  email: string
): Promise<{ message: string }> {
  const res = await fetch(`${API_URL}/api/auth/send-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "인증코드 발송에 실패했습니다.");
  }
  return res.json();
}

export async function verifyCode(
  email: string,
  code: string
): Promise<{ verified: boolean }> {
  const res = await fetch(`${API_URL}/api/auth/verify-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "인증코드 확인에 실패했습니다.");
  }
  return res.json();
}

export interface SignupData {
  email: string;
  password: string;
  name?: string;
  company_name?: string;
  industry?: string;
  company_age?: number;
  region?: string;
  employee_count?: number;
  revenue_range?: string;
  email_opt_in?: boolean;
  verification_code: string;
}

export async function signup(data: SignupData): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.detail || "회원가입에 실패했습니다.");
  }
  return res.json();
}

export async function login(
  email: string,
  password: string
): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "로그인에 실패했습니다.");
  }
  return res.json();
}

// ─── User Profile API ────────────────────────────────────

export interface UserProfile {
  company_name?: string;
  industry?: string;
  company_age?: number;
  region?: string;
  employee_count?: number;
  revenue_range?: string;  // deprecated
  revenue_krw?: number;
  certifications?: string[];
  is_corporate?: boolean;
  is_venture?: boolean;
  email_opt_in?: boolean;
}

export interface UserInfo {
  id: string;
  email: string;
  name?: string;
  is_admin: boolean;
  role: string;
  organization_id?: string;
  onboarding_completed: boolean;
  company_name?: string;
  industry?: string;
  company_age?: number;
  region?: string;
  employee_count?: number;
  revenue_range?: string;  // deprecated
  revenue_krw?: number;
  certifications: string[];
  is_corporate: boolean;
  is_venture: boolean;
  email_opt_in: boolean;
  created_at?: string;
  bookmark_count?: number;
}

export async function fetchMe(token: string): Promise<UserInfo> {
  const res = await fetch(`${API_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch profile");
  return res.json();
}

export async function updateProfile(
  token: string,
  profile: UserProfile
): Promise<UserInfo> {
  const res = await fetch(`${API_URL}/api/auth/me`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(profile),
  });
  if (!res.ok) throw new Error("Failed to update profile");
  return res.json();
}

// ─── Bookmark API ────────────────────────────────────────

export async function fetchBookmarks(token: string): Promise<any[]> {
  const res = await fetch(`${API_URL}/api/bookmarks`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch bookmarks");
  return res.json();
}

export async function addBookmark(
  token: string,
  grantId: string
): Promise<any> {
  const res = await fetch(`${API_URL}/api/bookmarks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ grant_id: grantId }),
  });
  if (!res.ok) throw new Error("Failed to add bookmark");
  return res.json();
}

export async function removeBookmark(
  token: string,
  grantId: string
): Promise<void> {
  const res = await fetch(`${API_URL}/api/bookmarks/${grantId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to remove bookmark");
}

// ─── Admin API ──────────────────────────────────────────

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function fetchDashboard(token: string): Promise<any> {
  const res = await fetch(`${API_URL}/api/admin/dashboard`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch dashboard");
  return res.json();
}

export async function fetchSearchInsights(
  token: string,
  days?: number
): Promise<any> {
  const query = days ? `?days=${days}` : "";
  const res = await fetch(`${API_URL}/api/admin/search-insights${query}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch search insights");
  return res.json();
}

export async function fetchZeroResults(
  token: string,
  days?: number
): Promise<any> {
  const query = days ? `?days=${days}` : "";
  const res = await fetch(`${API_URL}/api/admin/zero-results${query}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch zero results");
  return res.json();
}

export async function fetchBanners(token: string): Promise<any> {
  const res = await fetch(`${API_URL}/api/admin/banners`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch banners");
  return res.json();
}

export async function createBanner(token: string, data: any): Promise<any> {
  const res = await fetch(`${API_URL}/api/admin/banners`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create banner");
  return res.json();
}

export async function deleteBanner(token: string, id: string): Promise<any> {
  const res = await fetch(`${API_URL}/api/admin/banners/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to delete banner");
  return res.json();
}

export async function triggerCollect(token: string): Promise<any> {
  const res = await fetch(`${API_URL}/api/admin/trigger-collect`, {
    method: "POST",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to trigger collect");
  return res.json();
}

// ─── Admin User Management ───────────────────────────────

export async function fetchUsers(
  token: string,
  params: { search?: string; page?: number; page_size?: number } = {}
): Promise<{ items: UserInfo[]; total: number; page: number; page_size: number }> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.page) query.set("page", String(params.page));
  if (params.page_size) query.set("page_size", String(params.page_size));
  const res = await fetch(`${API_URL}/api/admin/users?${query}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json();
}

export async function deleteUser(token: string, userId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/admin/users/${userId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to delete user");
}

export async function resetUserPassword(
  token: string,
  userId: string,
  newPassword: string
): Promise<void> {
  const res = await fetch(`${API_URL}/api/admin/users/${userId}/reset-password`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({ new_password: newPassword }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "비밀번호 초기화에 실패했습니다.");
  }
}

// ─── Intelligence API ────────────────────────────────────

export interface TrendData {
  chart_data: Record<string, string | number>[];
  categories: string[];
  agencies: { name: string; count: number }[];
  sector_leaderboard: { category: string; grant_count: number; total_amount_krw: number; avg_amount_krw: number }[];
  weekly_velocity: { week: string; count: number }[];
  high_value_closing: { id: string; title: string; organization: string; category: string; amount_max: number; end_date: string; days_left: number }[];
  agency_budget: { name: string; grant_count: number; total_amount_krw: number }[];
}

export interface MatchResult {
  matched_grants: {
    grant_id: string;
    title: string;
    amount_max?: number;
    end_date?: string;
    organization?: string;
    category?: string;
    match_score?: number;
    match_reasons?: string[];
    // Eligibility fields
    eligibility_score?: number;
    eligibility_checklist?: Array<{
      field: string;
      status: "pass" | "fail" | "unknown";
      message: string;
    }>;
    eligibility_confidence?: "high" | "medium" | "low";
  }[];
  match_reason: string;
}

export async function fetchRecommendations(
  token: string,
  limit = 10
): Promise<{ items: Grant[]; total: number }> {
  const res = await fetch(`${API_URL}/api/intelligence/recommend?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch recommendations");
  return res.json();
}

export async function fetchTrends(months = 6): Promise<TrendData> {
  const res = await fetch(`${API_URL}/api/intelligence/trends?months=${months}`);
  if (!res.ok) throw new Error("Failed to fetch trends");
  return res.json();
}

export async function fetchMatchResult(profile: {
  industry: string;
  region: string;
  employee_count?: number;
  company_age?: number;
  revenue_range?: string;  // deprecated
  revenue_krw?: number;
  certifications?: string[];
  is_corporate?: boolean;
  is_venture?: boolean;
}): Promise<MatchResult> {
  const res = await fetch(`${API_URL}/api/intelligence/match`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });
  if (!res.ok) throw new Error("Failed to fetch match");
  return res.json();
}

// ─── Briefing API ────────────────────────────────────────

export interface BriefingGrant {
  grant_id: string;
  title: string;
  amount_max?: number;
  end_date?: string;
  days_left?: number;
  eligibility_score?: number;
  eligibility_checklist?: Array<{
    field: string;
    status: "pass" | "fail" | "unknown";
    message: string;
  }>;
  eligibility_confidence?: string;
}

export interface BriefingResponse {
  week_label: string;
  date_label: string;
  company_label: string;
  available_count: number;
  urgent_count: number;
  total_opportunity_krw: number;
  urgent_grants: BriefingGrant[];
  new_grants: BriefingGrant[];
  profile_incomplete: boolean;
  missing_profile_fields: string[];
}

export async function fetchBriefing(token: string): Promise<BriefingResponse> {
  const res = await fetch(`${API_URL}/api/briefing`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch briefing");
  return res.json();
}

// ─── B2B2C API ──────────────────────────────────────────

export interface ClientSummary {
  id: string;
  email: string;
  name?: string;
  company_name?: string;
  industry?: string;
  region?: string;
  onboarding_completed: boolean;
  interest_count: number;
}

export interface ClientInterest {
  id: string;
  user_id: string;
  grant_id: string;
  pipeline_status: string;
  result_type?: string;
  eligibility_status?: string;
  eligibility_detail?: { matched: string[]; missing: string[] };
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ConsultingNote {
  id: string;
  consultant_id: string;
  client_user_id: string;
  grant_id?: string;
  content: string;
  created_at?: string;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body?: string;
  metadata_json: Record<string, string>;
  read_at?: string;
  created_at?: string;
}

export interface DashboardActivity {
  id: string;
  type: string;
  title: string;
  body?: string;
  metadata_json: Record<string, string>;
  created_at?: string;
}

export async function createOrganization(token: string, name: string) {
  const res = await fetch(`${API_URL}/api/organizations`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || "조직 생성 실패");
  return res.json();
}

export async function createInvitation(token: string, email: string) {
  const res = await fetch(`${API_URL}/api/invitations`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || "초대 실패");
  return res.json();
}

export async function validateInviteToken(token: string) {
  const res = await fetch(`${API_URL}/api/invitations/accept/${token}`);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || "초대 검증 실패");
  return res.json();
}

export async function acceptInvitation(token: string) {
  const res = await fetch(`${API_URL}/api/invitations/accept/${token}`, { method: "POST" });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || "초대 수락 실패");
  return res.json();
}

export async function fetchClients(token: string): Promise<ClientSummary[]> {
  const res = await fetch(`${API_URL}/api/clients`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch clients");
  return res.json();
}

export interface ClientDetail {
  id: string;
  email: string;
  name?: string;
  company_name?: string;
  industry?: string;
  region?: string;
  employee_count?: number;
  revenue_krw?: number;
  company_age?: number;
  certifications: string[];
  is_corporate: boolean;
  is_venture: boolean;
  onboarding_completed: boolean;
  created_at?: string;
  interest_count: number;
  activity_count: number;
  note_count: number;
}

export interface ClientActivityItem {
  id: string;
  consultant_id: string;
  client_user_id: string;
  activity_type: string;
  title: string;
  description?: string;
  scheduled_at?: string;
  completed_at?: string;
  created_at?: string;
}

export async function fetchClientDetail(token: string, clientId: string): Promise<ClientDetail> {
  const res = await fetch(`${API_URL}/api/clients/${clientId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch client");
  return res.json();
}

export async function fetchClientInterests(token: string, clientId: string): Promise<ClientInterest[]> {
  const res = await fetch(`${API_URL}/api/clients/${clientId}/interests`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch interests");
  return res.json();
}

export async function fetchClientNotes(token: string, clientId: string): Promise<ConsultingNote[]> {
  const res = await fetch(`${API_URL}/api/clients/${clientId}/notes`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch notes");
  return res.json();
}

export async function updateClient(token: string, clientId: string, data: Partial<UserProfile>) {
  const res = await fetch(`${API_URL}/api/clients/${clientId}`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update client");
  return res.json();
}

export async function fetchClientActivities(token: string, clientId: string): Promise<ClientActivityItem[]> {
  const res = await fetch(`${API_URL}/api/clients/${clientId}/activities`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch activities");
  return res.json();
}

export async function createClientActivity(token: string, clientId: string, data: {
  activity_type: string; title: string; description?: string; scheduled_at?: string;
}) {
  const res = await fetch(`${API_URL}/api/clients/${clientId}/activities`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create activity");
  return res.json();
}

export async function completeActivity(token: string, clientId: string, activityId: string) {
  const res = await fetch(`${API_URL}/api/clients/${clientId}/activities/${activityId}/complete`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to complete activity");
  return res.json();
}

export async function createNote(token: string, clientId: string, content: string, grantId?: string) {
  const res = await fetch(`${API_URL}/api/clients/${clientId}/notes`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ client_user_id: clientId, content, grant_id: grantId }),
  });
  if (!res.ok) throw new Error("Failed to create note");
  return res.json();
}

export async function fetchCalendarActivities(token: string): Promise<ClientActivityItem[]> {
  const res = await fetch(`${API_URL}/api/clients/calendar/activities`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch calendar activities");
  return res.json();
}

export async function fetchDashboardFeed(token: string): Promise<DashboardActivity[]> {
  const res = await fetch(`${API_URL}/api/clients/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch dashboard");
  return res.json();
}

export async function createInterest(token: string, grantId: string, notes?: string) {
  const res = await fetch(`${API_URL}/api/interests`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ grant_id: grantId, notes }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || "관심 등록 실패");
  return res.json();
}

export async function transitionPipeline(token: string, interestId: string, status: string, resultType?: string) {
  const res = await fetch(`${API_URL}/api/interests/${interestId}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({ pipeline_status: status, result_type: resultType }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || "상태 변경 실패");
  return res.json();
}

export async function fetchNotifications(token: string, unread = false): Promise<NotificationItem[]> {
  const res = await fetch(`${API_URL}/api/notifications?unread=${unread}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch notifications");
  return res.json();
}

export async function fetchUnreadCount(token: string): Promise<number> {
  const res = await fetch(`${API_URL}/api/notifications/count`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return 0;
  const data = await res.json();
  return data.count;
}

export async function markNotificationRead(token: string, id: string) {
  await fetch(`${API_URL}/api/notifications/${id}/read`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function markAllNotificationsRead(token: string) {
  await fetch(`${API_URL}/api/notifications/read-all`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}
