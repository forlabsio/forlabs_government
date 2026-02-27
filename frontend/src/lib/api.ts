const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface Grant {
  id: string;
  title: string;
  organization: string;
  category: string;
  region: string;
  amount_min?: number;
  amount_max?: number;
  deadline?: string;
  description?: string;
  eligibility?: string;
  source: string;
  source_url?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface GrantListResponse {
  items: Grant[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface SearchResponse {
  results: Grant[];
  total: number;
  query: string;
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
  page?: number;
}): Promise<SearchResponse> {
  const res = await fetch(`${API_URL}/api/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to search");
  return res.json();
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
  const res = await fetch(`${API_URL}/api/admin/collect`, {
    method: "POST",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to trigger collect");
  return res.json();
}
