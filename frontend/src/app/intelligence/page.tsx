"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchRecommendations, type Grant } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import {
  Sparkles,
  GitBranch,
  TrendingUp,
  Network,
  Zap,
  Loader2,
  ArrowRight,
  Clock,
} from "lucide-react";
import { formatDDay, getDDay } from "@/lib/format";

const INTELLIGENCE_CARDS = [
  {
    href: "/graph",
    icon: GitBranch,
    color: "#00d4ff",
    title: "Knowledge Graph",
    desc: "과제·기관·기술분야 관계 탐색",
  },
  {
    href: "/trends",
    icon: TrendingUp,
    color: "#f97316",
    title: "트렌드 분석",
    desc: "기술·산업별 지원 동향 차트",
  },
  {
    href: "/network",
    icon: Network,
    color: "#10b981",
    title: "기업 네트워크",
    desc: "유사 기업 클러스터 분석",
  },
  {
    href: "/matching",
    icon: Zap,
    color: "#8b5cf6",
    title: "자동 매칭",
    desc: "내 기업 맞춤 과제 탐색",
  },
] as const;

export default function IntelligencePage() {
  const { user } = useAuth();
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("govgrants_token") : null;
    if (!token) return;
    setLoading(true);
    fetchRecommendations(token, 8)
      .then((r) => setGrants(r.items))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6" style={{ background: "#0a0e1a" }}>
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <div className="mb-1 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-cyan-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
              Intelligence Dashboard
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white">
            {user?.company_name || user?.name
              ? `${user.company_name || user.name}님의 대시보드`
              : "나의 Intelligence 대시보드"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            정부 R&D Knowledge Graph 기반 맞춤형 인텔리전스
          </p>
        </div>

        {/* Intelligence feature cards */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {INTELLIGENCE_CARDS.map(({ href, icon: Icon, color, title, desc }) => (
            <Link
              key={href}
              href={href}
              className="group rounded-xl p-4 transition-all"
              style={{
                background: "#0f1628",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div
                className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ background: `${color}15` }}
              >
                <Icon className="h-5 w-5" style={{ color }} />
              </div>
              <p className="text-sm font-semibold text-white">{title}</p>
              <p className="mt-0.5 text-xs text-gray-500">{desc}</p>
              <div
                className="mt-3 flex items-center gap-1 text-xs"
                style={{ color }}
              >
                탐색하기 <ArrowRight className="h-3 w-3" />
              </div>
            </Link>
          ))}
        </div>

        {/* AI Recommended Grants */}
        <div
          className="rounded-xl p-6"
          style={{
            background: "#0f1628",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-white">AI 맞춤 추천 과제</h2>
            </div>
            <Link
              href="/grants"
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300"
            >
              전체보기 <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {!user ? (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-500">맞춤 추천을 받으려면 로그인하세요.</p>
              <Link
                href="/login"
                className="mt-3 inline-block rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-gray-900"
              >
                로그인
              </Link>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
              <span className="text-sm text-gray-500">맞춤 과제 분석 중...</span>
            </div>
          ) : grants.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {grants.map((grant) => {
                const dday = getDDay(grant.end_date);
                const ddayText = formatDDay(grant.end_date);
                const isUrgent = dday !== null && dday >= -7 && dday <= 0;
                return (
                  <Link
                    key={grant.id}
                    href={`/grants/${grant.id}`}
                    className="group flex items-start gap-3 rounded-lg p-3 transition-colors"
                    style={{ background: "#141c30" }}
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg text-[10px] font-bold leading-tight"
                      style={{
                        background: isUrgent
                          ? "rgba(239,68,68,0.1)"
                          : "rgba(59,130,246,0.1)",
                        color: isUrgent ? "#ef4444" : "#3b82f6",
                      }}
                    >
                      {ddayText}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white group-hover:text-cyan-400">
                        {grant.title}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="h-3 w-3" />
                        {grant.organization || "-"}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-500">
                프로필을 채우면 맞춤 추천이 시작됩니다.
              </p>
              <Link
                href="/mypage"
                className="mt-3 inline-block text-sm text-cyan-400 hover:underline"
              >
                프로필 설정하기
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
