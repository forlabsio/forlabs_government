"use client";

import { useState, useEffect } from "react";
import {
  fetchBanners,
  createBanner as createBannerApi,
  deleteBanner as deleteBannerApi,
} from "@/lib/api";
import { FOUNDRY } from "@/lib/theme";
import { Plus, Trash2, X, Eye, MousePointerClick, Image } from "lucide-react";
import type { CSSProperties } from "react";

interface Banner {
  id: string;
  title: string;
  target_url: string;
  image_url: string;
  status: "active" | "inactive";
  impressions: number;
  clicks: number;
  created_at: string;
}

const TH: CSSProperties = {
  padding: "10px 16px",
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

function inputStyle(focused: boolean): CSSProperties {
  return {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 8,
    border: `1px solid ${focused ? FOUNDRY.primary : FOUNDRY.border}`,
    background: FOUNDRY.card,
    padding: "10px 14px",
    fontSize: 13,
    color: FOUNDRY.text,
    outline: "none",
    transition: "border-color 0.15s",
  };
}

export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", target_url: "", image_url: "" });
  const [focused, setFocused] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadBanners();
  }, []);

  async function loadBanners() {
    setLoading(true);
    try {
      const token = localStorage.getItem("govgrants_token");
      if (token) {
        const result = await fetchBanners(token);
        setBanners(result?.banners || []);
      }
    } catch {
      // Use empty array on error
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const token = localStorage.getItem("govgrants_token");
      if (token) {
        await createBannerApi(token, form);
        setShowModal(false);
        setForm({ title: "", target_url: "", image_url: "" });
        await loadBanners();
      }
    } catch {
      // Handle error silently
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("이 배너를 삭제하시겠습니까?")) return;
    try {
      const token = localStorage.getItem("govgrants_token");
      if (token) {
        await deleteBannerApi(token, id);
        await loadBanners();
      }
    } catch {
      // Handle error silently
    }
  }

  const labelStyle: CSSProperties = {
    display: "block",
    marginBottom: 6,
    fontSize: 12,
    fontWeight: 500,
    color: FOUNDRY.muted,
  };

  return (
    <div style={{ padding: "28px 28px 48px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: FOUNDRY.text }}>배너 관리</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: FOUNDRY.muted }}>홈페이지 배너를 관리합니다</p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            background: FOUNDRY.primary,
            color: "#fff",
            borderRadius: 8,
            border: "none",
            padding: "9px 16px",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = "0.85")}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = "1")}
        >
          <Plus size={14} />
          배너 등록
        </button>
      </div>

      {/* Table */}
      <div style={{ borderRadius: 10, border: `1px solid ${FOUNDRY.border}`, background: FOUNDRY.panel, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            {[...Array(3)].map((_, i) => (
              <div key={i} style={{ height: 52, borderRadius: 6, background: "rgba(255,255,255,0.04)" }} />
            ))}
          </div>
        ) : banners.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["제목", "타겟 URL", "상태", "노출수", "클릭수", "CTR", "작업"].map((h, i) => (
                    <th key={h} style={{ ...TH, textAlign: i >= 3 && i <= 5 ? "right" : i === 6 ? "center" : "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {banners.map((banner) => {
                  const ctr = banner.impressions > 0
                    ? ((banner.clicks / banner.impressions) * 100).toFixed(1)
                    : "0.0";
                  return (
                    <tr
                      key={banner.id}
                      style={{ transition: "background 0.1s" }}
                      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)")}
                      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                    >
                      <td style={{ padding: "12px 16px", borderBottom: `1px solid ${FOUNDRY.border}` }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: FOUNDRY.text }}>{banner.title}</p>
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: FOUNDRY.muted }}>{banner.created_at}</p>
                      </td>
                      <td style={{ padding: "12px 16px", borderBottom: `1px solid ${FOUNDRY.border}` }}>
                        <a
                          href={banner.target_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 13, color: FOUNDRY.primary, textDecoration: "none" }}
                        >
                          {banner.target_url.length > 40 ? banner.target_url.slice(0, 40) + "..." : banner.target_url}
                        </a>
                      </td>
                      <td style={{ padding: "12px 16px", borderBottom: `1px solid ${FOUNDRY.border}` }}>
                        <span style={{
                          background: banner.status === "active" ? "rgba(35,162,109,0.15)" : "rgba(255,255,255,0.06)",
                          color: banner.status === "active" ? FOUNDRY.success : FOUNDRY.muted,
                          borderRadius: 100,
                          padding: "3px 9px",
                          fontSize: 11,
                          fontWeight: 500,
                        }}>
                          {banner.status === "active" ? "활성" : "비활성"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right", borderBottom: `1px solid ${FOUNDRY.border}` }}>
                        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: 4, fontSize: 13, color: FOUNDRY.text }}>
                          <Eye size={12} color={FOUNDRY.muted} />
                          {banner.impressions.toLocaleString()}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right", borderBottom: `1px solid ${FOUNDRY.border}` }}>
                        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: 4, fontSize: 13, color: FOUNDRY.text }}>
                          <MousePointerClick size={12} color={FOUNDRY.muted} />
                          {banner.clicks.toLocaleString()}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right", fontSize: 13, fontWeight: 600, color: FOUNDRY.primary, borderBottom: `1px solid ${FOUNDRY.border}` }}>
                        {ctr}%
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center", borderBottom: `1px solid ${FOUNDRY.border}` }}>
                        <button
                          type="button"
                          onClick={() => handleDelete(banner.id)}
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: "56px 20px", textAlign: "center" }}>
            <Image size={36} color="rgba(255,255,255,0.1)" style={{ marginBottom: 10 }} />
            <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 500, color: FOUNDRY.muted }}>등록된 배너가 없습니다</p>
            <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.2)" }}>&quot;배너 등록&quot; 버튼으로 배너를 추가하세요</p>
          </div>
        )}
      </div>

      {/* Create Banner Modal */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.6)",
            padding: "0 16px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 480,
              borderRadius: 12,
              border: `1px solid ${FOUNDRY.border}`,
              background: FOUNDRY.panel,
              padding: "24px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: FOUNDRY.text }}>배너 등록</h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  borderRadius: 6,
                  padding: 6,
                  cursor: "pointer",
                  color: FOUNDRY.muted,
                  transition: "background 0.12s",
                  display: "inline-flex",
                }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)")}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "transparent")}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <label style={labelStyle}>배너 제목</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  onFocus={() => setFocused(f => ({ ...f, title: true }))}
                  onBlur={() => setFocused(f => ({ ...f, title: false }))}
                  placeholder="배너 제목을 입력하세요"
                  required
                  style={inputStyle(!!focused.title)}
                />
              </div>
              <div>
                <label style={labelStyle}>타겟 URL</label>
                <input
                  type="url"
                  value={form.target_url}
                  onChange={(e) => setForm((f) => ({ ...f, target_url: e.target.value }))}
                  onFocus={() => setFocused(f => ({ ...f, target_url: true }))}
                  onBlur={() => setFocused(f => ({ ...f, target_url: false }))}
                  placeholder="https://example.com"
                  required
                  style={inputStyle(!!focused.target_url)}
                />
              </div>
              <div>
                <label style={labelStyle}>이미지 URL</label>
                <input
                  type="url"
                  value={form.image_url}
                  onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
                  onFocus={() => setFocused(f => ({ ...f, image_url: true }))}
                  onBlur={() => setFocused(f => ({ ...f, image_url: false }))}
                  placeholder="https://example.com/banner.jpg"
                  required
                  style={inputStyle(!!focused.image_url)}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    borderRadius: 8,
                    border: `1px solid ${FOUNDRY.border}`,
                    background: "transparent",
                    padding: "9px 18px",
                    fontSize: 13,
                    fontWeight: 500,
                    color: FOUNDRY.muted,
                    cursor: "pointer",
                  }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  style={{
                    borderRadius: 8,
                    border: "none",
                    background: creating ? "rgba(45,114,210,0.4)" : FOUNDRY.primary,
                    padding: "9px 18px",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#fff",
                    cursor: creating ? "not-allowed" : "pointer",
                    transition: "opacity 0.15s",
                  }}
                >
                  {creating ? "등록 중..." : "등록하기"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
