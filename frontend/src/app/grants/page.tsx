"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { fetchGrants, searchGrants, type Grant } from "@/lib/api";
import { formatDDay, getDDay } from "@/lib/format";
import { ChevronLeft, ChevronRight, ChevronDown, X, Search } from "lucide-react";
import Link from "next/link";
import { FOUNDRY } from "@/lib/theme";

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

const PAGE_SIZE = 20;

/* ── Foundry FilterDropdown ── */
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
  const isActive = Boolean(value);

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          background: isActive ? FOUNDRY.glow : "transparent",
          border: `1px solid ${isActive ? FOUNDRY.primary : FOUNDRY.border}`,
          borderRadius: 4,
          color: isActive ? FOUNDRY.primary : FOUNDRY.muted,
          padding: "5px 10px",
          fontSize: 11,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {displayLabel}
        <ChevronDown size={11} />
      </button>
      {open && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 10 }}
            onClick={() => setOpen(false)}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              top: "calc(100% + 4px)",
              zIndex: 20,
              background: FOUNDRY.card,
              border: `1px solid ${FOUNDRY.border}`,
              borderRadius: 6,
              padding: "4px 0",
              minWidth: 140,
              maxHeight: 240,
              overflowY: "auto",
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            }}
          >
            {options.map((opt) => (
              <button
                key={opt.value || "__all__"}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "6px 12px",
                  textAlign: "left",
                  fontSize: 12,
                  background: value === opt.value ? FOUNDRY.glow : "transparent",
                  color: value === opt.value ? FOUNDRY.primary : FOUNDRY.text,
                  border: "none",
                  cursor: "pointer",
                }}
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

/* ── Amount formatter: abbreviated Korean format ── */
function formatAmountShort(amount: number | undefined): string {
  if (!amount) return "—";
  if (amount >= 100000000) {
    const eok = amount / 100000000;
    return Number.isInteger(eok) ? `${eok}억` : `${eok.toFixed(1)}억`;
  }
  if (amount >= 10000) {
    return `${Math.round(amount / 10000)}만`;
  }
  return `${amount.toLocaleString()}`;
}

/* ── D-day color helper ── */
function getDDayHexColor(dday: number | null): string {
  if (dday === null) return FOUNDRY.muted;
  if (dday > 0) return FOUNDRY.muted;        // expired
  if (dday >= -7) return FOUNDRY.danger;     // urgent (≤7 days)
  return FOUNDRY.primary;                    // normal
}

// Column widths
const COL = {
  dday:     70,
  title:    "1 1 0%",  // flex value
  org:      160,
  category: 100,
  amount:   100,
  status:   70,
};

const HEADER_TEXT: React.CSSProperties = {
  fontSize: 9,
  color: FOUNDRY.muted,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontWeight: 600,
};

const ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  height: 44,
  padding: "0 16px",
  borderBottom: `1px solid ${FOUNDRY.border}`,
  cursor: "pointer",
  textDecoration: "none",
  gap: 0,
};

function GrantListContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

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
  const [searchInput, setSearchInput] = useState(q);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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
          page_size: String(PAGE_SIZE),
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

  // Sync search input with URL param
  useEffect(() => {
    setSearchInput(q);
  }, [q]);

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

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (searchInput.trim()) {
      params.set("q", searchInput.trim());
    } else {
      params.delete("q");
    }
    params.delete("page");
    router.push(`/grants?${params.toString()}`);
  }

  const hasActiveFilters = category || source || statusFilter || region;

  return (
    <div
      style={{
        background: FOUNDRY.bg,
        minHeight: "100vh",
        padding: "16px 20px",
      }}
    >
      {/* ── Page header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: FOUNDRY.text,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          Grants
        </span>
        {!loading && (
          <span style={{ fontSize: 11, color: FOUNDRY.muted }}>
            {total.toLocaleString()} results
          </span>
        )}
        {loading && (
          <span style={{ fontSize: 11, color: FOUNDRY.muted }}>loading...</span>
        )}
      </div>

      {/* ── Filter / search row ── */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
        }}
      >
        {/* Search input */}
        <form onSubmit={handleSearchSubmit} style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: FOUNDRY.card,
              border: `1px solid ${FOUNDRY.border}`,
              borderRadius: 4,
              padding: "5px 10px",
              gap: 6,
            }}
          >
            <Search size={12} style={{ color: FOUNDRY.muted, flexShrink: 0 }} />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="검색..."
              style={{
                background: "transparent",
                border: "none",
                outline: "none",
                fontSize: 12,
                color: FOUNDRY.text,
                width: 160,
              }}
            />
          </div>
        </form>

        {/* Category filter */}
        <FilterDropdown
          label="카테고리"
          value={category}
          options={CATEGORIES}
          onChange={(v) => updateParam("category", v)}
        />

        {/* Status filter */}
        <FilterDropdown
          label="상태"
          value={statusFilter}
          options={STATUSES}
          onChange={(v) => updateParam("status", v)}
        />

        {/* Source filter */}
        <FilterDropdown
          label="출처"
          value={source}
          options={SOURCES}
          onChange={(v) => updateParam("source", v)}
        />

        {/* Region filter */}
        <FilterDropdown
          label="지역"
          value={region}
          options={REGIONS}
          onChange={(v) => updateParam("region", v)}
        />

        {/* Sort */}
        <div
          style={{
            display: "flex",
            background: FOUNDRY.card,
            border: `1px solid ${FOUNDRY.border}`,
            borderRadius: 4,
            overflow: "hidden",
          }}
        >
          {SORTS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => updateParam("sort", s.value)}
              style={{
                padding: "5px 10px",
                fontSize: 11,
                border: "none",
                cursor: "pointer",
                background: sort === s.value ? FOUNDRY.primary : "transparent",
                color: sort === s.value ? FOUNDRY.text : FOUNDRY.muted,
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAllFilters}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: "transparent",
              border: "none",
              color: FOUNDRY.muted,
              fontSize: 11,
              cursor: "pointer",
              padding: "5px 6px",
            }}
          >
            <X size={11} />
            초기화
          </button>
        )}

        {/* Query chip */}
        {q && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              background: FOUNDRY.glow,
              border: `1px solid ${FOUNDRY.primary}`,
              borderRadius: 4,
              padding: "3px 8px",
              fontSize: 11,
              color: FOUNDRY.primary,
            }}
          >
            <span>&ldquo;{q}&rdquo;</span>
            <button
              type="button"
              onClick={() => updateParam("q", "")}
              style={{ background: "none", border: "none", cursor: "pointer", color: FOUNDRY.primary, padding: 0, lineHeight: 1 }}
            >
              <X size={10} />
            </button>
          </div>
        )}
      </div>

      {/* ── Dense Data Table ── */}
      <div
        style={{
          background: "transparent",
          border: `1px solid ${FOUNDRY.border}`,
          borderRadius: 6,
          overflow: "hidden",
        }}
      >
        {/* Table header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "8px 16px",
            background: FOUNDRY.card,
            borderBottom: `1px solid ${FOUNDRY.border}`,
            gap: 0,
          }}
        >
          <div style={{ ...HEADER_TEXT, width: COL.dday, flexShrink: 0 }}>D-DAY</div>
          <div style={{ ...HEADER_TEXT, flex: "1 1 0%" }}>제목</div>
          <div style={{ ...HEADER_TEXT, width: COL.org, flexShrink: 0 }}>기관</div>
          <div style={{ ...HEADER_TEXT, width: COL.category, flexShrink: 0 }}>카테고리</div>
          <div style={{ ...HEADER_TEXT, width: COL.amount, flexShrink: 0 }}>최대금액</div>
          <div style={{ ...HEADER_TEXT, width: COL.status, flexShrink: 0 }}>상태</div>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div>
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "10px 16px",
                  borderBottom: `1px solid ${FOUNDRY.border}`,
                  gap: 0,
                }}
              >
                <div
                  style={{
                    width: COL.dday - 16,
                    height: 14,
                    flexShrink: 0,
                    marginRight: 16,
                    borderRadius: 3,
                    background: "rgba(255,255,255,0.06)",
                    animation: "pulse 1.5s ease-in-out infinite",
                  }}
                />
                <div
                  style={{
                    flex: "1 1 0%",
                    height: 14,
                    borderRadius: 3,
                    background: "rgba(255,255,255,0.06)",
                    animation: "pulse 1.5s ease-in-out infinite",
                  }}
                />
                <div
                  style={{
                    width: COL.org - 16,
                    height: 14,
                    flexShrink: 0,
                    marginLeft: 16,
                    borderRadius: 3,
                    background: "rgba(255,255,255,0.06)",
                    animation: "pulse 1.5s ease-in-out infinite",
                  }}
                />
                <div
                  style={{
                    width: COL.category - 16,
                    height: 14,
                    flexShrink: 0,
                    marginLeft: 16,
                    borderRadius: 3,
                    background: "rgba(255,255,255,0.06)",
                    animation: "pulse 1.5s ease-in-out infinite",
                  }}
                />
                <div
                  style={{
                    width: COL.amount - 16,
                    height: 14,
                    flexShrink: 0,
                    marginLeft: 16,
                    borderRadius: 3,
                    background: "rgba(255,255,255,0.06)",
                    animation: "pulse 1.5s ease-in-out infinite",
                  }}
                />
                <div
                  style={{
                    width: COL.status - 8,
                    height: 14,
                    flexShrink: 0,
                    marginLeft: 8,
                    borderRadius: 3,
                    background: "rgba(255,255,255,0.06)",
                    animation: "pulse 1.5s ease-in-out infinite",
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && grants.length === 0 && (
          <div
            style={{
              padding: "60px 20px",
              textAlign: "center",
              color: FOUNDRY.muted,
            }}
          >
            <p style={{ fontSize: 14 }}>검색 결과가 없습니다</p>
            <p style={{ fontSize: 12, marginTop: 6 }}>다른 검색어나 필터를 시도해보세요</p>
          </div>
        )}

        {/* Data rows */}
        {!loading && grants.length > 0 && (
          <div>
            {grants.map((grant) => {
              const dday = getDDay(grant.end_date);
              const ddayText = formatDDay(grant.end_date);
              const ddayColor = getDDayHexColor(dday);
              const isClosed = dday !== null && dday > 0;

              return (
                <Link
                  key={grant.id}
                  href={`/grants/${grant.id}`}
                  style={{
                    ...ROW_STYLE,
                    opacity: isClosed ? 0.5 : 1,
                    background: hoveredId === grant.id ? "rgba(255,255,255,0.03)" : "transparent",
                  }}
                  onMouseEnter={() => setHoveredId(grant.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {/* D-DAY */}
                  <div
                    style={{
                      width: COL.dday,
                      flexShrink: 0,
                      fontFamily: "ui-monospace, SFMono-Regular, monospace",
                      fontSize: 12,
                      fontWeight: 600,
                      color: ddayColor,
                    }}
                  >
                    {ddayText}
                  </div>

                  {/* 제목 */}
                  <div
                    style={{
                      flex: "1 1 0%",
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontSize: 13,
                      color: FOUNDRY.text,
                    }}
                  >
                    {grant.title}
                  </div>

                  {/* 기관 */}
                  <div
                    style={{
                      width: COL.org,
                      flexShrink: 0,
                      paddingLeft: 12,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontSize: 11,
                      color: FOUNDRY.muted,
                    }}
                  >
                    {grant.organization || "—"}
                  </div>

                  {/* 카테고리 */}
                  <div
                    style={{
                      width: COL.category,
                      flexShrink: 0,
                      paddingLeft: 12,
                    }}
                  >
                    {grant.category ? (
                      <span
                        style={{
                          background: FOUNDRY.border,
                          color: FOUNDRY.muted,
                          borderRadius: 3,
                          padding: "2px 6px",
                          fontSize: 10,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {grant.category}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: FOUNDRY.muted }}>—</span>
                    )}
                  </div>

                  {/* 최대금액 */}
                  <div
                    style={{
                      width: COL.amount,
                      flexShrink: 0,
                      paddingLeft: 12,
                      fontFamily: "ui-monospace, SFMono-Regular, monospace",
                      fontSize: 12,
                      color: grant.amount_max ? FOUNDRY.text : FOUNDRY.muted,
                    }}
                  >
                    {formatAmountShort(grant.amount_max)}
                  </div>

                  {/* 상태 */}
                  <div
                    style={{
                      width: COL.status,
                      flexShrink: 0,
                      paddingLeft: 8,
                      fontSize: 11,
                      fontWeight: 500,
                      color:
                        grant.status === "접수중"
                          ? FOUNDRY.success
                          : grant.status === "진행중"
                          ? FOUNDRY.primary
                          : FOUNDRY.muted,
                    }}
                  >
                    {grant.status === "접수중" ? (
                      <>● LIVE</>
                    ) : grant.status === "마감" ? (
                      <>● 마감</>
                    ) : grant.status === "진행중" ? (
                      <>● 진행중</>
                    ) : grant.status ? (
                      grant.status
                    ) : (
                      "—"
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            marginTop: 20,
          }}
        >
          {currentPage > 1 && (
            <a
              href={buildPageUrl(currentPage - 1)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "5px 10px",
                background: "transparent",
                border: `1px solid ${FOUNDRY.border}`,
                borderRadius: 4,
                fontSize: 11,
                color: FOUNDRY.muted,
                textDecoration: "none",
              }}
            >
              <ChevronLeft size={12} />
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
            const isCurrent = page === currentPage;
            return (
              <a
                key={page}
                href={buildPageUrl(page)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 32,
                  height: 32,
                  background: isCurrent ? FOUNDRY.primary : "transparent",
                  border: `1px solid ${isCurrent ? FOUNDRY.primary : FOUNDRY.border}`,
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: isCurrent ? 600 : 400,
                  color: isCurrent ? FOUNDRY.text : FOUNDRY.muted,
                  textDecoration: "none",
                }}
              >
                {page}
              </a>
            );
          })}

          {currentPage < totalPages && (
            <a
              href={buildPageUrl(currentPage + 1)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "5px 10px",
                background: "transparent",
                border: `1px solid ${FOUNDRY.border}`,
                borderRadius: 4,
                fontSize: 11,
                color: FOUNDRY.muted,
                textDecoration: "none",
              }}
            >
              다음
              <ChevronRight size={12} />
            </a>
          )}
        </div>
      )}

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

export default function GrantListPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            background: FOUNDRY.bg,
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              border: `2px solid ${FOUNDRY.primary}`,
              borderTopColor: "transparent",
              animation: "spin 0.7s linear infinite",
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      }
    >
      <GrantListContent />
    </Suspense>
  );
}
