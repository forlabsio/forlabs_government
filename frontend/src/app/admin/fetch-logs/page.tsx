"use client";

import { useState, useEffect } from "react";
import { triggerCollect } from "@/lib/api";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Play,
  FileText,
} from "lucide-react";

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
  const styles: Record<string, string> = {
    success: "bg-emerald-50 text-emerald-700",
    failed: "bg-red-50 text-red-700",
    partial: "bg-amber-50 text-amber-700",
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
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${styles[status] || styles.success}`}
    >
      <Icon className="h-3 w-3" />
      {labels[status] || status}
    </span>
  );
}

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
        // Reload logs after a moment
        setTimeout(() => loadLogs(), 2000);
      }
    } catch {
      // Handle error silently
    } finally {
      setTriggering(false);
    }
  }

  return (
    <div className="px-6 py-8 lg:px-8">
      {/* Page Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">수집 로그</h1>
          <p className="mt-1 text-sm text-gray-500">
            데이터 수집 실행 이력을 확인합니다
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => loadLogs()}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />
            새로고침
          </button>
          <button
            type="button"
            onClick={handleTrigger}
            disabled={triggering}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
            {triggering ? "수집 중..." : "수동 수집"}
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded-2xl bg-white shadow-sm">
        {loading ? (
          <div className="p-6">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="mb-3 h-14 animate-pulse rounded-lg bg-gray-50"
              />
            ))}
          </div>
        ) : logs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  <th className="px-6 py-4">소스</th>
                  <th className="px-6 py-4">예정 시간</th>
                  <th className="px-6 py-4">시작</th>
                  <th className="px-6 py-4">완료</th>
                  <th className="px-6 py-4">상태</th>
                  <th className="px-6 py-4 text-right">신규</th>
                  <th className="px-6 py-4 text-right">업데이트</th>
                  <th className="px-6 py-4 text-right">총 건수</th>
                  <th className="px-6 py-4">오류 메시지</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map((log, idx) => (
                  <tr
                    key={log.id}
                    className={idx % 2 === 1 ? "bg-gray-50/50" : ""}
                  >
                    <td className="px-6 py-3">
                      <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                        {log.source}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-3 text-sm text-gray-500">
                      {log.scheduled_time}
                    </td>
                    <td className="whitespace-nowrap px-6 py-3 text-sm text-gray-500">
                      {log.started_at}
                    </td>
                    <td className="whitespace-nowrap px-6 py-3 text-sm text-gray-500">
                      {log.finished_at}
                    </td>
                    <td className="px-6 py-3">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="px-6 py-3 text-right text-sm font-medium text-emerald-600">
                      +{log.new_count}
                    </td>
                    <td className="px-6 py-3 text-right text-sm font-medium text-blue-600">
                      {log.updated_count}
                    </td>
                    <td className="px-6 py-3 text-right text-sm text-gray-600">
                      {log.total_count}
                    </td>
                    <td className="max-w-[200px] truncate px-6 py-3 text-sm text-red-500">
                      {log.error_message || (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center">
            <FileText className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="mb-1 text-sm font-medium text-gray-500">
              수집 로그가 없습니다
            </p>
            <p className="text-xs text-gray-400">
              수동 수집 버튼을 눌러 데이터를 수집해보세요
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
