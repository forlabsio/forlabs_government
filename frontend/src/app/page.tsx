"use client";

import { useEffect, useState } from "react";
import SearchBar from "@/components/SearchBar";
import { fetchGrants, type Grant } from "@/lib/api";
import { formatDDay, getDDay, formatAmountRange } from "@/lib/format";
import {
  ArrowRight,
  Clock,
  Sparkles,
  TrendingUp,
  Flame,
  Building2,
  Banknote,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

type Tab = "urgent" | "recent" | "amount";

const TABS: { key: Tab; label: string; icon: typeof Clock }[] = [
  { key: "urgent", label: "마감임박", icon: Flame },
  { key: "recent", label: "최근등록", icon: TrendingUp },
  { key: "amount", label: "높은지원금", icon: Banknote },
];

const SOURCE_LABELS: Record<string, string> = {
  bizinfo: "기업마당",
  ntis: "NTIS",
  kocca: "KOCCA",
  kstartup: "K-Startup",
  subsidy24: "보조금24",
  smes: "중소벤처24",
};

const SOURCE_COLORS: Record<string, string> = {
  bizinfo: "text-blue-700 bg-blue-50",
  ntis: "text-green-700 bg-green-50",
  kocca: "text-orange-700 bg-orange-50",
  kstartup: "text-indigo-700 bg-indigo-50",
  subsidy24: "text-pink-700 bg-pink-50",
  smes: "text-purple-700 bg-purple-50",
};

export default function HomePage() {
  const [grants, setGrants] = useState<Record<Tab, Grant[]>>({
    urgent: [],
    recent: [],
    amount: [],
  });
  const [tab, setTab] = useState<Tab>("urgent");
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const [urgentRes, recentRes, amountRes] = await Promise.all([
          fetchGrants({ sort: "deadline", size: "10" }).catch(() => null),
          fetchGrants({ sort: "recent", size: "10" }).catch(() => null),
          fetchGrants({ sort: "amount", size: "10" }).catch(() => null),
        ]);
        setGrants({
          urgent: urgentRes?.items || [],
          recent: recentRes?.items || [],
          amount: amountRes?.items || [],
        });
        setTotalCount(urgentRes?.total || recentRes?.total || 0);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const currentGrants = grants[tab];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section — compact */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50 to-white pb-10 pt-14 sm:pb-14 sm:pt-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-4 flex justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 sm:text-sm">
              <Sparkles className="h-3.5 w-3.5" />
              AI 기반 맞춤형 지원사업 검색
            </span>
          </div>

          <h1 className="mx-auto max-w-3xl text-center text-2xl font-bold leading-tight tracking-tight text-gray-900 sm:text-3xl md:text-4xl">
            우리 기업에 딱 맞는{" "}
            <span className="text-blue-600">정부 지원사업</span>
          </h1>

          <p className="mx-auto mt-3 max-w-xl text-center text-sm leading-relaxed text-gray-500 sm:text-base">
            {totalCount > 0
              ? `${totalCount.toLocaleString()}개 지원사업을 한곳에서 검색하세요`
              : "흩어진 정부 지원사업 정보를 한곳에 모았습니다"}
          </p>

          <div className="mx-auto mt-6 max-w-2xl sm:mt-8">
            <SearchBar size="large" />
          </div>

          {/* Quick category links */}
          <div className="mx-auto mt-5 flex max-w-2xl flex-wrap justify-center gap-2">
            {[
              { label: "자금지원", href: "/grants?category=자금" },
              { label: "R&D", href: "/grants?category=R%26D" },
              { label: "창업", href: "/grants?category=창업" },
              { label: "인력", href: "/grants?category=인력" },
              { label: "수출", href: "/grants?category=수출" },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-blue-300 hover:text-blue-600 sm:text-sm"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Main List Section */}
      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Tabs + View All */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:px-4 ${
                  tab === key
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{label.slice(0, 2)}</span>
              </button>
            ))}
          </div>
          <Link
            href={`/grants?sort=${tab === "urgent" ? "deadline" : tab === "amount" ? "amount" : "recent"}`}
            className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            전체보기
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Table-style list */}
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          {/* Table header */}
          <div className="hidden border-b border-gray-100 bg-gray-50/50 px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-400 sm:grid sm:grid-cols-12 sm:gap-4">
            <div className="col-span-1 text-center">D-Day</div>
            <div className="col-span-5">사업명</div>
            <div className="col-span-2">기관</div>
            <div className="col-span-2 text-right">지원금</div>
            <div className="col-span-1 text-center">출처</div>
            <div className="col-span-1 text-center">상태</div>
          </div>

          {loading ? (
            <div className="divide-y divide-gray-50">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-16 animate-pulse bg-white px-4 py-3">
                  <div className="h-4 w-3/4 rounded bg-gray-100" />
                </div>
              ))}
            </div>
          ) : currentGrants.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {currentGrants.map((grant) => {
                const dday = getDDay(grant.end_date);
                const ddayText = formatDDay(grant.end_date);
                const isUrgent = dday !== null && dday >= -7 && dday <= 0;
                const isClosed = dday !== null && dday > 0;
                const amount = formatAmountRange(
                  grant.amount_min,
                  grant.amount_max
                );
                const src = grant.sources?.[0] || "default";

                return (
                  <Link
                    key={grant.id}
                    href={`/grants/${grant.id}`}
                    className={`group block transition-colors hover:bg-blue-50/30 ${
                      isClosed ? "opacity-50" : ""
                    }`}
                  >
                    {/* Mobile layout */}
                    <div className="flex items-center gap-3 px-4 py-3.5 sm:hidden">
                      {/* D-Day badge */}
                      <div
                        className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg text-center text-[10px] font-bold leading-tight ${
                          isClosed
                            ? "bg-gray-100 text-gray-400"
                            : isUrgent
                            ? "bg-red-50 text-red-600"
                            : dday !== null
                            ? "bg-blue-50 text-blue-600"
                            : "bg-gray-50 text-gray-500"
                        }`}
                      >
                        {ddayText}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900 group-hover:text-blue-600">
                          {grant.title}
                        </p>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                          {grant.organization && (
                            <span className="truncate">
                              {grant.organization}
                            </span>
                          )}
                          {amount && amount !== "금액 미정" && (
                            <span className="shrink-0 font-medium text-blue-600">
                              {amount}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
                    </div>

                    {/* Desktop layout */}
                    <div className="hidden items-center gap-4 px-4 py-3 sm:grid sm:grid-cols-12">
                      {/* D-Day */}
                      <div className="col-span-1 text-center">
                        <span
                          className={`inline-block rounded-md px-2 py-1 text-xs font-bold ${
                            isClosed
                              ? "bg-gray-100 text-gray-400"
                              : isUrgent
                              ? "bg-red-50 text-red-600"
                              : dday !== null
                              ? "bg-blue-50 text-blue-600"
                              : "bg-gray-50 text-gray-500"
                          }`}
                        >
                          {ddayText}
                        </span>
                      </div>

                      {/* Title */}
                      <div className="col-span-5 min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900 group-hover:text-blue-600">
                          {grant.title}
                        </p>
                        {grant.category && (
                          <span className="mt-0.5 inline-block text-xs text-gray-400">
                            {grant.category}
                          </span>
                        )}
                      </div>

                      {/* Organization */}
                      <div className="col-span-2 min-w-0">
                        <p className="flex items-center gap-1 truncate text-xs text-gray-500">
                          <Building2 className="h-3 w-3 shrink-0" />
                          {grant.organization || "-"}
                        </p>
                      </div>

                      {/* Amount */}
                      <div className="col-span-2 text-right">
                        {amount && amount !== "금액 미정" ? (
                          <span className="text-sm font-bold text-blue-600">
                            {amount}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">-</span>
                        )}
                      </div>

                      {/* Source */}
                      <div className="col-span-1 text-center">
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            SOURCE_COLORS[src] || "bg-gray-50 text-gray-500"
                          }`}
                        >
                          {SOURCE_LABELS[src] || src}
                        </span>
                      </div>

                      {/* Status */}
                      <div className="col-span-1 text-center">
                        {grant.status && (
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              grant.status === "접수중"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {grant.status}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="py-16 text-center">
              <p className="text-sm text-gray-400">
                등록된 지원사업이 없습니다
              </p>
            </div>
          )}
        </div>

        {/* View all button */}
        <div className="mt-4 text-center">
          <Link
            href="/grants"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            전체 {totalCount > 0 && `${totalCount.toLocaleString()}개 `}
            지원사업 보기
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Data sources */}
      <section className="border-t border-gray-100 bg-gray-50/50 py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="mb-4 text-center text-xs font-medium uppercase tracking-wider text-gray-400">
            데이터 소스
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {[
              { name: "기업마당", active: true },
              { name: "NTIS", active: true },
              { name: "K-Startup", active: false },
              { name: "KOCCA", active: false },
              { name: "보조금24", active: false },
              { name: "중소벤처24", active: false },
            ].map((source) => (
              <span
                key={source.name}
                className={`text-sm font-medium ${
                  source.active ? "text-gray-600" : "text-gray-300"
                }`}
              >
                {source.name}
                {source.active && (
                  <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-green-400" />
                )}
              </span>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
