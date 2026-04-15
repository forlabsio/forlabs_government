"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Grant } from "@/lib/api";
import { formatDDay, getDDay, formatAmountRange } from "@/lib/format";
import {
  Bookmark,
  AlertTriangle,
  ExternalLink,
  Building2,
  X,
} from "lucide-react";

const F = {
  bg:      "#0B1117",
  panel:   "#1C2B3C",
  card:    "#1F2D3D",
  border:  "rgba(255,255,255,0.08)",
  primary: "#2D72D2",
  glow:    "rgba(45,114,210,0.15)",
  text:    "#F0F4F8",
  muted:   "#7B919E",
  success: "#23A26D",
  warning: "#BF7326",
  danger:  "#C23030",
};

type SortKey = "deadline" | "recent";

export default function BookmarksPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [bookmarks, setBookmarks] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>("deadline");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [hoveredRemove, setHoveredRemove] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    async function load() {
      const token = localStorage.getItem("govgrants_token");
      if (token) {
        try {
          const { fetchBookmarks } = await import("@/lib/api");
          const data = await fetchBookmarks(token);
          setBookmarks(data);
        } catch {
          /* fallback */
        }
      }
      setLoading(false);
    }
    if (user) load();
  }, [user, authLoading, router]);

  async function handleRemove(grantId: string) {
    setRemovingId(grantId);
    const token = localStorage.getItem("govgrants_token");
    if (token) {
      try {
        const { removeBookmark } = await import("@/lib/api");
        await removeBookmark(token, grantId);
      } catch {
        /* ignore */
      }
    }
    setTimeout(() => {
      setBookmarks((prev) => prev.filter((g) => g.id !== grantId));
      setRemovingId(null);
    }, 300);
  }

  const sorted = useMemo(() => {
    const list = [...bookmarks];
    switch (sort) {
      case "deadline":
        return list.sort((a, b) => {
          const da = getDDay(a.end_date);
          const db = getDDay(b.end_date);
          if (da === null) return 1;
          if (db === null) return -1;
          return da - db;
        });
      case "recent":
        return list.sort((a, b) => {
          if (!a.created_at) return 1;
          if (!b.created_at) return -1;
          return b.created_at.localeCompare(a.created_at);
        });
      default:
        return list;
    }
  }, [bookmarks, sort]);

  // Stats
  const urgentCount = bookmarks.filter((g) => {
    const d = getDDay(g.end_date);
    return d !== null && d >= -7 && d <= 0;
  }).length;

  const activeCount = bookmarks.filter(
    (g) => ["접수중", "공고중", "진행중"].includes(g.status ?? "")
  ).length;

  if (authLoading || loading) {
    return (
      <div style={{ height: "calc(100vh - 40px)", overflow: "auto", background: F.bg }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 32px" }}>
          <div style={{ height: 24, width: 180, background: F.card, borderRadius: 4, marginBottom: 24, opacity: 0.6 }} />
          {[...Array(3)].map((_, i) => (
            <div key={i} style={{ height: 52, background: F.card, borderRadius: 4, marginBottom: 1, opacity: 0.4 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: "calc(100vh - 40px)", overflow: "auto", background: F.bg }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 32px" }}>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <Bookmark size={14} color={F.primary} />
            <span style={{ fontSize: 10, color: F.muted, letterSpacing: "0.12em", textTransform: "uppercase" }}>
              SAVED GRANTS
            </span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: F.text, margin: 0, marginBottom: 4 }}>
            관심 과제
          </h1>
          <p style={{ fontSize: 12, color: F.muted, margin: 0 }}>
            {bookmarks.length}개 과제 저장됨
          </p>
        </div>

        {/* Stats row */}
        {bookmarks.length > 0 && (
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <div style={{ background: F.card, border: `1px solid ${F.border}`, borderRadius: 6, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}>
              <Bookmark size={12} color={F.muted} />
              <span style={{ fontSize: 11, color: F.muted }}>전체</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: F.text }}>{bookmarks.length}</span>
            </div>
            <div style={{ background: F.card, border: `1px solid ${F.border}`, borderRadius: 6, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: F.success }}>LIVE</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: F.success }}>{activeCount}</span>
            </div>
            <div style={{ background: F.card, border: `1px solid ${F.border}`, borderRadius: 6, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}>
              <AlertTriangle size={12} color={F.danger} />
              <span style={{ fontSize: 11, color: F.danger }}>7일 이내 마감</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: F.danger }}>{urgentCount}</span>
            </div>
          </div>
        )}

        {/* Sort/Search toolbar */}
        {bookmarks.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            {([
              { key: "deadline", label: "마감순" },
              { key: "recent", label: "최근저장순" },
            ] as { key: SortKey; label: string }[]).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setSort(opt.key)}
                style={{
                  fontSize: 11,
                  padding: "4px 10px",
                  borderRadius: 4,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  background: sort === opt.key ? F.glow : "transparent",
                  color: sort === opt.key ? F.primary : F.muted,
                  border: sort === opt.key
                    ? "1px solid rgba(45,114,210,0.3)"
                    : `1px solid ${F.border}`,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Grant list */}
        {bookmarks.length === 0 ? (
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "80px 32px",
            background: F.card,
            border: `1px solid ${F.border}`,
            borderRadius: 8,
          }}>
            <Bookmark size={48} color={F.muted} style={{ marginBottom: 16 }} />
            <p style={{ fontSize: 14, color: F.muted, margin: 0, marginBottom: 12 }}>
              저장된 관심 과제가 없습니다.
            </p>
            <Link
              href="/grants"
              style={{ fontSize: 13, color: F.primary, textDecoration: "none" }}
            >
              과제 탐색하기
            </Link>
          </div>
        ) : (
          <div style={{
            background: F.card,
            border: `1px solid ${F.border}`,
            borderRadius: 8,
            overflow: "hidden",
          }}>
            {sorted.map((grant, idx) => {
              const dday = getDDay(grant.end_date);
              const isUrgent = dday !== null && dday >= -7 && dday <= 0;
              const isClosed = dday !== null && dday > 0;
              const amount = formatAmountRange(grant.amount_min, grant.amount_max);
              const isRemoving = removingId === grant.id;
              const isHovered = hoveredRow === grant.id;
              const isRemoveHovered = hoveredRemove === grant.id;

              let ddayLabel = "";
              let ddayTop = "";
              if (isClosed) {
                ddayLabel = "마감";
                ddayTop = "";
              } else if (dday === null) {
                ddayLabel = "상시";
                ddayTop = "";
              } else if (dday === 0) {
                ddayLabel = "-Day";
                ddayTop = "D";
              } else {
                ddayLabel = String(dday);
                ddayTop = "D";
              }

              let badgeBg = F.glow;
              let badgeColor = F.primary;
              if (isUrgent) {
                badgeBg = "rgba(194,48,48,0.15)";
                badgeColor = F.danger;
              } else if (isClosed) {
                badgeBg = "rgba(255,255,255,0.05)";
                badgeColor = F.muted;
              }

              return (
                <div
                  key={grant.id}
                  onMouseEnter={() => setHoveredRow(grant.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 14px",
                    height: 52,
                    borderBottom: idx < sorted.length - 1 ? `1px solid ${F.border}` : "none",
                    background: isHovered ? "rgba(255,255,255,0.02)" : "transparent",
                    transition: "opacity 0.3s, transform 0.3s",
                    opacity: isRemoving ? 0 : isClosed ? 0.6 : 1,
                    transform: isRemoving ? "scale(0.98)" : "none",
                    boxSizing: "border-box",
                  }}
                >
                  {/* D-day badge */}
                  <div style={{
                    width: 44,
                    height: 28,
                    flexShrink: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 4,
                    background: badgeBg,
                    lineHeight: 1,
                  }}>
                    {ddayTop && (
                      <span style={{ fontSize: 8, color: badgeColor, fontWeight: 600 }}>
                        {ddayTop}
                      </span>
                    )}
                    <span style={{ fontSize: ddayTop ? 11 : 10, color: badgeColor, fontWeight: 700 }}>
                      {ddayLabel}
                    </span>
                  </div>

                  {/* Title */}
                  <Link
                    href={`/grants/${grant.id}`}
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: F.text,
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      textDecoration: "none",
                      minWidth: 0,
                    }}
                  >
                    {grant.title}
                  </Link>

                  {/* Org */}
                  {grant.organization && (
                    <span style={{
                      fontSize: 11,
                      color: F.muted,
                      width: 140,
                      flexShrink: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}>
                      <Building2 size={11} color={F.muted} style={{ flexShrink: 0 }} />
                      {grant.organization}
                    </span>
                  )}

                  {/* Amount */}
                  {amount && amount !== "금액 미정" && (
                    <span style={{ fontSize: 11, color: F.primary, width: 80, flexShrink: 0, textAlign: "right" }}>
                      {amount}
                    </span>
                  )}

                  {/* External link */}
                  {grant.detail_url && (
                    <a
                      href={grant.detail_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="원문 보기"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 28,
                        height: 28,
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: F.muted,
                        flexShrink: 0,
                      }}
                    >
                      <ExternalLink size={13} />
                    </a>
                  )}

                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => handleRemove(grant.id)}
                    onMouseEnter={() => setHoveredRemove(grant.id)}
                    onMouseLeave={() => setHoveredRemove(null)}
                    title="관심 과제 제거"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 28,
                      height: 28,
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: isRemoveHovered ? F.danger : F.muted,
                      flexShrink: 0,
                      transition: "color 0.15s",
                    }}
                  >
                    <X size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
