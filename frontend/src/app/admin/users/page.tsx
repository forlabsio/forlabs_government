"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchUsers, deleteUser, type UserInfo } from "@/lib/api";
import { FOUNDRY } from "@/lib/theme";
import {
  Search,
  Trash2,
  Mail,
  MailMinus,
  Bookmark,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { CSSProperties } from "react";

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

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [inputFocused, setInputFocused] = useState(false);
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
    } catch {
      alert("삭제에 실패했습니다.");
    }
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div style={{ padding: "28px 28px 48px" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: FOUNDRY.text }}>회원 관리</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: FOUNDRY.muted }}>
          가입한 회원 목록을 확인하고 관리합니다 ({total}명)
        </p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} style={{ marginBottom: 20 }}>
        <div style={{ position: "relative", maxWidth: 360 }}>
          <Search
            size={14}
            color={FOUNDRY.muted}
            style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
          />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            placeholder="이름, 이메일, 기업명 검색"
            style={{
              width: "100%",
              boxSizing: "border-box",
              borderRadius: 8,
              border: `1px solid ${inputFocused ? FOUNDRY.primary : FOUNDRY.border}`,
              background: FOUNDRY.card,
              padding: "9px 12px 9px 34px",
              fontSize: 13,
              color: FOUNDRY.text,
              outline: "none",
              transition: "border-color 0.15s",
            }}
          />
        </div>
      </form>

      {/* Table */}
      <div
        style={{
          borderRadius: 10,
          border: `1px solid ${FOUNDRY.border}`,
          background: FOUNDRY.panel,
          overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={TH}>회원</th>
                <th style={TH}>기업</th>
                <th style={TH}>업종/지역</th>
                <th style={{ ...TH, textAlign: "center" }}>이메일수신</th>
                <th style={{ ...TH, textAlign: "center" }}>북마크</th>
                <th style={TH}>가입일</th>
                <th style={{ ...TH, textAlign: "center" }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: "40px 14px", textAlign: "center", fontSize: 13, color: FOUNDRY.muted }}>
                    로딩 중...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "40px 14px", textAlign: "center", fontSize: 13, color: FOUNDRY.muted }}>
                    {search ? "검색 결과가 없습니다" : "가입한 회원이 없습니다"}
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr
                    key={u.id}
                    style={{ transition: "background 0.1s" }}
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)")}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                  >
                    <td style={{ padding: "10px 14px", borderBottom: `1px solid ${FOUNDRY.border}` }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: FOUNDRY.text }}>
                        {u.name || "-"}
                      </p>
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: FOUNDRY.muted }}>{u.email}</p>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 13, color: FOUNDRY.text, borderBottom: `1px solid ${FOUNDRY.border}` }}>
                      {u.company_name || "-"}
                    </td>
                    <td style={{ padding: "10px 14px", borderBottom: `1px solid ${FOUNDRY.border}` }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {u.industry && (
                          <span style={{ background: "rgba(255,255,255,0.06)", color: FOUNDRY.muted, borderRadius: 4, padding: "2px 7px", fontSize: 11 }}>
                            {u.industry}
                          </span>
                        )}
                        {u.region && (
                          <span style={{ background: "rgba(255,255,255,0.06)", color: FOUNDRY.muted, borderRadius: 4, padding: "2px 7px", fontSize: 11 }}>
                            {u.region}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "center", borderBottom: `1px solid ${FOUNDRY.border}` }}>
                      {u.email_opt_in ? (
                        <Mail size={14} color={FOUNDRY.success} style={{ margin: "0 auto" }} />
                      ) : (
                        <MailMinus size={14} color="rgba(255,255,255,0.15)" style={{ margin: "0 auto" }} />
                      )}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "center", borderBottom: `1px solid ${FOUNDRY.border}` }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, color: FOUNDRY.muted }}>
                        <Bookmark size={12} />
                        {u.bookmark_count || 0}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: FOUNDRY.muted, borderBottom: `1px solid ${FOUNDRY.border}` }}>
                      {u.created_at ? new Date(u.created_at).toLocaleDateString("ko-KR") : "-"}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "center", borderBottom: `1px solid ${FOUNDRY.border}` }}>
                      {u.is_admin ? (
                        <span style={{ fontSize: 11, fontWeight: 600, color: FOUNDRY.primary }}>관리자</span>
                      ) : (
                        <button
                          onClick={() => handleDelete(u.id, u.email)}
                          title="회원 삭제"
                          style={{
                            background: "transparent",
                            border: "none",
                            borderRadius: 6,
                            padding: "5px",
                            cursor: "pointer",
                            color: FOUNDRY.muted,
                            transition: "background 0.12s, color 0.12s",
                            display: "inline-flex",
                          }}
                          onMouseEnter={e => {
                            (e.currentTarget as HTMLElement).style.background = "rgba(194,48,48,0.15)";
                            (e.currentTarget as HTMLElement).style.color = FOUNDRY.danger;
                          }}
                          onMouseLeave={e => {
                            (e.currentTarget as HTMLElement).style.background = "transparent";
                            (e.currentTarget as HTMLElement).style.color = FOUNDRY.muted;
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 20 }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              borderRadius: 7,
              border: `1px solid ${FOUNDRY.border}`,
              background: "transparent",
              padding: "7px 12px",
              fontSize: 13,
              color: page <= 1 ? "rgba(255,255,255,0.2)" : FOUNDRY.muted,
              cursor: page <= 1 ? "not-allowed" : "pointer",
            }}
          >
            <ChevronLeft size={13} />
            이전
          </button>
          <span style={{ padding: "0 10px", fontSize: 13, color: FOUNDRY.muted }}>
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              borderRadius: 7,
              border: `1px solid ${FOUNDRY.border}`,
              background: "transparent",
              padding: "7px 12px",
              fontSize: 13,
              color: page >= totalPages ? "rgba(255,255,255,0.2)" : FOUNDRY.muted,
              cursor: page >= totalPages ? "not-allowed" : "pointer",
            }}
          >
            다음
            <ChevronRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
