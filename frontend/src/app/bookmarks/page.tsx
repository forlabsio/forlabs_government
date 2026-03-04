"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Grant } from "@/lib/api";
import { formatDDay, getDDay, formatAmountRange } from "@/lib/format";
import {
  Bookmark,
  BookmarkX,
  Search,
  Clock,
  AlertTriangle,
  ArrowUpDown,
  ExternalLink,
  Building2,
  Banknote,
  CalendarDays,
} from "lucide-react";

type SortKey = "deadline" | "recent";

export default function BookmarksPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [bookmarks, setBookmarks] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>("deadline");
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    async function load() {
      const token = localStorage.getItem("govgrants_token");
      if (token) {
        try {
          const { fetchBookmarks } = await import("@/lib/api");
          const data = await fetchBookmarks(token);
          setBookmarks(data);
        } catch {
          /* fallback */
        }
      }
      setLoading(false);
    }
    if (user) load();
  }, [user, authLoading, router]);

  async function handleRemove(grantId: string) {
    setRemovingId(grantId);
    const token = localStorage.getItem("govgrants_token");
    if (token) {
      try {
        const { removeBookmark } = await import("@/lib/api");
        await removeBookmark(token, grantId);
      } catch {
        /* ignore */
      }
    }
    // Animate out then remove
    setTimeout(() => {
      setBookmarks((prev) => prev.filter((g) => g.id !== grantId));
      setRemovingId(null);
    }, 300);
  }

  const sorted = useMemo(() => {
    const list = [...bookmarks];
    switch (sort) {
      case "deadline":
        return list.sort((a, b) => {
          const da = getDDay(a.end_date);
          const db = getDDay(b.end_date);
          if (da === null) return 1;
          if (db === null) return -1;
          return da - db; // more negative = further deadline = later
        });
      case "recent":
        return list.sort((a, b) => {
          if (!a.created_at) return 1;
          if (!b.created_at) return -1;
          return b.created_at.localeCompare(a.created_at);
        });
      default:
        return list;
    }
  }, [bookmarks, sort]);

  // Stats
  const urgentCount = bookmarks.filter((g) => {
    const d = getDDay(g.end_date);
    return d !== null && d >= -7 && d <= 0;
  }).length;

  const activeCount = bookmarks.filter(
    (g) => g.status === "접수중"
  ).length;

  if (authLoading || loading) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-gray-50">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <div className="mb-8 h-8 w-48 animate-pulse rounded-lg bg-gray-200" />
          <div className="grid gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl bg-white" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">나의 사업관리</h1>
          <p className="mt-1 text-sm text-gray-500">
            관심 사업의 일정과 현황을 한눈에 관리하세요
          </p>
        </div>

        {/* Summary Cards */}
        {bookmarks.length > 0 && (
          <div className="mb-6 grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Bookmark className="h-4 w-4" />
                전체
              </div>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {bookmarks.length}
              </p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-emerald-600">
                <Clock className="h-4 w-4" />
                접수중
              </div>
              <p className="mt-1 text-2xl font-bold text-emerald-600">
                {activeCount}
              </p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-red-500">
                <AlertTriangle className="h-4 w-4" />
                7일 이내 마감
              </div>
              <p className="mt-1 text-2xl font-bold text-red-600">
                {urgentCount}
              </p>
            </div>
          </div>
        )}

        {/* Sort Bar */}
        {bookmarks.length > 0 && (
          <div className="mb-4 flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-gray-400" />
            <div className="flex gap-1 rounded-lg bg-white p-1 shadow-sm">
              {([
                { key: "deadline", label: "마감순" },
                { key: "recent", label: "최신순" },
              ] as { key: SortKey; label: string }[]).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setSort(opt.key)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    sort === opt.key
                      ? "bg-blue-600 text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Bookmark List */}
        {bookmarks.length === 0 ? (
          <div className="rounded-2xl bg-white py-20 text-center shadow-sm">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
              <Bookmark className="h-8 w-8 text-blue-400" />
            </div>
            <h2 className="mb-2 text-lg font-bold text-gray-900">
              아직 관리중인 지원사업이 없습니다
            </h2>
            <p className="mx-auto mb-8 max-w-sm text-sm text-gray-500">
              지원사업 목록에서 관심있는 사업을 등록하면
              <br />
              마감일 관리와 현황 확인이 편리해집니다
            </p>
            <Link
              href="/grants"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              <Search className="h-4 w-4" />
              지원사업 찾아보기
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sorted.map((grant) => {
              const dday = getDDay(grant.end_date);
              const ddayText = formatDDay(grant.end_date);
              const isUrgent = dday !== null && dday >= -7 && dday <= 0;
              const isClosed = dday !== null && dday > 0;
              const amount = formatAmountRange(grant.amount_min, grant.amount_max);

              return (
                <div
                  key={grant.id}
                  className={`group rounded-2xl bg-white shadow-sm transition-all duration-300 ${
                    removingId === grant.id
                      ? "scale-95 opacity-0"
                      : "opacity-100"
                  } ${isClosed ? "opacity-60" : ""} ${
                    isUrgent ? "ring-1 ring-red-200" : ""
                  }`}
                >
                  <div className="flex items-start gap-4 p-5 sm:p-6">
                    {/* D-Day Badge */}
                    <div
                      className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl text-center ${
                        isClosed
                          ? "bg-gray-100 text-gray-400"
                          : isUrgent
                          ? "bg-red-50 text-red-600"
                          : dday !== null
                          ? "bg-blue-50 text-blue-600"
                          : "bg-gray-50 text-gray-500"
                      }`}
                    >
                      <span className="text-[10px] font-medium leading-none">
                        {isClosed ? "마감" : dday === null ? "" : "D"}
                      </span>
                      <span className="text-lg font-bold leading-tight">
                        {isClosed
                          ? ""
                          : dday === null
                          ? "상시"
                          : dday === 0
                          ? "-Day"
                          : `${dday}`}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        {grant.status && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              grant.status === "접수중"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {grant.status}
                          </span>
                        )}
                        {grant.category && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                            {grant.category}
                          </span>
                        )}
                        {isUrgent && (
                          <span className="flex items-center gap-1 text-[11px] font-bold text-red-500">
                            <AlertTriangle className="h-3 w-3" />
                            마감임박
                          </span>
                        )}
                      </div>

                      <Link
                        href={`/grants/${grant.id}`}
                        className="mb-2 block text-base font-semibold text-gray-900 transition-colors hover:text-blue-600 sm:text-lg"
                      >
                        {grant.title}
                      </Link>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                        {grant.organization && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5" />
                            {grant.organization}
                          </span>
                        )}
                        {amount && amount !== "금액 미정" && (
                          <span className="flex items-center gap-1 font-medium text-blue-600">
                            <Banknote className="h-3.5 w-3.5" />
                            {amount}
                          </span>
                        )}
                        {grant.end_date && (
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {grant.end_date}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 flex-col items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleRemove(grant.id)}
                        title="관심 사업 제거"
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500"
                      >
                        <BookmarkX className="h-4.5 w-4.5" />
                      </button>
                      {grant.detail_url && (
                        <a
                          href={grant.detail_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="원문 보기"
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-blue-50 hover:text-blue-500"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
