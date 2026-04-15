"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchGrants, fetchBriefing, type Grant, type BriefingResponse } from "@/lib/api";
import { formatDDay, getDDay } from "@/lib/format";
import { FOUNDRY } from "@/lib/theme";
import {
  ArrowRight,
  TrendingUp,
  Zap,
  Bookmark,
} from "lucide-react";

// ─── Intelligence module definitions ─────────────────────

const INTEL_MODULES = [
  {
    href: "/matching",
    icon: Zap,
    color: FOUNDRY.success,
    title: "자동 매칭",
    desc: "최적 과제 발굴",
  },
  {
    href: "/trends",
    icon: TrendingUp,
    color: "#f97316",
    title: "트렌드 분석",
    desc: "기술·산업 동향",
  },
  {
    href: "/bookmarks",
    icon: Bookmark,
    color: "#a78bfa",
    title: "북마크",
    desc: "저장한 과제 모음",
  },
] as const;

// ─── Types ────────────────────────────────────────────────

type Tab = "urgent" | "recent";

// ─── Section header component ─────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: 10,
        color: FOUNDRY.muted,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        marginBottom: 10,
      }}
    >
      {children}
    </p>
  );
}

// ─── Stat card component ──────────────────────────────────

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div
      style={{
        background: FOUNDRY.card,
        border: `1px solid ${FOUNDRY.border}`,
        borderRadius: 8,
        padding: "14px 16px",
        minWidth: 0,
      }}
    >
      <p
        style={{
          fontFamily: "monospace",
          fontSize: 22,
          color: FOUNDRY.text,
          fontWeight: 600,
          lineHeight: 1.2,
          marginBottom: 4,
        }}
      >
        {value}
      </p>
      <p
        style={{
          fontSize: 11,
          color: FOUNDRY.muted,
          lineHeight: 1.3,
        }}
      >
        {label}
      </p>
    </div>
  );
}

// ─── Homepage ─────────────────────────────────────────────

