"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import SearchBar from "@/components/SearchBar";
import { fetchGrants, searchGrants, type Grant } from "@/lib/api";
import {
  formatDDay,
  getDDay,
  formatAmountRange,
  formatShortDate,
} from "@/lib/format";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ListFilter,
  Building2,
  LayoutGrid,
  LayoutList,
  Bookmark,
  Eye,
  Calendar,
  X,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

const CATEGORIES = [
  { label: "전체", value: "" },
  { label: "자금", value: "자금" },
  { label: "R&D", value: "R&D" },
  { label: "보조금", value: "보조금" },
  { label: "인력", value: "인력" },
  { label: "창업", value: "창업" },
  { label: "교육", value: "교육" },
  { label: "수출", value: "수출" },
  { label: "기타", value: "기타" },
];

const SORTS = [
  { label: "마감순", value: "deadline" },
  { label: "최신순", value: "recent" },
  { label: "금액순", value: "amount" },
];

const SOURCES = [
  { label: "전체 출처", value: "" },
  { label: "기업마당", value: "bizinfo" },
  { label: "KOCCA", value: "kocca" },
  { label: "K-Startup", value: "kstartup" },
  { label: "보조금24", value: "subsidy24" },
  { label: "중소벤처24", value: "smes" },
];

const STATUSES = [
  { label: "전체 상태", value: "" },
  { label: "접수중", value: "접수중" },
  { label: "진행중", value: "진행중" },
  { label: "마감", value: "마감" },
];

const REGIONS = [
  { label: "전체 지역", value: "" },
  { label: "서울", value: "서울" },
  { label: "경기", value: "경기" },
  { label: "인천", value: "인천" },
  { label: "부산", value: "부산" },
  { label: "대구", value: "대구" },
  { label: "광주", value: "광주" },
  { label: "대전", value: "대전" },
  { label: "울산", value: "울산" },
  { label: "세종", value: "세종" },
  { label: "강원", value: "강원" },
  { label: "충북", value: "충북" },
  { label: "충남", value: "충남" },
  { label: "전북", value: "전북" },
  { label: "전남", value: "전남" },
  { label: "경북", value: "경북" },
  { label: "경남", value: "경남" },
  { label: "제주", value: "제주" },
];

const SOURCE_LABELS: Record<string, string> = {
  bizinfo: "기업마당",
  kocca: "KOCCA",
  kstartup: "K-Startup",
  subsidy24: "보조금24",
  smes: "중소벤처24",
};

const SOURCE_COLORS: Record<string, string> = {
  bizinfo: "text-blue-700 bg-blue-50",
  kocca: "text-orange-700 bg-orange-50",
  kstartup: "text-indigo-700 bg-indigo-50",
  subsidy24: "text-pink-700 bg-pink-50",
  smes: "text-purple-700 bg-purple-50",
};

const PAGE_SIZE = 20;

