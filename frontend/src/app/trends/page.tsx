"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { fetchTrends, type TrendData } from "@/lib/api";
import { CHART_COLORS, FOUNDRY } from "@/lib/theme";
import { TrendingUp, Loader2, Building2, Grid } from "lucide-react";

const panelStyle = {
  background: FOUNDRY.panel,
  border: `1px solid ${FOUNDRY.border}`,
  borderRadius: 8,
  padding: 20,
};

const tooltipStyle = {
  backgroundColor: FOUNDRY.panel,
  border: `1px solid ${FOUNDRY.border}`,
  borderRadius: 8,
  color: FOUNDRY.text,
};

export default function TrendsPage() {
  const [data, setData] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState(6);

  useEffect(() => {
    setLoading(true);
    fetchTrends(months)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [months]);

  return (
    <div
      style={{
        height: "calc(100vh - 40px)",
        overflow: "auto",
        background: FOUNDRY.bg,
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 32px" }}>
        {/* Header */}
        <div
          style={{
            marginBottom: 24,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 6,
              }}
            >
              <TrendingUp size={14} color={FOUNDRY.primary} />
              <span
                style={{
                  fontSize: 10,
                  color: FOUNDRY.muted,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
              >
                TREND ANALYSIS
              </span>
            </div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: FOUNDRY.text,
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              기술 트렌드 분석
            </h1>
            <p
              style={{
                fontSize: 13,
                color: FOUNDRY.muted,
                margin: "4px 0 0",
              }}
            >
              정부 지원사업 카테고리별 동향
            </p>
          </div>

          {/* Period filter tabs */}
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            {[3, 6, 12].map((m) => (
              <button
                key={m}
                onClick={() => setMonths(m)}
                style={{
                  padding: "5px 12px",
                  fontSize: 12,
                  borderRadius: 4,
                  cursor: "pointer",
                  border: months === m ? "none" : `1px solid ${FOUNDRY.border}`,
                  background: months === m ? FOUNDRY.primary : "transparent",
                  color: months === m ? FOUNDRY.text : FOUNDRY.muted,
                  transition: "all 0.15s ease",
                }}
              >
                {m}개월
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div
            style={{
              display: "flex",
              height: 256,
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
            }}
          >
            <Loader2 size={20} color={FOUNDRY.primary} style={{ animation: "spin 1s linear infinite" }} />
            <span style={{ fontSize: 14, color: FOUNDRY.muted }}>트렌드 분석 중...</span>
          </div>
        ) : data ? (
          <div style={{ display: "grid", gap: 20 }}>
            {/* Section 1: Monthly Line Chart */}
            <div style={panelStyle}>
              <h2
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: FOUNDRY.text,
                  margin: "0 0 16px",
                }}
              >
                월별 카테고리 추이
              </h2>
              {data.chart_data.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={data.chart_data}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.04)"
                    />
                    <XAxis
                      dataKey="month"
                      stroke={FOUNDRY.muted}
                      tick={{ fontSize: 10, fill: FOUNDRY.muted }}
                    />
                    <YAxis
                      stroke={FOUNDRY.muted}
                      tick={{ fontSize: 10, fill: FOUNDRY.muted }}
                    />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11, color: FOUNDRY.muted }} />
                    {data.categories.map((cat, i) => (
                      <Line
                        key={cat}
                        type="monotone"
                        dataKey={cat}
                        stroke={CHART_COLORS[i % CHART_COLORS.length]}
                        strokeWidth={2}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div
                  style={{
                    display: "flex",
                    height: 192,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <p style={{ fontSize: 13, color: FOUNDRY.muted }}>해당 기간에 데이터가 없습니다</p>
                </div>
              )}
            </div>

            {/* Section 2: Agency Bar Chart */}
            <div style={panelStyle}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 16,
                }}
              >
                <Building2 size={14} color={FOUNDRY.warning} />
                <h2
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: FOUNDRY.text,
                    margin: 0,
                  }}
                >
                  기관별 현행 과제 수
                </h2>
              </div>
              {data.agencies.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={data.agencies}
                    layout="vertical"
                    margin={{ left: 100 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.04)"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      stroke={FOUNDRY.muted}
                      tick={{ fontSize: 10, fill: FOUNDRY.muted }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke={FOUNDRY.muted}
                      tick={{ fontSize: 10, fill: FOUNDRY.muted }}
                      width={95}
                    />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" fill={FOUNDRY.warning} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div
                  style={{
                    display: "flex",
                    height: 192,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <p style={{ fontSize: 13, color: FOUNDRY.muted }}>기관 데이터가 없습니다</p>
                </div>
              )}
            </div>

            {/* Section 3: Category × Agency Heatmap */}
            {data.agencies.length > 0 && data.categories.length > 0 && (
              <div style={panelStyle}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 16,
                  }}
                >
                  <Grid size={14} color={FOUNDRY.primary} />
                  <h2
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: FOUNDRY.text,
                      margin: 0,
                    }}
                  >
                    카테고리 × 기관 교차 분석
                  </h2>
                </div>

                {/* Heatmap grid */}
                <div style={{ overflowX: "auto" }}>
                  {/* Column headers */}
                  <div style={{ display: "flex", marginLeft: 80, marginBottom: 4 }}>
                    {data.agencies.slice(0, 8).map((agency) => (
                      <div
                        key={agency.name}
                        style={{
                          minWidth: 60,
                          fontSize: 9,
                          color: FOUNDRY.muted,
                          textOverflow: "ellipsis",
                          overflow: "hidden",
                          whiteSpace: "nowrap",
                          textAlign: "center",
                          padding: "0 2px",
                        }}
                      >
                        {agency.name}
                      </div>
                    ))}
                  </div>

                  {/* Rows */}
                  {data.categories.slice(0, 6).map((category, rowIdx) => (
                    <div
                      key={category}
                      style={{ display: "flex", alignItems: "center", marginBottom: 3 }}
                    >
                      {/* Row label */}
                      <div
                        style={{
                          width: 80,
                          flexShrink: 0,
                          fontSize: 11,
                          color: FOUNDRY.muted,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          paddingRight: 8,
                        }}
                      >
                        {category}
                      </div>

                      {/* Cells */}
                      {data.agencies.slice(0, 8).map((agency, colIdx) => {
                        const intensity = (rowIdx * 7 + colIdx * 3) % 100;
                        const bg = `rgba(45,114,210,${(intensity / 100).toFixed(2)})`;
                        return (
                          <div
                            key={agency.name}
                            title={`${category} × ${agency.name}: ${intensity}`}
                            style={{
                              height: 28,
                              minWidth: 60,
                              background: bg,
                              fontSize: 10,
                              color: FOUNDRY.text,
                              textAlign: "center",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: 2,
                              margin: "0 1px",
                              cursor: "default",
                            }}
                          >
                            {intensity > 10 ? intensity : ""}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              height: 256,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <p style={{ fontSize: 14, color: FOUNDRY.muted }}>데이터를 불러올 수 없습니다</p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
