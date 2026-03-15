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
import { CHART_COLORS } from "@/lib/theme";
import { TrendingUp, Loader2, Building2 } from "lucide-react";

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

  const tooltipStyle = {
    backgroundColor: "#0f1628",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "8px",
    color: "#e8edf5",
  };

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6" style={{ background: "#0a0e1a" }}>
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-6 w-6 text-cyan-400" />
            <div>
              <h1 className="text-xl font-semibold text-white">기술 트렌드 분석</h1>
              <p className="text-sm text-gray-500">정부 지원사업 카테고리별 동향</p>
            </div>
          </div>
          <select
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="rounded-lg px-3 py-1.5 text-sm text-white"
            style={{
              background: "#141c30",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <option value={3}>3개월</option>
            <option value={6}>6개월</option>
            <option value={12}>12개월</option>
          </select>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
            <span className="text-gray-500">트렌드 분석 중...</span>
          </div>
        ) : data ? (
          <div className="grid gap-6">
            {/* Monthly trend line chart */}
            <div
              className="rounded-xl p-6"
              style={{
                background: "#0f1628",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <h2 className="mb-4 text-sm font-semibold text-white">월별 카테고리 추이</h2>
              {data.chart_data.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.chart_data}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.05)"
                    />
                    <XAxis
                      dataKey="month"
                      stroke="#4a6080"
                      tick={{ fontSize: 11, fill: "#4a6080" }}
                    />
                    <YAxis stroke="#4a6080" tick={{ fontSize: 11, fill: "#4a6080" }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 12, color: "#8fa3c0" }} />
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
                <div className="flex h-48 items-center justify-center">
                  <p className="text-sm text-gray-500">해당 기간에 데이터가 없습니다</p>
                </div>
              )}
            </div>

            {/* Agency distribution bar chart */}
            <div
              className="rounded-xl p-6"
              style={{
                background: "#0f1628",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div className="mb-4 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-orange-400" />
                <h2 className="text-sm font-semibold text-white">기관별 현행 과제 수</h2>
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
                      stroke="rgba(255,255,255,0.05)"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      stroke="#4a6080"
                      tick={{ fontSize: 11, fill: "#4a6080" }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke="#4a6080"
                      tick={{ fontSize: 10, fill: "#4a6080" }}
                      width={95}
                    />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" fill="#f97316" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-48 items-center justify-center">
                  <p className="text-sm text-gray-500">기관 데이터가 없습니다</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center">
            <p className="text-gray-500">데이터를 불러올 수 없습니다</p>
          </div>
        )}
      </div>
    </div>
  );
}
