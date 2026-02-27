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
