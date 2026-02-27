"use client";

import { useEffect, useState } from "react";
import SearchBar from "@/components/SearchBar";
import GrantCard from "@/components/GrantCard";
import { fetchGrants, type Grant } from "@/lib/api";
import { ArrowRight, TrendingUp, Clock, Sparkles } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  const [urgentGrants, setUrgentGrants] = useState<Grant[]>([]);
  const [recentGrants, setRecentGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [urgentRes, recentRes] = await Promise.all([
          fetchGrants({ sort: "deadline", size: "6" }).catch(() => null),
          fetchGrants({ sort: "recent", size: "6" }).catch(() => null),
        ]);
        if (urgentRes?.items) setUrgentGrants(urgentRes.items);
        if (recentRes?.items) setRecentGrants(recentRes.items);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50 to-white pb-16 pt-20 sm:pb-24 sm:pt-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          {/* Badge */}
          <div className="mb-6 flex justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-700">
              <Sparkles className="h-4 w-4" />
              AI 기반 맞춤형 지원사업 검색
            </span>
          </div>

          {/* Heading */}
          <h1 className="mx-auto max-w-3xl text-center text-3xl font-bold leading-tight tracking-tight text-gray-900 sm:text-4xl md:text-5xl">
            우리 기업에 딱 맞는
            <br />
            <span className="text-blue-600">정부 지원사업</span>을 찾아보세요
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-center text-lg leading-relaxed text-gray-500">
            흩어진 정부 지원사업 정보를 한곳에 모았습니다.
            <br className="hidden sm:block" />
            자연어 검색으로 우리 기업에 맞는 지원금을 쉽게 찾아보세요.
          </p>

          {/* Search Bar */}
          <div className="mx-auto mt-10 max-w-2xl">
            <SearchBar size="large" />
          </div>

          {/* Quick Stats */}
          <div className="mx-auto mt-12 grid max-w-2xl grid-cols-3 gap-4">
            <div className="rounded-xl bg-white p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-gray-900">2,400+</p>
              <p className="mt-1 text-sm text-gray-500">등록 지원사업</p>
            </div>
            <div className="rounded-xl bg-white p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-gray-900">5개</p>
              <p className="mt-1 text-sm text-gray-500">정보 소스</p>
            </div>
            <div className="rounded-xl bg-white p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-gray-900">매일</p>
              <p className="mt-1 text-sm text-gray-500">자동 업데이트</p>
            </div>
          </div>
        </div>
      </section>

      {/* Urgent Grants Section */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50">
              <Clock className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                마감 임박 지원사업
              </h2>
              <p className="text-sm text-gray-500">
                서두르세요! 곧 마감되는 사업입니다
              </p>
            </div>
          </div>
          <Link
            href="/grants?sort=deadline"
            className="flex items-center gap-1 text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
          >
            전체보기
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-64 animate-pulse rounded-xl bg-gray-100"
              />
            ))}
          </div>
        ) : urgentGrants.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {urgentGrants.map((grant) => (
              <GrantCard key={grant.id} grant={grant} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center">
            <p className="text-gray-400">
              아직 등록된 지원사업이 없습니다. 백엔드 서버를 확인해주세요.
            </p>
          </div>
        )}
      </section>

      {/* Recent Grants Section */}
      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                최근 등록된 지원사업
              </h2>
              <p className="text-sm text-gray-500">
                새로 등록된 지원사업을 확인하세요
              </p>
            </div>
          </div>
          <Link
            href="/grants?sort=recent"
            className="flex items-center gap-1 text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
          >
            전체보기
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-64 animate-pulse rounded-xl bg-gray-100"
              />
            ))}
          </div>
        ) : recentGrants.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentGrants.map((grant) => (
              <GrantCard key={grant.id} grant={grant} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center">
            <p className="text-gray-400">
              아직 등록된 지원사업이 없습니다. 백엔드 서버를 확인해주세요.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
