"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { fetchDashboard } from "@/lib/api";
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

interface DashboardData {
  totalGrants: number;
  activeGrants: number;
  totalUsers: number;
  todaySearches: number;
  recentLogs: FetchLog[];
}

interface FetchLog {
  id: string;
  source: string;
  scheduled_time: string;
  status: "success" | "failed" | "partial";
  new_count: number;
  updated_count: number;
  error_message?: string;
}

const STAT_CARDS = [
  {
    key: "totalGrants" as const,
    label: "총 지원사업",
    icon: Briefcase,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
  },
  {
    key: "activeGrants" as const,
    label: "접수중 사업",
    icon: FileCheck,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
  },
  {
    key: "totalUsers" as const,
    label: "총 회원수",
    icon: Users,
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
  },
  {
    key: "todaySearches" as const,
    label: "오늘 검색수",
    icon: Search,
    iconBg: "bg-purple-50",
    iconColor: "text-purple-600",
  },
];

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

export default function AdminDashboardPage() {
  const { session } = useAuth();
  const [data, setData] = useState<DashboardData>({
    totalGrants: 0,
    activeGrants: 0,
    totalUsers: 0,
    todaySearches: 0,
    recentLogs: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const token = session?.access_token;
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
  }, [session]);

  return (
    <div className="px-6 py-8 lg:px-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <p className="mt-1 text-sm text-gray-500">
          서비스 현황을 한눈에 확인하세요
        </p>
      </div>

      {/* Stat Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STAT_CARDS.map((card) => {
          const Icon = card.icon;
          const value = data[card.key];
          return (
            <div
              key={card.key}
              className="rounded-2xl bg-white p-6 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    {card.label}
                  </p>
                  {loading ? (
                    <div className="mt-2 h-8 w-20 animate-pulse rounded bg-gray-100" />
                  ) : (
                    <p className="mt-1 text-3xl font-bold text-gray-900">
                      {value.toLocaleString()}
                    </p>
                  )}
                </div>
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl ${card.iconBg}`}
                >
                  <Icon className={`h-6 w-6 ${card.iconColor}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Today's Fetch Logs */}
      <div className="rounded-2xl bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              오늘의 수집 로그
            </h2>
            <p className="text-sm text-gray-500">자동 수집 실행 결과</p>
          </div>
          <RefreshCw className="h-4 w-4 text-gray-400" />
        </div>

        {loading ? (
          <div className="p-6">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="mb-3 h-12 animate-pulse rounded-lg bg-gray-50"
              />
            ))}
          </div>
        ) : data.recentLogs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  <th className="px-6 py-3">소스</th>
                  <th className="px-6 py-3">예정 시간</th>
                  <th className="px-6 py-3">상태</th>
                  <th className="px-6 py-3">신규</th>
                  <th className="px-6 py-3">업데이트</th>
                  <th className="px-6 py-3">오류</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.recentLogs.map((log, idx) => (
                  <tr
                    key={log.id}
                    className={idx % 2 === 1 ? "bg-gray-50/50" : ""}
                  >
                    <td className="px-6 py-3 text-sm font-medium text-gray-900">
                      {log.source}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-500">
                      {log.scheduled_time}
                    </td>
                    <td className="px-6 py-3">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">
                      {log.new_count}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">
                      {log.updated_count}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-400">
                      {log.error_message || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center">
            <RefreshCw className="mx-auto mb-3 h-8 w-8 text-gray-300" />
            <p className="text-sm text-gray-400">
              오늘의 수집 로그가 아직 없습니다
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
