"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import { fetchGrants, type Grant } from "@/lib/api";
import { formatDDay, getDDay } from "@/lib/format";
import {
  ArrowRight,
  GitBranch,
  TrendingUp,
  Network,
  Zap,
  Flame,
  Clock,
  Sparkles,
} from "lucide-react";

const SOURCE_LABELS: Record<string, string> = {
  bizinfo: "기업마당",
  kocca: "KOCCA",
  kstartup: "K-Startup",
  subsidy24: "보조금24",
  smes: "중소벤처24",
};

const INTEL_FEATURES = [
  { href: "/graph", icon: GitBranch, label: "Knowledge Graph", color: "#00d4ff" },
  { href: "/trends", icon: TrendingUp, label: "트렌드 분석", color: "#f97316" },
  { href: "/network", icon: Network, label: "기업 네트워크", color: "#10b981" },
  { href: "/matching", icon: Zap, label: "자동 매칭", color: "#8b5cf6" },
] as const;

type Tab = "urgent" | "recent";

export default function HomePage() {
  const [grants, setGrants] = useState<Record<Tab, Grant[]>>({
    urgent: [],
    recent: [],
  });
  const [tab, setTab] = useState<Tab>("urgent");
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const [urgentRes, recentRes] = await Promise.all([
          fetchGrants({ sort: "deadline", size: "10" }).catch(() => null),
          fetchGrants({ sort: "recent", size: "10" }).catch(() => null),
        ]);
        setGrants({
          urgent: urgentRes?.items || [],
          recent: recentRes?.items || [],
        });
        setTotalCount(urgentRes?.total || recentRes?.total || 0);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="min-h-screen" style={{ background: "#0a0e1a" }}>
      {/* Hero */}
      <section className="relative overflow-hidden px-4 pb-12 pt-16 sm:px-6">
        {/* Background grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "linear-gradient(rgba(0,212,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-400">
            <Sparkles className="h-3.5 w-3.5" />
            정부 R&D Knowledge Graph 플랫폼
          </div>
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl md:text-5xl">
            데이터 인텔리전스로
            <br />
            <span style={{ color: "#00d4ff" }}>최적의 정부 지원사업</span>을 찾으세요
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-gray-400 sm:text-base">
            {totalCount > 0
              ? `${totalCount.toLocaleString()}개 과제를 Knowledge Graph로 분석`
              : "과제·기관·기술분야의 관계를 시각화하고 최적의 지원사업을 발굴합니다"}
          </p>
          <div className="mx-auto mt-8 max-w-2xl">
            <SearchBar size="large" />
          </div>
        </div>
      </section>

      {/* Intelligence feature strip */}
      <section className="px-4 pb-10 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {INTEL_FEATURES.map(({ href, icon: Icon, label, color }) => (
              <Link
                key={href}
                href={href}
                className="group flex items-center gap-3 rounded-xl px-4 py-3.5 transition-all"
                style={{
                  background: "#0f1628",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: `${color}15` }}
                >
                  <Icon className="h-4 w-4" style={{ color }} />
                </div>
                <span className="text-sm font-medium text-gray-300 group-hover:text-white">
                  {label}
                </span>
                <ArrowRight className="ml-auto h-3.5 w-3.5 text-gray-700 group-hover:text-gray-400" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Grant list */}
      <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
        <div className="mb-4 flex items-center justify-between">
          <div
            className="flex gap-1 rounded-xl p-1"
            style={{ background: "#0f1628" }}
          >
            {(
              [
                ["urgent", "마감임박", Flame],
                ["recent", "최근등록", Clock],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  tab === key
                    ? "bg-white/10 text-white"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>
          <Link
            href="/grants"
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-300"
          >
            전체 {totalCount > 0 && `${totalCount.toLocaleString()}개`}{" "}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div
          className="overflow-hidden rounded-xl"
          style={{ border: "1px solid rgba(255,255,255,0.08)" }}
        >
          {loading ? (
            <div
              className="divide-y"
              style={{ borderColor: "rgba(255,255,255,0.04)" }}
            >
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse px-4 py-3"
                  style={{ background: "#0f1628" }}
                >
                  <div className="h-4 w-3/4 rounded bg-white/5" />
                </div>
              ))}
            </div>
          ) : (
            <div
              className="divide-y"
              style={{ borderColor: "rgba(255,255,255,0.04)" }}
            >
              {grants[tab].map((grant) => {
                const dday = getDDay(grant.end_date);
                const ddayText = formatDDay(grant.end_date);
                const isUrgent = dday !== null && dday >= -7 && dday <= 0;
                const isClosed = dday !== null && dday > 0;
                const src = grant.sources?.[0] || "default";

                return (
                  <Link
                    key={grant.id}
                    href={`/grants/${grant.id}`}
                    className={`group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-white/5 ${
                      isClosed ? "opacity-40" : ""
                    }`}
                    style={{ background: "#0f1628" }}
                  >
                    <div
                      className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg text-[10px] font-bold leading-tight"
                      style={{
                        background: isClosed
                          ? "rgba(255,255,255,0.05)"
                          : isUrgent
                          ? "rgba(239,68,68,0.1)"
                          : "rgba(59,130,246,0.1)",
                        color: isClosed
                          ? "#4a6080"
                          : isUrgent
                          ? "#ef4444"
                          : "#3b82f6",
                      }}
                    >
                      {ddayText}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-200 group-hover:text-white">
                        {grant.title}
                      </p>
                      <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-600">
                        {grant.organization && (
                          <span className="truncate">{grant.organization}</span>
                        )}
                        {grant.category && <span>{grant.category}</span>}
                      </div>
                    </div>
                    <div className="hidden shrink-0 sm:flex items-center gap-2">
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-medium text-gray-500"
                        style={{ background: "rgba(255,255,255,0.05)" }}
                      >
                        {SOURCE_LABELS[src] || src}
                      </span>
                      {grant.status === "접수중" && (
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-medium text-emerald-400"
                          style={{ background: "rgba(16,185,129,0.1)" }}
                        >
                          접수중
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Data sources footer strip */}
      <section
        className="py-8"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="mb-4 text-center text-xs font-medium uppercase tracking-wider text-gray-600">
            데이터 소스
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {["기업마당", "K-Startup", "KOCCA", "보조금24", "중소벤처24"].map(
              (source) => (
                <span key={source} className="flex items-center gap-1.5 text-sm font-medium text-gray-600">
                  {source}
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
              )
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
