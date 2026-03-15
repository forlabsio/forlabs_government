"use client";

import { useState, useEffect } from "react";
import { fetchSearchInsights, fetchZeroResults } from "@/lib/api";
import { FOUNDRY } from "@/lib/theme";
import { TrendingUp, AlertCircle } from "lucide-react";
import type { CSSProperties } from "react";

interface SearchKeyword {
  keyword: string;
  count: number;
  last_searched: string;
}

interface ZeroResultKeyword {
  keyword: string;
  count: number;
  last_searched: string;
}

const TH: CSSProperties = {
  padding: "9px 14px",
  fontSize: 11,
  fontWeight: 600,
  color: FOUNDRY.muted,
  textAlign: "left",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  borderBottom: `1px solid ${FOUNDRY.border}`,
  background: FOUNDRY.card,
};

export default function SearchInsightsPage() {
  const [popular, setPopular] = useState<SearchKeyword[]>([]);
  const [zeroResults, setZeroResults] = useState<ZeroResultKeyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const token = localStorage.getItem("govgrants_token");
        if (token) {
          const [popularData, zeroData] = await Promise.all([
            fetchSearchInsights(token, days),
            fetchZeroResults(token, days),
          ]);
          setPopular(popularData?.keywords || []);
          setZeroResults(zeroData?.keywords || []);
        }
      } catch {
        // Use empty arrays on error
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [days]);

  function KeywordTable({
    data,
    accentColor,
    emptyIcon: EmptyIcon,
    emptyText,
  }: {
    data: SearchKeyword[];
    accentColor: string;
    emptyIcon: typeof TrendingUp;
    emptyText: string;
  }) {
    if (loading) {
      return (
        <div style={{ padding: "16px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{ height: 38, borderRadius: 5, background: "rgba(255,255,255,0.04)" }} />
          ))}
        </div>
      );
    }
    if (data.length === 0) {
      return (
        <div style={{ padding: "40px 14px", textAlign: "center" }}>
          <EmptyIcon size={28} color="rgba(255,255,255,0.1)" style={{ marginBottom: 8 }} />
          <p style={{ margin: 0, fontSize: 13, color: FOUNDRY.muted }}>{emptyText}</p>
        </div>
      );
    }
    return (
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...TH, width: 40 }}>#</th>
              <th style={TH}>검색어</th>
              <th style={{ ...TH, textAlign: "right" }}>횟수</th>
              <th style={{ ...TH, textAlign: "right" }}>최근 검색</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, idx) => (
              <tr
                key={item.keyword}
                style={{ transition: "background 0.1s" }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)")}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "transparent")}
              >
                <td style={{ padding: "9px 14px", borderBottom: `1px solid ${FOUNDRY.border}` }}>
                  <span style={{
                    display: "inline-flex",
                    width: 22,
                    height: 22,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 100,
                    fontSize: 11,
                    fontWeight: 700,
                    background: idx < 3 ? `${accentColor}25` : "rgba(255,255,255,0.06)",
                    color: idx < 3 ? accentColor : FOUNDRY.muted,
                  }}>
                    {idx + 1}
                  </span>
                </td>
                <td style={{ padding: "9px 14px", fontSize: 13, fontWeight: 500, color: FOUNDRY.text, borderBottom: `1px solid ${FOUNDRY.border}` }}>
                  {item.keyword}
                </td>
                <td style={{ padding: "9px 14px", textAlign: "right", fontSize: 13, fontWeight: 600, color: FOUNDRY.text, borderBottom: `1px solid ${FOUNDRY.border}` }}>
                  {item.count.toLocaleString()}
                </td>
                <td style={{ padding: "9px 14px", textAlign: "right", fontSize: 12, color: FOUNDRY.muted, borderBottom: `1px solid ${FOUNDRY.border}` }}>
                  {item.last_searched}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div style={{ padding: "28px 28px 48px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: FOUNDRY.text }}>검색 인사이트</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: FOUNDRY.muted }}>사용자들의 검색 패턴을 분석합니다</p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              style={{
                borderRadius: 7,
                border: `1px solid ${days === d ? FOUNDRY.primary : FOUNDRY.border}`,
                background: days === d ? "rgba(45,114,210,0.15)" : "transparent",
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: days === d ? 600 : 400,
                color: days === d ? FOUNDRY.primary : FOUNDRY.muted,
                cursor: "pointer",
                transition: "all 0.12s",
              }}
            >
              {d}일
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))", gap: 16 }}>
        {/* Popular Keywords */}
        <div style={{ borderRadius: 10, border: `1px solid ${FOUNDRY.border}`, background: FOUNDRY.panel, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${FOUNDRY.border}`, padding: "14px 18px" }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(45,114,210,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <TrendingUp size={15} color={FOUNDRY.primary} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: FOUNDRY.text }}>인기 검색어 TOP 20</h2>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: FOUNDRY.muted }}>최근 {days}일 기준</p>
            </div>
          </div>
          <KeywordTable
            data={popular}
            accentColor={FOUNDRY.primary}
            emptyIcon={TrendingUp}
            emptyText="검색 데이터가 없습니다"
          />
        </div>

        {/* Zero Results */}
        <div style={{ borderRadius: 10, border: `1px solid ${FOUNDRY.border}`, background: FOUNDRY.panel, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${FOUNDRY.border}`, padding: "14px 18px" }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(194,48,48,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <AlertCircle size={15} color={FOUNDRY.danger} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: FOUNDRY.text }}>결과없는 검색어 (Zero-Result)</h2>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: FOUNDRY.muted }}>데이터 보강이 필요한 검색어</p>
            </div>
          </div>
          <KeywordTable
            data={zeroResults}
            accentColor={FOUNDRY.danger}
            emptyIcon={AlertCircle}
            emptyText="Zero-Result 검색어가 없습니다"
          />
        </div>
      </div>
    </div>
  );
}
