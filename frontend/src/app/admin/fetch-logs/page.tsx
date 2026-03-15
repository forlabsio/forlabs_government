"use client";

import { useState, useEffect } from "react";
import { triggerCollect } from "@/lib/api";
import { FOUNDRY } from "@/lib/theme";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Play,
  FileText,
} from "lucide-react";
import type { CSSProperties } from "react";

interface FetchLog {
  id: string;
  source: string;
  scheduled_time: string;
  started_at: string;
  finished_at: string;
  status: "success" | "failed" | "partial";
  new_count: number;
  updated_count: number;
  total_count: number;
  error_message?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
  const labels: Record<string, string> = { success: "성공", failed: "실패", partial: "부분성공" };
  const Icon = icons[status] || CheckCircle2;
  const s = styleMap[status] ?? styleMap.success;
  return (
    <span style={{ ...s, display: "inline-flex", alignItems: "center", gap: 4, borderRadius: 100, padding: "3px 9px", fontSize: 11, fontWeight: 500 }}>
      <Icon size={11} />
      {labels[status] || status}
    </span>
  );
}

const TH: CSSProperties = {
  padding: "10px 14px",
  fontSize: 11,
  fontWeight: 600,
  color: FOUNDRY.muted,
  textAlign: "left",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  borderBottom: `1px solid ${FOUNDRY.border}`,
  background: FOUNDRY.card,
  whiteSpace: "nowrap",
};

export default function FetchLogsPage() {
  const [logs, setLogs] = useState<FetchLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    loadLogs();
  }, []);

  async function loadLogs() {
    setLoading(true);
    try {
      const token = localStorage.getItem("govgrants_token");
      if (token) {
        const res = await fetch(`${API_URL}/api/admin/fetch-logs`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setLogs(data?.logs || []);
        }
      }
    } catch {
      // Use empty array on error
    } finally {
      setLoading(false);
    }
  }

  async function handleTrigger() {
    setTriggering(true);
    try {
      const token = localStorage.getItem("govgrants_token");
      if (token) {
        await triggerCollect(token);
        setTimeout(() => loadLogs(), 2000);
      }
    } catch {
      // Handle error silently
    } finally {
      setTriggering(false);
    }
  }

  const btnBase: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    borderRadius: 8,
    padding: "9px 14px",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    border: "none",
    transition: "opacity 0.15s",
  };

  return (
    <div style={{ padding: "28px 28px 48px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: FOUNDRY.text }}>수집 로그</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: FOUNDRY.muted }}>데이터 수집 실행 이력을 확인합니다</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => loadLogs()}
            style={{ ...btnBase, background: "transparent", border: `1px solid ${FOUNDRY.border}`, color: FOUNDRY.muted }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = "0.7")}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = "1")}
          >
            <RefreshCw size={13} />
            새로고침
          </button>
          <button
            type="button"
            onClick={handleTrigger}
            disabled={triggering}
            style={{ ...btnBase, background: triggering ? "rgba(45,114,210,0.4)" : FOUNDRY.primary, color: "#fff", cursor: triggering ? "not-allowed" : "pointer" }}
            onMouseEnter={e => { if (!triggering) (e.currentTarget as HTMLElement).style.opacity = "0.85"; }}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = "1")}
          >
            <Play size={13} />
            {triggering ? "수집 중..." : "수동 수집"}
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div style={{ borderRadius: 10, border: `1px solid ${FOUNDRY.border}`, background: FOUNDRY.panel, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} style={{ height: 44, borderRadius: 6, background: "rgba(255,255,255,0.04)" }} />
            ))}
          </div>
        ) : logs.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {[
                    { label: "소스" },
                    { label: "예정 시간" },
                    { label: "시작" },
                    { label: "완료" },
                    { label: "상태" },
                    { label: "신규",      align: "right" as const },
                    { label: "업데이트",  align: "right" as const },
                    { label: "총 건수",   align: "right" as const },
                    { label: "오류 메시지" },
                  ].map(({ label, align }) => (
                    <th key={label} style={{ ...TH, textAlign: align || "left" }}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    style={{ transition: "background 0.1s" }}
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)")}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                  >
                    <td style={{ padding: "10px 14px", borderBottom: `1px solid ${FOUNDRY.border}` }}>
                      <span style={{ background: "rgba(255,255,255,0.06)", color: FOUNDRY.muted, borderRadius: 5, padding: "3px 8px", fontSize: 12, fontWeight: 500 }}>
                        {log.source}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: FOUNDRY.muted, whiteSpace: "nowrap", borderBottom: `1px solid ${FOUNDRY.border}` }}>
                      {log.scheduled_time}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: FOUNDRY.muted, whiteSpace: "nowrap", borderBottom: `1px solid ${FOUNDRY.border}` }}>
                      {log.started_at}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: FOUNDRY.muted, whiteSpace: "nowrap", borderBottom: `1px solid ${FOUNDRY.border}` }}>
                      {log.finished_at}
                    </td>
                    <td style={{ padding: "10px 14px", borderBottom: `1px solid ${FOUNDRY.border}` }}>
                      <StatusBadge status={log.status} />
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontSize: 13, fontWeight: 600, color: FOUNDRY.success, borderBottom: `1px solid ${FOUNDRY.border}` }}>
                      +{log.new_count}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontSize: 13, fontWeight: 600, color: FOUNDRY.primary, borderBottom: `1px solid ${FOUNDRY.border}` }}>
                      {log.updated_count}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontSize: 13, color: FOUNDRY.text, borderBottom: `1px solid ${FOUNDRY.border}` }}>
                      {log.total_count}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: FOUNDRY.danger, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", borderBottom: `1px solid ${FOUNDRY.border}` }}>
                      {log.error_message || <span style={{ color: "rgba(255,255,255,0.15)" }}>-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: "56px 20px", textAlign: "center" }}>
            <FileText size={32} color="rgba(255,255,255,0.1)" style={{ marginBottom: 10 }} />
            <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 500, color: FOUNDRY.muted }}>수집 로그가 없습니다</p>
            <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.2)" }}>수동 수집 버튼을 눌러 데이터를 수집해보세요</p>
          </div>
        )}
      </div>
    </div>
  );
}
