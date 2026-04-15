"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from "recharts";
import { fetchTrends, type TrendData } from "@/lib/api";
import { FOUNDRY } from "@/lib/theme";
import { TrendingUp, Loader2, Zap, Clock, Award } from "lucide-react";

const F = FOUNDRY;

function fmt억(krw: number): string {
  if (krw >= 1_000_000_000_000) return `${(krw / 1_000_000_000_000).toFixed(1)}조`;
  if (krw >= 100_000_000) return `${(krw / 100_000_000).toFixed(1)}억`;
  if (krw >= 10_000) return `${Math.round(krw / 10_000)}만`;
  return `${krw.toLocaleString()}`;
}

const tooltipStyle = {
  backgroundColor: F.panel,
  border: `1px solid ${F.border}`,
  borderRadius: 8,
  color: F.text,
  fontSize: 11,
};

const SECTOR_COLORS = [
  "#3b82f6", "#8b5cf6", "#f97316", "#10b981",
  "#f59e0b", "#ef4444", "#06b6d4", "#84cc16",
];

export default function TrendsPage() {
  const [data, setData] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTrends(6)
      .then(setData)
      .catch((e) => { console.error(e); setError("데이터를 불러올 수 없습니다."); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "calc(100vh - 40px)", background: F.bg, gap: 12 }}>
        <Loader2 size={20} color={F.primary} className="animate-spin" />
        <span style={{ fontSize: 13, color: F.muted }}>인사이트 분석 중...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "calc(100vh - 40px)", background: F.bg }}>
        <p style={{ fontSize: 13, color: F.danger }}>{error ?? "데이터가 없습니다"}</p>
      </div>
    );
  }

  const sectors = data.sector_leaderboard ?? [];
  const velocity = data.weekly_velocity ?? [];
  const closing = data.high_value_closing ?? [];
  const agencyBudget = data.agency_budget ?? [];

  // Total LIVE funding across all sectors
  const totalLiveFunding = sectors.reduce((s, x) => s + x.total_amount_krw, 0);
  const totalLiveGrants = sectors.reduce((s, x) => s + x.grant_count, 0);

  // Velocity trend: last 4 weeks vs prev 4 weeks
  const recent4 = velocity.slice(-4).reduce((s, x) => s + x.count, 0);
  const prev4 = velocity.slice(-8, -4).reduce((s, x) => s + x.count, 0);
  const velocityDelta = prev4 > 0 ? Math.round(((recent4 - prev4) / prev4) * 100) : 0;

  return (
    <div style={{ height: "calc(100vh - 40px)", overflow: "auto", background: F.bg }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 32px" }}>

        {/* Header */}
        <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <TrendingUp size={14} color={F.primary} />
              <span style={{ fontSize: 10, color: F.muted, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                Market Intelligence
              </span>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: F.text, margin: "0 0 4px" }}>
              정부 R&D 투자 인사이트
            </h1>
            <p style={{ fontSize: 12, color: F.muted, margin: 0 }}>
              현재 LIVE 상태인 {totalLiveGrants.toLocaleString()}건 · 총 {fmt억(totalLiveFunding)}원 규모 분석
            </p>
          </div>
        </div>

        {/* ── 1. SECTOR BUDGET LEADERBOARD ─────────────────── */}
        <div style={{ marginBottom: 20, background: F.card, border: `1px solid ${F.border}`, borderRadius: 8, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Award size={14} color="#f59e0b" />
            <span style={{ fontSize: 12, fontWeight: 600, color: F.text }}>
              지금 정부가 가장 많이 투자하는 분야
            </span>
            <span style={{ fontSize: 10, color: F.muted, marginLeft: "auto" }}>LIVE 과제 기준 총 지원금 규모</span>
          </div>

          {sectors.length === 0 ? (
            <p style={{ fontSize: 12, color: F.muted, textAlign: "center", padding: "32px 0" }}>데이터가 없습니다</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {sectors.map((s, i) => {
                const pct = totalLiveFunding > 0 ? (s.total_amount_krw / totalLiveFunding) * 100 : 0;
                const color = SECTOR_COLORS[i % SECTOR_COLORS.length];
                return (
                  <div key={s.category}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontFamily: "monospace", color: F.muted, minWidth: 20, textAlign: "right" }}>
                        #{i + 1}
                      </span>
                      <span style={{ fontSize: 12, color: F.text, flex: 1 }}>{s.category}</span>
                      <span style={{ fontSize: 11, color: F.muted }}>{s.grant_count}건</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color, fontFamily: "monospace", minWidth: 80, textAlign: "right" }}>
                        {fmt억(s.total_amount_krw)}원
                      </span>
                    </div>
                    <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2, marginLeft: 30 }}>
                      <div style={{ height: 4, width: `${pct}%`, background: color, borderRadius: 2, transition: "width 0.6s ease" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── 2+3 ROW: VELOCITY + CLOSING ──────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>

          {/* 2. Weekly announcement velocity */}
          <div style={{ background: F.card, border: `1px solid ${F.border}`, borderRadius: 8, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <Zap size={14} color={F.primary} />
              <span style={{ fontSize: 12, fontWeight: 600, color: F.text }}>신규 공고 속도</span>
              {velocityDelta !== 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  color: velocityDelta > 0 ? "#10b981" : "#ef4444",
                  background: velocityDelta > 0 ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                  borderRadius: 4, padding: "1px 6px", marginLeft: "auto",
                }}>
                  {velocityDelta > 0 ? "+" : ""}{velocityDelta}% 4주 비교
                </span>
              )}
            </div>
            <p style={{ fontSize: 10, color: F.muted, marginBottom: 12 }}>
              주간 신규 과제 공고 건수 (최근 16주)
            </p>
            {velocity.length > 0 ? (
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={velocity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="week" stroke={F.muted} tick={{ fontSize: 9, fill: F.muted }} interval={3} />
                  <YAxis stroke={F.muted} tick={{ fontSize: 9, fill: F.muted }} width={28} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="count" stroke={F.primary} strokeWidth={2} dot={false} name="신규 공고" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p style={{ fontSize: 12, color: F.muted, textAlign: "center", padding: "48px 0" }}>데이터 없음</p>
            )}
          </div>

          {/* 3. High-value grants closing soon */}
          <div style={{ background: F.card, border: `1px solid ${F.border}`, borderRadius: 8, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <Clock size={14} color={F.danger} />
              <span style={{ fontSize: 12, fontWeight: 600, color: F.text }}>고액 과제 마감 임박</span>
              <span style={{ fontSize: 10, color: F.muted, marginLeft: "auto" }}>90일 이내 마감</span>
            </div>
            <p style={{ fontSize: 10, color: F.muted, marginBottom: 12 }}>지원금 규모 기준 상위 과제</p>
            {closing.length === 0 ? (
              <p style={{ fontSize: 12, color: F.muted, textAlign: "center", padding: "48px 0" }}>해당 과제 없음</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 200, overflow: "auto" }}>
                {closing.map((g) => (
                  <Link key={g.id} href={`/grants/${g.id}`} style={{ textDecoration: "none" }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "6px 8px", borderRadius: 6,
                      background: "rgba(255,255,255,0.02)",
                      border: `1px solid ${F.border}`,
                    }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, fontFamily: "monospace",
                        color: g.days_left <= 14 ? F.danger : F.warning,
                        background: g.days_left <= 14 ? "rgba(194,48,48,0.12)" : "rgba(214,147,35,0.12)",
                        borderRadius: 3, padding: "1px 5px", flexShrink: 0,
                      }}>
                        D-{g.days_left}
                      </span>
                      <span style={{ flex: 1, fontSize: 11, color: F.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {g.title}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: F.primary, flexShrink: 0, fontFamily: "monospace" }}>
                        {fmt억(g.amount_max)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── 4. AGENCY BUDGET RANKING ─────────────────────── */}
        <div style={{ background: F.card, border: `1px solid ${F.border}`, borderRadius: 8, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: F.text }}>기관별 총 지원 예산 순위</span>
            <span style={{ fontSize: 10, color: F.muted, marginLeft: "auto" }}>LIVE 과제 기준</span>
          </div>
          {agencyBudget.length === 0 ? (
            <p style={{ fontSize: 12, color: F.muted, textAlign: "center", padding: "32px 0" }}>데이터가 없습니다</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.min(agencyBudget.length * 32 + 20, 320)}>
              <BarChart data={agencyBudget} layout="vertical" margin={{ left: 8, right: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis
                  type="number"
                  stroke={F.muted}
                  tick={{ fontSize: 9, fill: F.muted }}
                  tickFormatter={(v) => fmt억(v)}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke={F.muted}
                  tick={{ fontSize: 10, fill: F.muted }}
                  width={110}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v) => [`${fmt억(Number(v))}원`, "총 지원 예산"]}
                />
                <Bar dataKey="total_amount_krw" fill={F.primary} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

      </div>
    </div>
  );
}
