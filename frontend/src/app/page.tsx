"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchGrants, fetchBriefing, type Grant, type BriefingResponse } from "@/lib/api";
import { formatDDay, getDDay } from "@/lib/format";
import { FOUNDRY } from "@/lib/theme";
import {
  ArrowRight,
  GitBranch,
  TrendingUp,
  Network,
  Zap,
} from "lucide-react";

// ─── Intelligence module definitions ─────────────────────

const INTEL_MODULES = [
  {
    href: "/graph",
    icon: GitBranch,
    color: "#3b82f6",
    title: "Knowledge Graph",
    desc: "과제·기관·기술 관계",
  },
  {
    href: "/trends",
    icon: TrendingUp,
    color: "#f97316",
    title: "트렌드 분석",
    desc: "기술·산업 동향",
  },
  {
    href: "/network",
    icon: Network,
    color: "#8b5cf6",
    title: "기업 네트워크",
    desc: "유사기업 클러스터",
  },
  {
    href: "/matching",
    icon: Zap,
    color: FOUNDRY.success,
    title: "자동 매칭",
    desc: "최적 과제 발굴",
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
          combined.filter((g) => g.status === "접수중").length
        );
      } finally {
        setLoading(false);
      }
    }
    load();

    // Load briefing data if user is logged in
    const token = localStorage.getItem("govgrants_token");
    if (token) {
      fetchBriefing(token).then(setBriefing).catch(() => {});
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

      {/* ── BRIEFING BANNER ────────────────────────────── */}
      {briefing && briefing.available_count > 0 && (
        <Link href="/briefing" style={{ textDecoration: "none", display: "block", marginBottom: 20 }}>
          <div
            style={{
              background: "linear-gradient(135deg, rgba(45,114,210,0.15) 0%, rgba(45,114,210,0.05) 100%)",
              border: "1px solid rgba(45,114,210,0.3)",
              borderRadius: 8,
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              cursor: "pointer",
            }}
          >
            <div>
              <p style={{ fontSize: 11, color: FOUNDRY.primary, fontWeight: 600, marginBottom: 2, margin: "0 0 2px" }}>
                이번 주 귀사 과제 기회
              </p>
              <p style={{ fontSize: 20, fontWeight: 700, color: FOUNDRY.text, fontFamily: "monospace", margin: "0 0 2px" }}>
                {briefing.available_count}건
                {briefing.total_opportunity_krw > 0
                  ? ` · ${(briefing.total_opportunity_krw / 100_000_000).toFixed(1)}억원`
                  : ""}
              </p>
              {briefing.urgent_count > 0 && (
                <p style={{ fontSize: 11, color: FOUNDRY.danger, margin: 0 }}>
                  🔴 마감 임박 {briefing.urgent_count}건
                </p>
              )}
            </div>
            <div
              style={{
                fontSize: 11,
                color: FOUNDRY.primary,
                background: FOUNDRY.glow,
                borderRadius: 6,
                padding: "8px 14px",
                flexShrink: 0,
                fontWeight: 600,
              }}
            >
              브리핑 보기 →
            </div>
          </div>
        </Link>
      )}

      {/* ── INTELLIGENCE MODULES ───────────────────────── */}
      <SectionLabel>Intelligence Modules</SectionLabel>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
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
            const isLive = grant.status === "접수중";

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
