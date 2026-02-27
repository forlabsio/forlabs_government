"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import SearchBar from "@/components/SearchBar";
import FilterBar from "@/components/FilterBar";
import GrantCard from "@/components/GrantCard";
import { fetchGrants, searchGrants, type Grant } from "@/lib/api";
import { ChevronLeft, ChevronRight, ListFilter } from "lucide-react";

function GrantListContent() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") || "";
  const category = searchParams.get("category") || "";
  const region = searchParams.get("region") || "";
  const sort = searchParams.get("sort") || "";
  const pageParam = searchParams.get("page") || "1";
  const currentPage = Math.max(1, parseInt(pageParam, 10) || 1);

  const [grants, setGrants] = useState<Grant[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const loadGrants = useCallback(async () => {
    setLoading(true);
    try {
      if (q) {
        // Use search endpoint for natural language queries
        const res = await searchGrants({ query: q, page: currentPage });
        setGrants(res.results || []);
        setTotal(res.total || 0);
        setTotalPages(Math.ceil((res.total || 0) / 12));
      } else {
        // Use regular grants endpoint with filters
        const params: Record<string, string> = {
          page: String(currentPage),
          size: "12",
        };
        if (category) params.category = category;
        if (region) params.region = region;
        if (sort) params.sort = sort;

        const res = await fetchGrants(params);
        setGrants(res.items || []);
        setTotal(res.total || 0);
        setTotalPages(res.pages || 1);
      }
    } catch {
      setGrants([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [q, category, region, sort, currentPage]);

  useEffect(() => {
    loadGrants();
  }, [loadGrants]);

  function buildPageUrl(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    return `/grants?${params.toString()}`;
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            지원사업 찾기
          </h1>
          <p className="mt-2 text-gray-500">
            우리 기업에 맞는 정부 지원사업을 검색하세요
          </p>
        </div>

        {/* Search */}
        <div className="mb-6">
          <SearchBar defaultValue={q} />
        </div>

        {/* Filters */}
        <div className="mb-6">
          <FilterBar />
        </div>

        {/* Results Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <ListFilter className="h-4 w-4" />
            {loading ? (
              <span>검색 중...</span>
            ) : (
              <span>
                총 <span className="font-semibold text-gray-900">{total.toLocaleString()}</span>개 지원사업
                {q && (
                  <>
                    {" "}
                    &middot; &ldquo;{q}&rdquo; 검색 결과
                  </>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Grant Grid */}
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="h-64 animate-pulse rounded-xl bg-white"
              />
            ))}
          </div>
        ) : grants.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {grants.map((grant) => (
              <GrantCard key={grant.id} grant={grant} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white py-20 text-center">
            <p className="text-lg font-medium text-gray-400">
              검색 결과가 없습니다
            </p>
            <p className="mt-2 text-sm text-gray-400">
              다른 검색어나 필터를 시도해보세요
            </p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            {currentPage > 1 && (
              <a
                href={buildPageUrl(currentPage - 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                <ChevronLeft className="h-4 w-4" />
                이전
              </a>
            )}

            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let page: number;
              if (totalPages <= 5) {
                page = i + 1;
              } else if (currentPage <= 3) {
                page = i + 1;
              } else if (currentPage >= totalPages - 2) {
                page = totalPages - 4 + i;
              } else {
                page = currentPage - 2 + i;
              }
              return (
                <a
                  key={page}
                  href={buildPageUrl(page)}
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                    page === currentPage
                      ? "bg-blue-600 text-white"
                      : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {page}
                </a>
              );
            })}

            {currentPage < totalPages && (
              <a
                href={buildPageUrl(currentPage + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                다음
                <ChevronRight className="h-4 w-4" />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function GrantListPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      }
    >
      <GrantListContent />
    </Suspense>
  );
}