/* ── Dropdown filter component ── */
function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const displayLabel = value ? selected?.label || value : label;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
          value
            ? "border-blue-200 bg-blue-50 text-blue-700"
            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
        }`}
      >
        {displayLabel}
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 max-h-60 w-40 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            {options.map((opt) => (
              <button
                key={opt.value || "__all__"}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`block w-full px-3 py-2 text-left text-xs transition-colors ${
                  value === opt.value
                    ? "bg-blue-50 font-semibold text-blue-700"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function GrantListContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const q = searchParams.get("q") || "";
  const category = searchParams.get("category") || "";
  const sort = searchParams.get("sort") || "deadline";
  const source = searchParams.get("source") || "";
  const statusFilter = searchParams.get("status") || "";
  const region = searchParams.get("region") || "";
  const pageParam = searchParams.get("page") || "1";
  const currentPage = Math.max(1, parseInt(pageParam, 10) || 1);

  const [grants, setGrants] = useState<Grant[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "grid">("list");

  const loadGrants = useCallback(async () => {
    setLoading(true);
    try {
      if (q) {
        const res = await searchGrants({
          query: q,
          category: category || undefined,
          region: region || undefined,
          source: source || undefined,
          page: currentPage,
          page_size: PAGE_SIZE,
        });
        setGrants(res.items || []);
        setTotal(res.total || 0);
        setTotalPages(Math.ceil((res.total || 0) / PAGE_SIZE));
      } else {
        const params: Record<string, string> = {
          page: String(currentPage),
          size: String(PAGE_SIZE),
        };
        if (category) params.category = category;
        if (sort) params.sort = sort;
        if (source) params.source = source;
        if (statusFilter) params.status = statusFilter;
        if (region) params.region = region;

        const res = await fetchGrants(params);
        setGrants(res.items || []);
        setTotal(res.total || 0);
        setTotalPages(Math.ceil((res.total || 0) / PAGE_SIZE));
      }
    } catch {
      setGrants([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [q, category, sort, source, statusFilter, region, currentPage]);

  useEffect(() => {
    loadGrants();
  }, [loadGrants]);

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    router.push(`/grants?${params.toString()}`);
  }

  function clearAllFilters() {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    router.push(`/grants?${params.toString()}`);
  }

  function buildPageUrl(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    return `/grants?${params.toString()}`;
  }

  async function handleBookmark(grantId: string) {
    const token = localStorage.getItem("govgrants_token");
    if (!token) {
      router.push("/login");
      return;
    }
    try {
      const { addBookmark } = await import("@/lib/api");
      await addBookmark(token, grantId);
    } catch {
      /* ignore */
    }
  }

  const hasActiveFilters = category || source || statusFilter || region;

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="mx-auto max-w-screen-xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Search */}
        <div className="mb-5">
          <SearchBar defaultValue={q} />
        </div>

        {/* Category chips */}
        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value || "all"}
              type="button"
              onClick={() => updateParam("category", cat.value)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all sm:text-sm ${
                category === cat.value
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white text-gray-600 hover:bg-gray-100"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Filters Row: dropdowns + sort + view toggle */}
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <FilterDropdown
              label="출처"
              value={source}
              options={SOURCES}
              onChange={(v) => updateParam("source", v)}
            />
            <FilterDropdown
              label="상태"
              value={statusFilter}
              options={STATUSES}
              onChange={(v) => updateParam("status", v)}
            />
            <FilterDropdown
              label="지역"
              value={region}
              options={REGIONS}
              onChange={(v) => updateParam("region", v)}
            />
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:text-red-500"
              >
                <X className="h-3.5 w-3.5" />
                초기화
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex gap-0.5 rounded-lg bg-white p-0.5 shadow-sm">
              {SORTS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => updateParam("sort", s.value)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    sort === s.value
                      ? "bg-gray-900 text-white"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="hidden gap-0.5 rounded-lg bg-white p-0.5 shadow-sm sm:flex">
              <button
                type="button"
                title="리스트 보기"
                onClick={() => setView("list")}
                className={`rounded-md p-1.5 ${
                  view === "list"
                    ? "bg-gray-900 text-white"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <LayoutList className="h-4 w-4" />
              </button>
              <button
                type="button"
                title="그리드 보기"
                onClick={() => setView("grid")}
                className={`rounded-md p-1.5 ${
                  view === "grid"
                    ? "bg-gray-900 text-white"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Results count */}
        <div className="mb-3 flex items-center gap-2 text-xs text-gray-400">
          <ListFilter className="h-3.5 w-3.5" />
          {loading ? (
            <span>검색 중...</span>
          ) : (
            <span>
              총{" "}
              <span className="font-semibold text-gray-600">
                {total.toLocaleString()}
              </span>
              개
              {q && <> &middot; &ldquo;{q}&rdquo;</>}
            </span>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            {[...Array(10)].map((_, i) => (
              <div
                key={i}
                className="h-14 animate-pulse border-b border-gray-50 px-4 py-3"
              >
                <div className="h-4 w-2/3 rounded bg-gray-100" />
              </div>
            ))}
          </div>
        ) : grants.length > 0 ? (
          view === "list" ? (
            /* ===== LIST VIEW ===== */
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              {/* Table header - desktop */}
              <div className="hidden border-b border-gray-100 bg-gray-50/50 px-5 py-2.5 text-[10px] font-medium uppercase tracking-wider text-gray-400 lg:grid lg:grid-cols-24 lg:gap-3">
                <div className="col-span-2 text-center">D-Day</div>
                <div className="col-span-10 text-center">사업명</div>
                <div className="col-span-3 text-center">기관</div>
                <div className="col-span-2 text-center">지원금</div>
                <div className="col-span-3 text-center">기간</div>
                <div className="col-span-2 text-center">출처</div>
                <div className="col-span-2 text-center">상태</div>
              </div>

              <div className="divide-y divide-gray-50">
                {grants.map((grant) => {
                  const dday = getDDay(grant.end_date);
                  const ddayText = formatDDay(grant.end_date);
                  const isUrgent = dday !== null && dday >= -7 && dday <= 0;
                  const isClosed = dday !== null && dday > 0;
                  const amount = formatAmountRange(
                    grant.amount_min,
                    grant.amount_max
                  );
                  const src = grant.sources?.[0] || "default";

                  return (
                    <div
                      key={grant.id}
                      className={`group relative transition-colors hover:bg-blue-50/30 ${
                        isClosed ? "opacity-50" : ""
                      }`}
                    >
                      <Link href={`/grants/${grant.id}`} className="block">
                        {/* Mobile */}
                        <div className="flex items-center gap-3 px-4 py-3 lg:hidden">
                          <div
                            className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg text-center text-[10px] font-bold leading-tight ${
                              isClosed
                                ? "bg-gray-100 text-gray-400"
                                : isUrgent
                                ? "bg-red-50 text-red-600"
                                : dday !== null
                                ? "bg-blue-50 text-blue-600"
                                : "bg-gray-50 text-gray-500"
                            }`}
                          >
                            {ddayText}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-gray-900 group-hover:text-blue-600">
                              {grant.title}
                            </p>
                            <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                              {grant.organization && (
                                <span className="truncate">
                                  {grant.organization}
                                </span>
                              )}
                              {amount && amount !== "금액 미정" && (
                                <span className="shrink-0 font-medium text-blue-600">
                                  {amount}
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 flex items-center gap-2 text-[10px] text-gray-400">
                              <span className="flex items-center gap-0.5">
                                <Calendar className="h-2.5 w-2.5" />
                                {formatShortDate(grant.start_date)} ~ {formatShortDate(grant.end_date)}
                              </span>
                              <span className="flex items-center gap-0.5">
                                <Eye className="h-2.5 w-2.5" />
                                {(grant.view_count || 0).toLocaleString()}
                              </span>
                              <span
                                className={`rounded px-1 py-0.5 text-[9px] font-medium ${
                                  SOURCE_COLORS[src] || "bg-gray-50 text-gray-500"
                                }`}
                              >
                                {SOURCE_LABELS[src] || src}
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
                        </div>

                        {/* Desktop */}
                        <div className="hidden items-center gap-3 px-5 py-2.5 lg:grid lg:grid-cols-24">
                          {/* D-Day */}
                          <div className="col-span-2 text-center">
                            <span
                              className={`inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-bold ${
                                isClosed
                                  ? "bg-gray-100 text-gray-400"
                                  : isUrgent
                                  ? "bg-red-50 text-red-600"
                                  : dday !== null
                                  ? "bg-blue-50 text-blue-600"
                                  : "bg-gray-50 text-gray-500"
                              }`}
                            >
                              {ddayText}
                            </span>
                          </div>
                          {/* Title */}
                          <div className="col-span-10 min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-900 group-hover:text-blue-600">
                              {grant.title}
                            </p>
                            {grant.category && (
                              <span className="text-[11px] text-gray-400">
                                {grant.category}
                              </span>
                            )}
                          </div>
                          {/* Organization */}
                          <div className="col-span-3 min-w-0">
                            <p className="flex items-center gap-1 truncate text-xs text-gray-500">
                              <Building2 className="h-3 w-3 shrink-0" />
                              {grant.organization || "-"}
                            </p>
                          </div>
                          {/* Amount */}
                          <div className="col-span-2 text-right">
                            {amount && amount !== "금액 미정" ? (
                              <span className="text-xs font-bold text-blue-600">
                                {amount}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-300">-</span>
                            )}
                          </div>
                          {/* Period (start ~ end) */}
                          <div className="col-span-3 text-center text-[11px] text-gray-400">
                            {formatShortDate(grant.start_date)} ~ {formatShortDate(grant.end_date)}
                          </div>
                          {/* Source */}
                          <div className="col-span-2 text-center">
                            <span
                              className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                SOURCE_COLORS[src] ||
                                "bg-gray-50 text-gray-500"
                              }`}
                            >
                              {SOURCE_LABELS[src] || src}
                            </span>
                          </div>
                          {/* Status */}
                          <div className="col-span-2 text-center">
                            {grant.status && (
                              <span
                                className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                  grant.status === "접수중"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : grant.status === "진행중"
                                    ? "bg-blue-50 text-blue-700"
                                    : "bg-gray-100 text-gray-500"
                                }`}
                              >
                                {grant.status}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>

                      {/* Bookmark button (desktop hover) */}
                      {user && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            handleBookmark(grant.id);
                          }}
                          className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-lg p-1.5 text-gray-300 transition-all hover:bg-blue-50 hover:text-blue-500 group-hover:lg:block"
                          title="관심 사업"
                        >
                          <Bookmark className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ===== GRID VIEW ===== */
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {grants.map((grant) => {
                const ddayText = formatDDay(grant.end_date);
                const dday = getDDay(grant.end_date);
                const isUrgent = dday !== null && dday >= -7 && dday <= 0;
                const isClosed = dday !== null && dday > 0;
                const amount = formatAmountRange(
                  grant.amount_min,
                  grant.amount_max
                );
                const src = grant.sources?.[0] || "default";

                return (
                  <Link
                    key={grant.id}
                    href={`/grants/${grant.id}`}
                    className="group block"
                  >
                    <article
                      className={`flex h-full flex-col rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                        isClosed ? "opacity-50" : ""
                      }`}
                    >
                      <div className="mb-3 flex items-start justify-between">
                        <span
                          className={`rounded-md px-2 py-1 text-xs font-bold ${
                            isClosed
                              ? "bg-gray-100 text-gray-400"
                              : isUrgent
                              ? "bg-red-50 text-red-600"
                              : dday !== null
                              ? "bg-blue-50 text-blue-600"
                              : "bg-gray-50 text-gray-500"
                          }`}
                        >
                          {ddayText}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            SOURCE_COLORS[src] || "bg-gray-50 text-gray-500"
                          }`}
                        >
                          {SOURCE_LABELS[src] || src}
                        </span>
                      </div>
                      <h3 className="mb-1.5 line-clamp-2 text-sm font-semibold text-gray-900 group-hover:text-blue-600">
                        {grant.title}
                      </h3>
                      <p className="mb-2 text-xs text-gray-500">
                        {grant.organization}
                      </p>
                      {/* Dates row */}
                      <div className="mb-3 flex items-center gap-3 text-[10px] text-gray-400">
                        <span className="flex items-center gap-0.5">
                          <Calendar className="h-2.5 w-2.5" />
                          {formatShortDate(grant.start_date)} ~ {formatShortDate(grant.end_date)}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Eye className="h-2.5 w-2.5" />
                          {(grant.view_count || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="mt-auto" />
                      {amount && amount !== "금액 미정" && (
                        <p className="mb-2 text-base font-bold text-blue-600">
                          {amount}
                        </p>
                      )}
                      <div className="flex items-center gap-1.5">
                        {grant.category && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                            {grant.category}
                          </span>
                        )}
                        {grant.status && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              grant.status === "접수중"
                                ? "bg-green-50 text-green-700"
                                : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {grant.status}
                          </span>
                        )}
                      </div>
                    </article>
                  </Link>
                );
              })}
            </div>
          )
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-20 text-center">
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
          <div className="mt-6 flex items-center justify-center gap-1.5">
            {currentPage > 1 && (
              <a
                href={buildPageUrl(currentPage - 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                이전
              </a>
            )}

            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let page: number;
              if (totalPages <= 7) {
                page = i + 1;
              } else if (currentPage <= 4) {
                page = i + 1;
              } else if (currentPage >= totalPages - 3) {
                page = totalPages - 6 + i;
              } else {
                page = currentPage - 3 + i;
              }
              return (
                <a
                  key={page}
                  href={buildPageUrl(page)}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-xs font-medium transition-colors ${
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
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                다음
                <ChevronRight className="h-3.5 w-3.5" />
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
