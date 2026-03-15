"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import Link from "next/link";
import GrantCard from "@/components/GrantCard";
import type { Grant } from "@/lib/api";
import { FOUNDRY } from "@/lib/theme";
import { Building2, Bookmark, LogOut, BookmarkX, Search } from "lucide-react";
import type { CSSProperties } from "react";

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
    setBookmarks((prev) => prev.filter((g) => g.id !== grantId));
  }

  const navLinkStyle = (active: boolean): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    borderRadius: 8,
    padding: "9px 12px",
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    color: active ? FOUNDRY.primary : FOUNDRY.muted,
    background: active ? "rgba(45,114,210,0.12)" : "transparent",
    textDecoration: "none",
    transition: "background 0.12s, color 0.12s",
    border: "none",
    cursor: "pointer",
    width: "100%",
    textAlign: "left",
  });

  return (
    <div
      style={{
        height: "calc(100vh - 40px)",
        overflow: "auto",
        background: FOUNDRY.bg,
      }}
    >
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "28px 20px 64px" }}>
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* Left Sidebar */}
          <aside style={{ width: 220, flexShrink: 0 }}>
            <div
              style={{
                borderRadius: 10,
                border: `1px solid ${FOUNDRY.border}`,
                background: FOUNDRY.panel,
                padding: "20px 14px",
              }}
            >
              {/* Avatar */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${FOUNDRY.border}` }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: "50%",
                    background: "rgba(45,114,210,0.2)",
                    border: `2px solid rgba(45,114,210,0.4)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                    fontWeight: 700,
                    color: FOUNDRY.primary,
                    marginBottom: 10,
                  }}
                >
                  {user?.email?.charAt(0).toUpperCase() || "U"}
                </div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: FOUNDRY.text }}>
                  {user?.name || user?.email || "사용자"}
                </p>
                <p style={{ margin: "3px 0 0", fontSize: 11, color: FOUNDRY.muted }}>{user?.email}</p>
              </div>

              {/* Navigation */}
              <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <Link
                  href="/mypage"
                  style={navLinkStyle(false)}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                    (e.currentTarget as HTMLElement).style.color = FOUNDRY.text;
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                    (e.currentTarget as HTMLElement).style.color = FOUNDRY.muted;
                  }}
                >
                  <Building2 size={14} />
                  기업 정보
                </Link>
                <Link href="/mypage/bookmarks" style={navLinkStyle(true)}>
                  <Bookmark size={14} />
                  관심 사업
                </Link>
                <button
                  onClick={signOut}
                  style={navLinkStyle(false)}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(194,48,48,0.1)";
                    (e.currentTarget as HTMLElement).style.color = FOUNDRY.danger;
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                    (e.currentTarget as HTMLElement).style.color = FOUNDRY.muted;
                  }}
                >
                  <LogOut size={14} />
                  로그아웃
                </button>
              </nav>
            </div>
          </aside>

          {/* Right Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ marginBottom: 20 }}>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: FOUNDRY.text }}>관심 사업</h1>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: FOUNDRY.muted }}>관심있는 지원사업을 모아보세요</p>
            </div>

            {loading ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
                {[...Array(4)].map((_, i) => (
                  <div key={i} style={{ height: 200, borderRadius: 10, background: "rgba(255,255,255,0.04)" }} />
                ))}
              </div>
            ) : bookmarks.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
                {bookmarks.map((grant) => (
                  <div key={grant.id} style={{ position: "relative" }}>
                    <GrantCard grant={grant} />
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        handleRemoveBookmark(grant.id);
                      }}
                      title="관심 사업 제거"
                      style={{
                        position: "absolute",
                        right: 10,
                        top: 10,
                        zIndex: 10,
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: FOUNDRY.card,
                        border: `1px solid ${FOUNDRY.border}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        transition: "background 0.12s, border-color 0.12s",
                        color: FOUNDRY.muted,
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.background = "rgba(194,48,48,0.15)";
                        (e.currentTarget as HTMLElement).style.borderColor = FOUNDRY.danger;
                        (e.currentTarget as HTMLElement).style.color = FOUNDRY.danger;
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.background = FOUNDRY.card;
                        (e.currentTarget as HTMLElement).style.borderColor = FOUNDRY.border;
                        (e.currentTarget as HTMLElement).style.color = FOUNDRY.muted;
                      }}
                    >
                      <BookmarkX size={13} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  borderRadius: 10,
                  border: `1px solid ${FOUNDRY.border}`,
                  background: FOUNDRY.panel,
                  padding: "56px 20px",
                  textAlign: "center",
                }}
              >
                <Bookmark size={40} color="rgba(255,255,255,0.1)" style={{ marginBottom: 14 }} />
                <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 500, color: FOUNDRY.muted }}>
                  아직 등록한 관심 사업이 없습니다
                </p>
                <p style={{ margin: "0 0 22px", fontSize: 13, color: "rgba(255,255,255,0.2)" }}>
                  관심있는 지원사업을 등록하면 여기에 표시됩니다
                </p>
                <Link
                  href="/grants"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    background: FOUNDRY.primary,
                    color: "#fff",
                    borderRadius: 8,
                    padding: "10px 20px",
                    fontSize: 13,
                    fontWeight: 500,
                    textDecoration: "none",
                    transition: "opacity 0.15s",
                  }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = "0.85")}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = "1")}
                >
                  <Search size={14} />
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
