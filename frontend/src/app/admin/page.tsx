"use client";

import { useState, useEffect } from "react";
import { fetchDashboard, triggerCollect } from "@/lib/api";

async function syncGraph(token: string) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const res = await fetch(`${API_URL}/api/admin/sync-graph`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Failed to sync graph");
  return res.json();
}
import { FOUNDRY } from "@/lib/theme";
import {
  Briefcase,
  FileCheck,
  Users,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import type { CSSProperties } from "react";

interface DashboardData {
  total_grants: number;
  active_grants: number;
  total_users: number;
  today_searches: number;
  fetch_logs_today: FetchLog[];
}

interface FetchLog {
  id: string;
  source: string;
  schedule_time: string;
  status: string;
  total_fetched: number;
  new_count: number;
  duplicate_count: number;
  updated_count?: number;
  error_message?: string;
  started_at?: string;
  finished_at?: string;
}

const STAT_CARDS = [
  { key: "total_grants"   as const, label: "총 지원사업", icon: Briefcase,  color: FOUNDRY.primary },
  { key: "active_grants"  as const, label: "접수중 사업", icon: FileCheck,  color: FOUNDRY.success },
  { key: "total_users"    as const, label: "총 회원수",   icon: Users,      color: FOUNDRY.warning },
  { key: "today_searches" as const, label: "오늘 검색수", icon: Search,     color: "#8b5cf6" },
];

function StatusBadge({ status }: { status: string }) {
  const styleMap: Record<string, CSSProperties> = {
    success: { background: "rgba(35,162,109,0.15)",  color: FOUNDRY.success },
    failed:  { background: "rgba(194,48,48,0.15)",   color: FOUNDRY.danger },
    partial: { background: "rgba(191,115,38,0.15)",  color: FOUNDRY.warning },
  };
  const icons: Record<string, typeof CheckCircle2> = {
    success: CheckCircle2,
    failed: XCircle,
    partial: AlertTriangle,
  };
  const labels: Record<string, string> = {
    success: "성공",
    failed: "실패",
    partial: "부분성공",
  };
  const Icon = icons[status] || CheckCircle2;
  const s = styleMap[status] ?? styleMap.success;
  return (
    <span
      style={{
        ...s,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        borderRadius: 100,
        padding: "3px 9px",
        fontSize: 11,
        fontWeight: 500,
      }}
    >
      <Icon size={11} />
      {labels[status] || status}
    </span>
  );
}

const TH: CSSProperties = {
  padding: "10px 16px",
  fontSize: 11,
  fontWeight: 600,
  color: FOUNDRY.muted,
  textAlign: "left",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  borderBottom: `1px solid ${FOUNDRY.border}`,
  background: FOUNDRY.card,
};

const TD: CSSProperties = {
  padding: "10px 16px",
  fontSize: 13,
  color: FOUNDRY.text,
  borderBottom: `1px solid ${FOUNDRY.border}`,
};

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData>({
    total_grants: 0,
    active_grants: 0,
    total_users: 0,
    today_searches: 0,
    fetch_logs_today: [],
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ grants_synced: number; companies_synced: number; eligibility_edges: number } | null>(null);
  const [collecting, setCollecting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const token = localStorage.getItem("govgrants_token");
        if (token) {
          const result = await fetchDashboard(token);
          setData(result);
        }
      } catch {
        // Use default empty data on error
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSyncGraph() {
    const token = localStorage.getItem("govgrants_token");
    if (!token) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await syncGraph(token);
      setSyncResult(result);
    } catch {
      alert("Neo4j 동기화 실패");
    } finally {
      setSyncing(false);
    }
  }

  async function handleCollect() {
    const token = localStorage.getItem("govgrants_token");
    if (!token) return;
    setCollecting(true);
    try {
      await triggerCollect(token);
      alert("수집 트리거 완료");
    } catch {
      alert("수집 트리거 실패");
    } finally {
      setCollecting(false);
    }
  }

  return (
    <div style={{ padding: "28px 28px 48px" }}>
      {/* Page Header */}
      <div style={{ marginBottom: 28, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: FOUNDRY.text }}>대시보드</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: FOUNDRY.muted }}>서비스 현황을 한눈에 확인하세요</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleCollect}
            disabled={collecting}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: `1px solid ${FOUNDRY.border}`,
              color: FOUNDRY.text,
              borderRadius: 8,
              padding: "8px 16px",
              fontSize: 13,
              cursor: collecting ? "not-allowed" : "pointer",
              opacity: collecting ? 0.6 : 1,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <RefreshCw size={13} />
            {collecting ? "수집 중..." : "과제 수집"}
          </button>
          <button
            onClick={handleSyncGraph}
            disabled={syncing}
            style={{
              background: syncing ? "rgba(22,119,255,0.15)" : FOUNDRY.primary,
              border: "none",
              color: "#fff",
              borderRadius: 8,
              padding: "8px 16px",
              fontSize: 13,
              cursor: syncing ? "not-allowed" : "pointer",
              opacity: syncing ? 0.7 : 1,
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontWeight: 600,
            }}
          >
            <RefreshCw size={13} style={{ animation: syncing ? "spin 1s linear infinite" : "none" }} />
            {syncing ? "동기화 중..." : "Neo4j 동기화"}
          </button>
        </div>
      </div>
      {syncResult && (
        <div style={{
          marginBottom: 20,
          borderRadius: 8,
          border: `1px solid rgba(35,162,109,0.3)`,
          background: "rgba(35,162,109,0.08)",
          padding: "12px 18px",
          display: "flex",
          gap: 24,
          alignItems: "center",
          fontSize: 13,
          color: FOUNDRY.text,
        }}>
          <CheckCircle2 size={16} color={FOUNDRY.success} />
          <span>Neo4j 동기화 완료 —</span>
          <span>과제 <strong style={{ color: FOUNDRY.success }}>{syncResult.grants_synced}</strong>건</span>
          <span>기업 <strong style={{ color: FOUNDRY.primary }}>{syncResult.companies_synced}</strong>개</span>
          <span>적격성 엣지 <strong style={{ color: "#8b5cf6" }}>{syncResult.eligibility_edges}</strong>개</span>
        </div>
      )}

      {/* Stat Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 14,
          marginBottom: 28,
        }}
      >
        {STAT_CARDS.map((card) => {
          const Icon = card.icon;
          const value = data[card.key];
          return (
            <div
              key={card.key}
              style={{
                borderRadius: 10,
                border: `1px solid ${FOUNDRY.border}`,
                background: FOUNDRY.panel,
                padding: "20px 22px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <p style={{ margin: 0, fontSize: 12, color: FOUNDRY.muted }}>{card.label}</p>
                {loading ? (
                  <div style={{ marginTop: 8, height: 28, width: 80, borderRadius: 5, background: "rgba(255,255,255,0.06)" }} />
                ) : (
                  <p style={{ margin: "6px 0 0", fontSize: 26, fontWeight: 700, color: FOUNDRY.text }}>
                    {(value ?? 0).toLocaleString()}
                  </p>
                )}
              </div>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  background: `${card.color}20`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon size={20} color={card.color} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Today's Fetch Logs */}
      <div
        style={{
          borderRadius: 10,
          border: `1px solid ${FOUNDRY.border}`,
          background: FOUNDRY.panel,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: `1px solid ${FOUNDRY.border}`,
            padding: "14px 20px",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: FOUNDRY.text }}>오늘의 수집 로그</h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: FOUNDRY.muted }}>자동 수집 실행 결과</p>
          </div>
          <RefreshCw size={14} color={FOUNDRY.muted} />
        </div>

        {loading ? (
          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            {[...Array(3)].map((_, i) => (
              <div key={i} style={{ height: 40, borderRadius: 6, background: "rgba(255,255,255,0.04)" }} />
            ))}
          </div>
        ) : data.fetch_logs_today.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["소스", "예정 시간", "상태", "신규", "업데이트", "오류"].map((h) => (
                    <th key={h} style={TH}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.fetch_logs_today.map((log) => (
                  <tr
                    key={log.id}
                    style={{ transition: "background 0.1s" }}
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)")}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                  >
                    <td style={{ ...TD, fontWeight: 500 }}>{log.source}</td>
                    <td style={{ ...TD, color: FOUNDRY.muted }}>{log.schedule_time}</td>
                    <td style={TD}><StatusBadge status={log.status} /></td>
                    <td style={{ ...TD, color: FOUNDRY.success }}>{log.new_count}</td>
                    <td style={{ ...TD, color: FOUNDRY.primary }}>{log.updated_count ?? "-"}</td>
                    <td style={{ ...TD, color: FOUNDRY.muted, maxWidth: 200 }}>{log.error_message || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: "48px 20px", textAlign: "center" }}>
            <RefreshCw size={28} color="rgba(255,255,255,0.1)" style={{ marginBottom: 10 }} />
            <p style={{ margin: 0, fontSize: 13, color: FOUNDRY.muted }}>오늘의 수집 로그가 아직 없습니다</p>
          </div>
        )}
      </div>
    </div>
  );
}
