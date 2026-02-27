"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchUsers, deleteUser, type UserInfo } from "@/lib/api";
import {
  Search,
  Trash2,
  Mail,
  MailMinus,
  Bookmark,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const pageSize = 20;

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("govgrants_token") || ""
      : "";

  const loadUsers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchUsers(token, { search, page, page_size: pageSize });
      setUsers(data.items);
      setTotal(data.total);
    } catch {
      setUsers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [token, search, page]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  }

  async function handleDelete(userId: string, email: string) {
    if (!confirm(`${email} 회원을 정말 삭제하시겠습니까?`)) return;
    try {
      await deleteUser(token, userId);
      loadUsers();
    } catch (err) {
      alert("삭제에 실패했습니다.");
    }
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">회원 관리</h1>
        <p className="mt-1 text-sm text-gray-500">
          가입한 회원 목록을 확인하고 관리합니다 ({total}명)
        </p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="이름, 이메일, 기업명 검색"
            className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </form>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
                회원
              </th>
              <th className="hidden px-4 py-3 text-left text-xs font-semibold text-gray-500 sm:table-cell">
                기업
              </th>
              <th className="hidden px-4 py-3 text-left text-xs font-semibold text-gray-500 md:table-cell">
                업종/지역
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">
                이메일
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">
                북마크
              </th>
              <th className="hidden px-4 py-3 text-left text-xs font-semibold text-gray-500 lg:table-cell">
                가입일
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">
                관리
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">
                  로딩 중...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">
                  {search ? "검색 결과가 없습니다" : "가입한 회원이 없습니다"}
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="transition-colors hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {u.name || "-"}
                      </p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-sm text-gray-700 sm:table-cell">
                    {u.company_name || "-"}
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {u.industry && (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                          {u.industry}
                        </span>
                      )}
                      {u.region && (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                          {u.region}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {u.email_opt_in ? (
                      <Mail className="mx-auto h-4 w-4 text-green-500" />
                    ) : (
                      <MailMinus className="mx-auto h-4 w-4 text-gray-300" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                      <Bookmark className="h-3.5 w-3.5" />
                      {u.bookmark_count || 0}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-gray-500 lg:table-cell">
                    {u.created_at
                      ? new Date(u.created_at).toLocaleDateString("ko-KR")
                      : "-"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {u.is_admin ? (
                      <span className="text-xs font-medium text-blue-600">관리자</span>
                    ) : (
                      <button
                        onClick={() => handleDelete(u.id, u.email)}
                        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                        title="회원 삭제"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            이전
          </button>
          <span className="px-3 text-sm text-gray-600">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 disabled:opacity-40"
          >
            다음
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
