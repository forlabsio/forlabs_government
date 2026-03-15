"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search, GitBranch, TrendingUp, Network, Zap,
  LayoutDashboard, FileText, ArrowRight,
} from "lucide-react";
import { FOUNDRY } from "@/lib/theme";
import { fetchGrants } from "@/lib/api";

const QUICK_ACTIONS = [
  { icon: LayoutDashboard, label: "대시보드",       href: "/" },
  { icon: Search,          label: "과제 탐색",       href: "/grants" },
  { icon: GitBranch,       label: "Knowledge Graph", href: "/graph" },
  { icon: TrendingUp,      label: "트렌드 분석",      href: "/trends" },
  { icon: Network,         label: "기업 네트워크",    href: "/network" },
  { icon: Zap,             label: "자동 매칭",        href: "/matching" },
] as const;

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [grants, setGrants] = useState<{ id: string; title: string; category?: string }[]>([]);
  const [grantLoading, setGrantLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Listen for Cmd+K and custom event
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    }
    function handleOpen() { setOpen(true); }
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("openCommandPalette", handleOpen);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("openCommandPalette", handleOpen);
    };
  }, []);

  // Focus input when opens, clear when closes
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setGrants([]);
    }
  }, [open]);

  // Debounced grant search
  const searchGrants = useCallback(async (q: string) => {
    if (!q.trim()) { setGrants([]); return; }
    setGrantLoading(true);
    try {
      const res = await fetchGrants({ search: q, page_size: "5" });
      setGrants(res.items.slice(0, 5).map((g) => ({ id: g.id, title: g.title, category: g.category })));
    } catch {
      setGrants([]);
    } finally {
      setGrantLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchGrants(query), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, searchGrants]);

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  const filteredActions = query
    ? QUICK_ACTIONS.filter((a) => a.label.toLowerCase().includes(query.toLowerCase()))
    : QUICK_ACTIONS;

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="커맨드 팔레트"
      onClick={() => setOpen(false)}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        zIndex: 200,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: 120,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 560,
          background: FOUNDRY.panel,
          border: "1px solid rgba(45,114,210,0.4)",
          borderRadius: 12,
          boxShadow: "0 0 40px rgba(45,114,210,0.2), 0 20px 60px rgba(0,0,0,0.6)",
          overflow: "hidden",
          margin: "0 16px",
        }}
      >
        {/* Search input */}
        <div
          style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "12px 16px",
            borderBottom: `1px solid ${FOUNDRY.border}`,
          }}
        >
          <Search size={16} style={{ color: FOUNDRY.muted, flexShrink: 0 }} aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="과제 검색, 페이지 이동..."
            aria-label="커맨드 팔레트 검색"
            style={{
              flex: 1,
              background: "transparent", border: "none", outline: "none",
              color: FOUNDRY.text, fontSize: 14,
            }}
          />
          <kbd
            style={{ fontSize: 10, color: FOUNDRY.muted, opacity: 0.6 }}
            aria-label="ESC to close"
          >
            ESC
          </kbd>
        </div>

        <div style={{ maxHeight: 360, overflowY: "auto" }}>
          {/* Quick actions */}
          {filteredActions.length > 0 && (
            <div style={{ padding: "8px 0" }}>
              <p
                role="heading"
                aria-level={3}
                style={{
                  fontSize: 10, color: FOUNDRY.muted,
                  padding: "4px 16px",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  margin: 0,
                }}
              >
                빠른 이동
              </p>
              {filteredActions.map((action) => (
                <ActionButton
                  key={action.href}
                  icon={<action.icon size={14} style={{ color: FOUNDRY.primary }} aria-hidden="true" />}
                  label={action.label}
                  onClick={() => navigate(action.href)}
                />
              ))}
            </div>
          )}

          {/* Grant results */}
          {(grantLoading || grants.length > 0) && (
            <div
              style={{
                borderTop: `1px solid ${FOUNDRY.border}`,
                padding: "8px 0",
              }}
            >
              <p
                role="heading"
                aria-level={3}
                style={{
                  fontSize: 10, color: FOUNDRY.muted,
                  padding: "4px 16px",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  margin: 0,
                }}
              >
                {grantLoading ? "검색중..." : "과제"}
              </p>
              {grants.map((g) => (
                <ActionButton
                  key={g.id}
                  icon={<FileText size={14} style={{ color: FOUNDRY.muted }} aria-hidden="true" />}
                  label={g.title}
                  sub={g.category}
                  onClick={() => navigate(`/grants/${g.id}`)}
                />
              ))}
            </div>
          )}

          {/* No results */}
          {query && !grantLoading && filteredActions.length === 0 && grants.length === 0 && (
            <div style={{ padding: "24px 16px", textAlign: "center", color: FOUNDRY.muted, fontSize: 13 }}>
              &quot;{query}&quot; 에 대한 결과 없음
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Reusable action button for palette items
function ActionButton({
  icon, label, sub, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%",
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 16px",
        background: hovered ? FOUNDRY.glow : "transparent",
        border: "none",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      {icon}
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 13, color: FOUNDRY.text }}>{label}</p>
        {sub && <p style={{ margin: 0, fontSize: 10, color: FOUNDRY.muted }}>{sub}</p>}
      </div>
      <ArrowRight size={12} style={{ color: FOUNDRY.muted }} aria-hidden="true" />
    </button>
  );
}
