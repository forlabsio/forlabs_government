"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import Link from "next/link";
import GrantCard from "@/components/GrantCard";
import type { Grant } from "@/lib/api";
import {
  Building2,
  Bookmark,
  LogOut,
  BookmarkX,
  Search,
} from "lucide-react";

export default function BookmarksPage() {
  const { user, signOut } = useAuth();
  const [bookmarks, setBookmarks] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBookmarks() {
      const token = localStorage.getItem("govgrants_token");
      if (token) {
        try {
          const { fetchBookmarks } = await import("@/lib/api");
          const data = await fetchBookmarks(token);
          setBookmarks(data);
          setLoading(false);
          return;
        } catch {
          // fallback
        }
      }
      const stored = localStorage.getItem("govgrants_bookmarks");
      if (stored) {
        try { setBookmarks(JSON.parse(stored)); } catch { /* ignore */ }
      }
      setLoading(false);
    }
    loadBookmarks();
  }, []);

  async function handleRemoveBookmark(grantId: string) {
    const token = localStorage.getItem("govgrants_token");
    if (token) {
      try {
        const { removeBookmark: removeBm } = await import("@/lib/api");
        await removeBm(token, grantId);
      } catch { /* ignore */ }
    }
    const updated = bookmarks.filter((g) => g.id !== grantId);
    setBookmarks(updated);
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Left Sidebar */}
          <aside className="w-full lg:w-72">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              {/* Avatar */}
              <div className="mb-4 flex flex-col items-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 text-2xl font-bold text-blue-600">
                  {user?.email?.charAt(0).toUpperCase() || "U"}
                </div>
                <p className="mt-3 text-sm font-medium text-gray-900">
                  {user?.name || user?.email || "사용자"}
                </p>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>

              <hr className="my-4 border-gray-100" />

              {/* Navigation */}
              <nav className="flex flex-col gap-1">
                <Link
                  href="/mypage"
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
                >
                  <Building2 className="h-4 w-4" />
                  기업 정보
                </Link>
                <Link
                  href="/mypage/bookmarks"
                  className="flex items-center gap-3 rounded-xl bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700"
                >
                  <Bookmark className="h-4 w-4" />
                  관심 사업
                </Link>
                <button
                  onClick={signOut}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
                >
                  <LogOut className="h-4 w-4" />
                  로그아웃
                </button>
              </nav>
            </div>
          </aside>

          {/* Right Content */}
          <div className="flex-1">
            <div className="mb-6">
              <h1 className="text-xl font-bold text-gray-900">관심 사업</h1>
              <p className="mt-1 text-sm text-gray-500">
                관심있는 지원사업을 모아보세요
              </p>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="h-64 animate-pulse rounded-xl bg-gray-100"
                  />
                ))}
              </div>
            ) : bookmarks.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {bookmarks.map((grant) => (
                  <div key={grant.id} className="relative">
                    <GrantCard grant={grant} />
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        handleRemoveBookmark(grant.id);
                      }}
                      title="관심 사업 제거"
                      className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm transition-colors hover:bg-red-50"
                    >
                      <BookmarkX className="h-4 w-4 text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl bg-white py-16 text-center shadow-sm">
                <Bookmark className="mx-auto mb-4 h-12 w-12 text-gray-300" />
                <p className="mb-2 text-lg font-medium text-gray-600">
                  아직 등록한 관심 사업이 없습니다
                </p>
                <p className="mb-6 text-sm text-gray-400">
                  관심있는 지원사업을 등록하면 여기에 표시됩니다
                </p>
                <Link
                  href="/grants"
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                  <Search className="h-4 w-4" />
                  지원사업 찾기
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