export default function HomePage() {
  const [grants, setGrants] = useState<Record<Tab, Grant[]>>({
    urgent: [],
    recent: [],
  });
  const [tab, setTab] = useState<Tab>("urgent");
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [acceptingCount, setAcceptingCount] = useState(0);
  const [briefing, setBriefing] = useState<BriefingResponse | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [urgentRes, recentRes] = await Promise.all([
          fetchGrants({ sort: "deadline", page_size: "10" }).catch(() => null),
          fetchGrants({ sort: "recent", page_size: "10" }).catch(() => null),
        ]);
        const urgentItems = urgentRes?.items || [];
        const recentItems = recentRes?.items || [];
        setGrants({
          urgent: urgentItems,
          recent: recentItems,
        });
        setTotalCount(urgentRes?.total || recentRes?.total || 0);
        // Count accepting from combined unique items
        const combined = [
          ...urgentItems,
          ...recentItems.filter(
            (r) => !urgentItems.some((u) => u.id === r.id)
          ),
        ];
        setAcceptingCount(
          combined.filter((g) => ["접수중", "공고중", "진행중"].includes(g.status ?? "")).length
        );
      } finally {
        setLoading(false);
      }
    }
    load();

    // Load briefing data if user is logged in
    const token = localStorage.getItem("govgrants_token");
    if (token) {
      setBriefingLoading(true);
      fetchBriefing(token)
        .then(setBriefing)
        .catch(() => {})
        .finally(() => setBriefingLoading(false));
    }
  }, []);

  const now = new Date();
  const timestamp = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  return (
    <div
      style={{
        padding: "24px 28px",
        background: FOUNDRY.bg,
        minHeight: "100%",
      }}
    >
      {/* ── WOW BANNER ─────────────────────────────────── */}
      {briefingLoading && (
        <div
          style={{
            background: "rgba(45,114,210,0.06)",
            border: "1px solid rgba(45,114,210,0.15)",
            borderRadius: 10,
            padding: "22px 28px",
            marginBottom: 24,
            display: "grid",
            gridTemplateColumns: "1fr 2fr 1fr",
            gap: 0,
            alignItems: "center",
          }}
        >
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ textAlign: i === 1 ? "center" : i === 2 ? "right" : "left" }}>
              <div style={{ width: i === 1 ? 100 : 60, height: 40, borderRadius: 4, background: "rgba(255,255,255,0.05)", marginBottom: 8, display: "inline-block" }} />
              <div style={{ width: 70, height: 10, borderRadius: 4, background: "rgba(255,255,255,0.04)", display: "block" }} />
            </div>
          ))}
        </div>
      )}
      {!briefingLoading && briefing && (briefing.available_count > 0 || briefing.total_opportunity_krw > 0) && (
        <Link href="/briefing" style={{ textDecoration: "none", display: "block", marginBottom: 24 }}>
          <div
            style={{
              position: "relative",
              background: "linear-gradient(135deg, rgba(45,114,210,0.18) 0%, rgba(16,40,80,0.35) 50%, rgba(45,114,210,0.10) 100%)",
              border: "1px solid rgba(45,114,210,0.35)",
              borderRadius: 10,
              padding: "22px 28px",
              overflow: "hidden",
              cursor: "pointer",
            }}
          >
            {/* Ambient glow */}
            <div
              style={{
                position: "absolute",
                top: -40,
                left: "50%",
                transform: "translateX(-50%)",
                width: 320,
                height: 120,
                background: "radial-gradient(ellipse, rgba(45,114,210,0.2) 0%, transparent 70%)",
                pointerEvents: "none",
              }}
            />

            {/* Top label */}
            <p
              style={{
                fontSize: 10,
                color: FOUNDRY.primary,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                fontWeight: 600,
                marginBottom: 14,
              }}
            >
              {briefing.company_label} · 과제 기회 분석
            </p>

            {/* Main stats row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 2fr 1fr",
                gap: 0,
                alignItems: "center",
              }}
            >
              {/* Left: available count */}
              <div>
                <p
                  style={{
                    fontFamily: "monospace",
                    fontSize: 36,
                    fontWeight: 700,
                    color: FOUNDRY.text,
                    lineHeight: 1,
                    marginBottom: 4,
                  }}
                >
                  {briefing.available_count}
                  <span style={{ fontSize: 16, fontWeight: 400, color: FOUNDRY.muted, marginLeft: 4 }}>건</span>
                </p>
                <p style={{ fontSize: 11, color: FOUNDRY.muted }}>지금 신청 가능</p>
              </div>

              {/* Center: total amount (main wow) */}
              <div style={{ textAlign: "center", borderLeft: `1px solid rgba(45,114,210,0.25)`, borderRight: `1px solid rgba(45,114,210,0.25)`, padding: "0 24px" }}>
                <p style={{ fontSize: 11, color: FOUNDRY.muted, marginBottom: 6, letterSpacing: "0.06em" }}>
                  귀사에 매칭된 총 지원 규모
                </p>
                <p
                  style={{
                    fontFamily: "monospace",
                    fontSize: briefing.total_opportunity_krw >= 100_000_000 ? 44 : 36,
                    fontWeight: 800,
                    color: "#60a5fa",
                    lineHeight: 1,
                    marginBottom: 2,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {briefing.total_opportunity_krw > 0
                    ? briefing.total_opportunity_krw >= 100_000_000
                      ? `${(briefing.total_opportunity_krw / 100_000_000).toFixed(1)}억`
                      : `${Math.round(briefing.total_opportunity_krw / 10_000)}만`
                    : "—"}
                </p>
                <p style={{ fontSize: 11, color: FOUNDRY.muted }}>원 규모</p>
              </div>

              {/* Right: urgent + CTA */}
              <div style={{ textAlign: "right" }}>
                {briefing.urgent_count > 0 ? (
                  <>
                    <p
                      style={{
                        fontFamily: "monospace",
                        fontSize: 36,
                        fontWeight: 700,
                        color: FOUNDRY.danger,
                        lineHeight: 1,
                        marginBottom: 4,
                      }}
                    >
                      {briefing.urgent_count}
                      <span style={{ fontSize: 16, fontWeight: 400, marginLeft: 4 }}>건</span>
                    </p>
                    <p style={{ fontSize: 11, color: FOUNDRY.danger }}>마감 D-7 임박</p>
                  </>
                ) : (
                  <p style={{ fontSize: 12, color: FOUNDRY.muted }}>마감 임박 없음</p>
                )}
              </div>
            </div>

            {/* Bottom CTA */}
            <div
              style={{
                marginTop: 16,
                paddingTop: 14,
                borderTop: "1px solid rgba(45,114,210,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              {briefing.profile_incomplete ? (
                <p style={{ fontSize: 11, color: FOUNDRY.warning }}>
                  ⚠️ 프로필 완성 시 더 많은 과제가 매칭됩니다
                </p>
              ) : (
                <p style={{ fontSize: 11, color: FOUNDRY.muted }}>
                  AI가 분석한 귀사 맞춤 과제 리스트 →
                </p>
              )}
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: FOUNDRY.primary,
                  background: "rgba(45,114,210,0.15)",
                  border: "1px solid rgba(45,114,210,0.3)",
                  borderRadius: 6,
                  padding: "6px 14px",
                }}
              >
                브리핑 전체 보기 →
              </span>
            </div>
          </div>
        </Link>
      )}

      {/* ── OBJECT OVERVIEW ────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <SectionLabel>Object Overview</SectionLabel>
        <span style={{ fontSize: 10, color: FOUNDRY.muted }}>
          as of {timestamp}
        </span>
      </div>

      {/* Stat cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 10,
          marginBottom: 28,
        }}
      >
        <StatCard
          value={totalCount > 0 ? totalCount.toLocaleString() : "—"}
          label="Total Grants"
        />
        <StatCard
          value={acceptingCount > 0 ? acceptingCount.toLocaleString() : "—"}
          label="Accepting Now"
        />
        <StatCard value="268" label="Agencies" />
        <StatCard value="5" label="Tech Areas" />
      </div>

      {/* ── INTELLIGENCE MODULES ───────────────────────── */}
      <SectionLabel>Intelligence Modules</SectionLabel>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 10,
          marginBottom: 28,
        }}
      >
        {INTEL_MODULES.map(({ href, icon: Icon, color, title, desc }) => (
          <Link
            key={href}
            href={href}
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              background: FOUNDRY.card,
              border: `1px solid ${FOUNDRY.border}`,
              borderRadius: 8,
              padding: "12px 14px",
              textDecoration: "none",
              cursor: "pointer",
            }}
          >
            {/* Icon box */}
            <div
              style={{
                width: 34,
                height: 34,
                flexShrink: 0,
                borderRadius: 6,
                background: `${color}1a`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon size={16} color={color} />
            </div>

            {/* Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: FOUNDRY.text,
                  lineHeight: 1.3,
                  marginBottom: 2,
                }}
              >
                {title}
              </p>
              <p
                style={{
                  fontSize: 10,
                  color: FOUNDRY.muted,
                  lineHeight: 1.3,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {desc}
              </p>
            </div>

            {/* Arrow */}
            <ArrowRight size={13} color={FOUNDRY.muted} style={{ flexShrink: 0 }} />
          </Link>
        ))}
      </div>

      {/* ── GRANTS ─────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <SectionLabel>Grants</SectionLabel>

          {/* Tab switcher */}
          <div
            style={{
              display: "flex",
              gap: 2,
              background: FOUNDRY.card,
              border: `1px solid ${FOUNDRY.border}`,
              borderRadius: 6,
              padding: "2px",
              marginBottom: 10,
            }}
          >
            {(
              [
                ["urgent", "마감임박"],
                ["recent", "최근등록"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                style={{
                  fontSize: 11,
                  fontWeight: tab === key ? 600 : 400,
                  color: tab === key ? FOUNDRY.text : FOUNDRY.muted,
                  background:
                    tab === key ? "rgba(255,255,255,0.08)" : "transparent",
                  border: "none",
                  borderRadius: 4,
                  padding: "4px 10px",
                  cursor: "pointer",
                  transition: "background 0.15s, color 0.15s",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 전체 보기 */}
        <Link
          href="/grants"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11,
            color: FOUNDRY.muted,
            textDecoration: "none",
            marginBottom: 10,
          }}
        >
          전체 보기
          <ArrowRight size={12} />
        </Link>
      </div>

      {/* Grants table */}
      <div
        style={{
          background: FOUNDRY.card,
          border: `1px solid ${FOUNDRY.border}`,
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        {loading ? (
          <>
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                style={{
                  height: 48,
                  background: i % 2 === 0 ? FOUNDRY.card : "transparent",
                  borderBottom: `1px solid ${FOUNDRY.border}`,
                  padding: "0 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 20,
                    borderRadius: 4,
                    background: "rgba(255,255,255,0.05)",
                  }}
                />
                <div
                  style={{
                    flex: 1,
                    height: 12,
                    borderRadius: 4,
                    background: "rgba(255,255,255,0.05)",
                    maxWidth: 320,
                  }}
                />
              </div>
            ))}
          </>
        ) : grants[tab].length === 0 ? (
          <div
            style={{
              padding: "32px 16px",
              textAlign: "center",
              fontSize: 12,
              color: FOUNDRY.muted,
            }}
          >
            데이터를 불러오는 중입니다…
          </div>
        ) : (
          grants[tab].map((grant, idx) => {
            const dday = getDDay(grant.end_date);
            const ddayText = formatDDay(grant.end_date);
            const isClosed = dday !== null && dday > 0;
            const isUrgent = dday !== null && dday <= 0 && dday >= -7;
            const isLive = ["접수중", "공고중", "진행중"].includes(grant.status ?? "");

            return (
              <Link
                key={grant.id}
                href={`/grants/${grant.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "0 16px",
                  height: 48,
                  borderBottom:
                    idx < grants[tab].length - 1
                      ? `1px solid ${FOUNDRY.border}`
                      : "none",
                  textDecoration: "none",
                  background: "transparent",
                  opacity: isClosed ? 0.45 : 1,
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background =
                    "rgba(255,255,255,0.03)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background =
                    "transparent";
                }}
              >
                {/* D-day badge */}
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: 10,
                    fontWeight: 700,
                    color: isClosed
                      ? FOUNDRY.muted
                      : isUrgent
                      ? FOUNDRY.danger
                      : FOUNDRY.primary,
                    background: isClosed
                      ? "rgba(255,255,255,0.04)"
                      : isUrgent
                      ? "rgba(194,48,48,0.12)"
                      : "rgba(45,114,210,0.12)",
                    borderRadius: 4,
                    padding: "2px 6px",
                    flexShrink: 0,
                    minWidth: 38,
                    textAlign: "center",
                    display: "inline-block",
                  }}
                >
                  {ddayText}
                </span>

                {/* Title */}
                <span
                  style={{
                    flex: 1,
                    fontSize: 12,
                    fontWeight: 500,
                    color: FOUNDRY.text,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {grant.title}
                </span>

                {/* Organization */}
                {grant.organization && (
                  <span
                    style={{
                      fontSize: 11,
                      color: FOUNDRY.muted,
                      flexShrink: 0,
                      maxWidth: 120,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {grant.organization}
                  </span>
                )}

                {/* LIVE badge */}
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    color: isLive ? FOUNDRY.success : FOUNDRY.muted,
                    background: isLive
                      ? "rgba(35,162,109,0.12)"
                      : "rgba(255,255,255,0.04)",
                    borderRadius: 3,
                    padding: "2px 5px",
                    flexShrink: 0,
                  }}
                >
                  {isLive ? "LIVE" : "종료"}
                </span>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
