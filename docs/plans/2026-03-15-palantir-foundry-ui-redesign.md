# Palantir Foundry UI/UX Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Replace the current top-header layout with a full Palantir Foundry-style shell: left icon sidebar + workspace bar + split panels + Cmd+K command palette + Data Sources panel.

**Architecture:** AppShell wraps all pages. Left sidebar (60px collapsed, 220px hover-expanded) contains module icons + data sources. Top workspace bar (40px) shows breadcrumb + Cmd+K + user. Each module page fills the remaining canvas at 100vh - 40px.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, Lucide icons, existing Cytoscape.js + Recharts

**Foundry Design System:**
```
Body:        #0B1117
Sidebar:     #161C22
Panel:       #1C2B3C
Card:        #1F2D3D
Border:      rgba(255,255,255,0.08)
Primary:     #2D72D2
Active glow: rgba(45,114,210,0.15)
Text:        #F0F4F8
Text muted:  #7B919E
Success:     #23A26D
Warning:     #BF7326
Graph nodes: Grant=#3b82f6, Agency=#f97316, TechArea=#8b5cf6, Company=#23A26D
```

---

## Task 1: Update theme.ts with Foundry color tokens

**Files:**
- Modify: `frontend/src/lib/theme.ts`

**Step 1: Update theme.ts**

Replace the full file contents with Foundry palette constants:

```ts
// Foundry design system colors
export const FOUNDRY = {
  bg:       "#0B1117",
  sidebar:  "#161C22",
  panel:    "#1C2B3C",
  card:     "#1F2D3D",
  border:   "rgba(255,255,255,0.08)",
  primary:  "#2D72D2",
  glow:     "rgba(45,114,210,0.15)",
  text:     "#F0F4F8",
  muted:    "#7B919E",
  success:  "#23A26D",
  warning:  "#BF7326",
  danger:   "#C23030",
} as const;

export const GRAPH_COLORS = {
  Grant:    "#3b82f6",
  Agency:   "#f97316",
  TechArea: "#8b5cf6",
  Company:  "#23A26D",
} as const;

export const SOURCE_LABELS: Record<string, string> = {
  bizinfo:  "기업마당",
  kocca:    "KOCCA",
  kstartup: "K-Startup",
  subsidy24: "보조금24",
  smes:     "중소벤처24",
};

export const SOURCE_KEYS = ["bizinfo", "kocca", "kstartup", "subsidy24", "smes"] as const;

export const CHART_COLORS = [
  "#3b82f6", "#f97316", "#10b981", "#8b5cf6", "#2D72D2",
  "#ef4444", "#eab308", "#06b6d4",
];

export const INDUSTRY_OPTIONS = [
  "IT/소프트웨어", "제조업", "바이오/의료", "문화/콘텐츠",
  "농업/식품", "건설", "유통/물류", "서비스업",
];

export const REGION_OPTIONS = [
  "전국", "서울", "경기", "인천", "부산", "대구",
  "광주", "대전", "울산", "세종", "강원", "충북",
  "충남", "전북", "전남", "경북", "경남", "제주",
];
```

**Step 2: Verify build still passes**

```bash
cd /Users/peterchae/forlabs_government/frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors (only unused import warnings OK)

**Step 3: Commit**

```bash
git add frontend/src/lib/theme.ts
git commit -m "feat: add Foundry design system color tokens to theme.ts"
```

---

## Task 2: Create AppShell — Left Sidebar + Workspace Bar

**Files:**
- Create: `frontend/src/components/AppShell.tsx`
- Modify: `frontend/src/app/layout.tsx` (swap Header → AppShell)

**Step 1: Create AppShell.tsx**

This is the most important component. Full code:

```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Search, GitBranch, TrendingUp,
  Network, Zap, Database, Settings, ChevronRight,
  User, LogOut, Shield, Bookmark, Bell,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { FOUNDRY } from "@/lib/theme";

const NAV_ITEMS = [
  { id: "home",     href: "/",          icon: LayoutDashboard, label: "대시보드",         section: "main" },
  { id: "grants",   href: "/grants",     icon: Search,          label: "과제 탐색",         section: "main" },
  { id: "graph",    href: "/graph",      icon: GitBranch,       label: "Knowledge Graph",  section: "intel" },
  { id: "trends",   href: "/trends",     icon: TrendingUp,      label: "트렌드 분석",        section: "intel" },
  { id: "network",  href: "/network",    icon: Network,         label: "기업 네트워크",      section: "intel" },
  { id: "matching", href: "/matching",   icon: Zap,             label: "자동 매칭",         section: "intel" },
  { id: "sources",  href: "#sources",    icon: Database,        label: "Data Sources",     section: "data" },
] as const;

const BOTTOM_ITEMS = [
  { id: "settings", href: "/admin", icon: Settings, label: "설정/관리자" },
] as const;

// Data sources status (static mock — real status shown in DataSourcesPanel)
const DATA_SOURCES = [
  { id: "bizinfo",  name: "기업마당",   live: true },
  { id: "kstartup", name: "K-Startup",  live: true },
  { id: "kocca",    name: "KOCCA",      live: true },
  { id: "subsidy24",name: "보조금24",   live: true },
  { id: "smes",     name: "중소벤처24", live: true },
  { id: "neo4j",    name: "Neo4j Graph",live: true },
];

interface Props {
  children: React.ReactNode;
  breadcrumb?: string;
}

export default function AppShell({ children, breadcrumb }: Props) {
  const pathname = usePathname();
  const { user, loading, signOut } = useAuth();
  const [hovered, setHovered] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const activeItem = NAV_ITEMS.find((item) => {
    if (item.href === "/") return pathname === "/";
    return pathname.startsWith(item.href) && item.href !== "#sources";
  });

  const displayName = user?.name || user?.email?.split("@")[0] || "사용자";
  const avatarLetter = user?.email?.charAt(0).toUpperCase() || "G";

  // Breadcrumb path
  const breadcrumbParts = [
    { label: "GovGraph", href: "/" },
    ...(activeItem && activeItem.href !== "/" ? [{ label: activeItem.label, href: activeItem.href }] : []),
    ...(breadcrumb ? [{ label: breadcrumb }] : []),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: FOUNDRY.bg }}>

      {/* ── Workspace Bar (40px) ─────────────────────────────── */}
      <div
        style={{
          height: 40,
          background: FOUNDRY.sidebar,
          borderBottom: `1px solid ${FOUNDRY.border}`,
          display: "flex",
          alignItems: "center",
          paddingLeft: 72,  // sidebar width + gap
          paddingRight: 12,
          gap: 8,
          flexShrink: 0,
          zIndex: 40,
        }}
      >
        {/* Breadcrumb */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 4 }}>
          {breadcrumbParts.map((part, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {i > 0 && <ChevronRight size={12} style={{ color: FOUNDRY.muted }} />}
              {part.href ? (
                <Link
                  href={part.href}
                  style={{
                    fontSize: 12,
                    color: i === breadcrumbParts.length - 1 ? FOUNDRY.text : FOUNDRY.muted,
                    textDecoration: "none",
                    fontFamily: "monospace",
                  }}
                >
                  {part.label}
                </Link>
              ) : (
                <span style={{ fontSize: 12, color: FOUNDRY.text, fontFamily: "monospace" }}>
                  {part.label}
                </span>
              )}
            </span>
          ))}
        </div>

        {/* Cmd+K hint */}
        <button
          onClick={() => {
            // dispatch custom event to open command palette
            window.dispatchEvent(new CustomEvent("openCommandPalette"));
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "3px 10px",
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${FOUNDRY.border}`,
            borderRadius: 6,
            cursor: "pointer",
            color: FOUNDRY.muted,
            fontSize: 11,
          }}
        >
          <Search size={12} />
          <span>검색...</span>
          <kbd style={{ fontSize: 10, opacity: 0.6 }}>⌘K</kbd>
        </button>

        {/* Notifications bell */}
        <button
          style={{
            width: 28, height: 28,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "transparent",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            color: FOUNDRY.muted,
          }}
        >
          <Bell size={14} />
        </button>

        {/* User avatar */}
        {!loading && user && (
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              style={{
                width: 26, height: 26,
                borderRadius: "50%",
                background: FOUNDRY.primary,
                border: "none",
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, color: "#fff",
              }}
            >
              {avatarLetter}
            </button>
            {profileOpen && (
              <div
                style={{
                  position: "absolute", right: 0, top: "calc(100% + 6px)",
                  width: 160,
                  background: FOUNDRY.panel,
                  border: `1px solid ${FOUNDRY.border}`,
                  borderRadius: 8,
                  padding: "4px 0",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                  zIndex: 100,
                }}
              >
                <div style={{ padding: "8px 12px", borderBottom: `1px solid ${FOUNDRY.border}` }}>
                  <p style={{ fontSize: 11, color: FOUNDRY.text, fontWeight: 600 }}>{displayName}</p>
                  <p style={{ fontSize: 10, color: FOUNDRY.muted, marginTop: 2 }}>{user.email}</p>
                </div>
                {[
                  { href: "/mypage",    icon: User,     label: "내 프로필" },
                  { href: "/bookmarks", icon: Bookmark, label: "북마크" },
                  ...(user?.is_admin ? [{ href: "/admin", icon: Shield, label: "관리자" }] : []),
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setProfileOpen(false)}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "7px 12px",
                      textDecoration: "none",
                      color: FOUNDRY.muted,
                      fontSize: 12,
                    }}
                  >
                    <item.icon size={13} />
                    {item.label}
                  </Link>
                ))}
                <div style={{ borderTop: `1px solid ${FOUNDRY.border}`, marginTop: 4 }} />
                <button
                  onClick={() => { setProfileOpen(false); signOut(); }}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 8,
                    padding: "7px 12px",
                    background: "transparent", border: "none",
                    color: FOUNDRY.muted, fontSize: 12, cursor: "pointer",
                  }}
                >
                  <LogOut size={13} />
                  로그아웃
                </button>
              </div>
            )}
          </div>
        )}
        {!loading && !user && (
          <Link
            href="/login"
            style={{
              fontSize: 11, color: FOUNDRY.text,
              padding: "3px 10px",
              background: FOUNDRY.primary,
              borderRadius: 5,
              textDecoration: "none",
            }}
          >
            로그인
          </Link>
        )}
      </div>

      {/* ── Main body (sidebar + canvas) ─────────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── Left Sidebar ─────────────────────────────────────── */}
        <div
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => { setHovered(false); setSourcesOpen(false); }}
          style={{
            width: hovered ? 220 : 60,
            flexShrink: 0,
            background: FOUNDRY.sidebar,
            borderRight: `1px solid ${FOUNDRY.border}`,
            display: "flex",
            flexDirection: "column",
            transition: "width 200ms ease",
            overflow: "hidden",
            zIndex: 30,
          }}
        >
          {/* Logo */}
          <div
            style={{
              height: 48,
              display: "flex",
              alignItems: "center",
              padding: hovered ? "0 16px" : "0 16px",
              borderBottom: `1px solid ${FOUNDRY.border}`,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 28, height: 28,
                background: FOUNDRY.primary,
                borderRadius: 6,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <GitBranch size={14} color="#fff" />
            </div>
            {hovered && (
              <span style={{
                marginLeft: 10, fontSize: 13, fontWeight: 700,
                color: FOUNDRY.text, whiteSpace: "nowrap",
              }}>
                GovGraph
              </span>
            )}
          </div>

          {/* Nav items */}
          <nav style={{ flex: 1, padding: "8px 0", overflowY: "auto" }}>
            {/* MAIN section */}
            {hovered && (
              <p style={{ fontSize: 9, color: FOUNDRY.muted, padding: "4px 16px 2px", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                메인
              </p>
            )}
            {NAV_ITEMS.filter((i) => i.section === "main").map((item) => (
              <SidebarItem
                key={item.id}
                item={item}
                active={activeItem?.id === item.id}
                expanded={hovered}
              />
            ))}

            {/* INTELLIGENCE section */}
            <div style={{ marginTop: 8 }}>
              {hovered && (
                <p style={{ fontSize: 9, color: FOUNDRY.muted, padding: "4px 16px 2px", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  Intelligence
                </p>
              )}
              {NAV_ITEMS.filter((i) => i.section === "intel").map((item) => (
                <SidebarItem
                  key={item.id}
                  item={item}
                  active={activeItem?.id === item.id}
                  expanded={hovered}
                />
              ))}
            </div>

            {/* DATA section */}
            <div style={{ marginTop: 8 }}>
              {hovered && (
                <p style={{ fontSize: 9, color: FOUNDRY.muted, padding: "4px 16px 2px", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  Data
                </p>
              )}
              {/* Data Sources special item */}
              <button
                onClick={() => setSourcesOpen(!sourcesOpen)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "7px 16px",
                  background: sourcesOpen ? FOUNDRY.glow : "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: sourcesOpen ? FOUNDRY.primary : FOUNDRY.muted,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  borderLeft: sourcesOpen ? `2px solid ${FOUNDRY.primary}` : "2px solid transparent",
                }}
              >
                <Database size={16} style={{ flexShrink: 0 }} />
                {hovered && <span style={{ fontSize: 13 }}>Data Sources</span>}
                {hovered && (
                  <span
                    style={{
                      marginLeft: "auto",
                      width: 6, height: 6,
                      borderRadius: "50%",
                      background: "#23A26D",
                      flexShrink: 0,
                    }}
                  />
                )}
              </button>
            </div>
          </nav>

          {/* Bottom items */}
          <div style={{ borderTop: `1px solid ${FOUNDRY.border}`, padding: "8px 0" }}>
            {BOTTOM_ITEMS.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "7px 16px",
                  color: FOUNDRY.muted,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                <item.icon size={16} style={{ flexShrink: 0 }} />
                {hovered && <span style={{ fontSize: 13 }}>{item.label}</span>}
              </Link>
            ))}
          </div>

          {/* Data Sources Panel (expanded inline in sidebar) */}
          {sourcesOpen && hovered && (
            <div
              style={{
                position: "absolute",
                left: 220,
                top: 40,
                width: 240,
                background: FOUNDRY.panel,
                border: `1px solid ${FOUNDRY.border}`,
                borderRadius: "0 8px 8px 0",
                padding: 16,
                zIndex: 50,
                boxShadow: "4px 0 20px rgba(0,0,0,0.4)",
              }}
            >
              <p style={{ fontSize: 10, color: FOUNDRY.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
                DATA CONNECTIONS
              </p>
              {DATA_SOURCES.map((src) => (
                <div
                  key={src.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: src.live ? "#23A26D" : "#C23030",
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ flex: 1, fontSize: 12, color: FOUNDRY.text }}>{src.name}</span>
                  <span style={{ fontSize: 10, color: "#23A26D" }}>{src.live ? "LIVE" : "DOWN"}</span>
                </div>
              ))}
              <div style={{ borderTop: `1px solid ${FOUNDRY.border}`, marginTop: 12, paddingTop: 10 }}>
                <p style={{ fontSize: 10, color: FOUNDRY.muted }}>Last sync: 2m ago</p>
                <p style={{ fontSize: 10, color: FOUNDRY.muted, marginTop: 4 }}>Total: 10,938 grants</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Canvas ──────────────────────────────────────────── */}
        <main style={{ flex: 1, overflow: "auto" }}>
          {children}
        </main>
      </div>
    </div>
  );
}

// ── SidebarItem helper ───────────────────────────────────────
function SidebarItem({
  item,
  active,
  expanded,
}: {
  item: { href: string; icon: React.ComponentType<{ size?: number }>; label: string };
  active: boolean;
  expanded: boolean;
}) {
  return (
    <Link
      href={item.href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "7px 16px",
        background: active ? FOUNDRY.glow : "transparent",
        color: active ? FOUNDRY.primary : FOUNDRY.muted,
        textDecoration: "none",
        whiteSpace: "nowrap",
        borderLeft: active ? `2px solid ${FOUNDRY.primary}` : "2px solid transparent",
        transition: "background 150ms",
      }}
    >
      <item.icon size={16} />
      {expanded && (
        <span style={{ fontSize: 13 }}>{item.label}</span>
      )}
    </Link>
  );
}
```

**Step 2: Update layout.tsx**

In `frontend/src/app/layout.tsx`, replace `<Header />` with `<AppShell>`:

```tsx
// Remove: import Header from "@/components/Header";
// Add:    import AppShell from "@/components/AppShell";

// Remove: <Header />
//         {children}
// Add:    <AppShell>{children}</AppShell>
```

Also update `<body>` background color to `#0B1117`.

**Step 3: Verify local dev server still runs**

```bash
cd /Users/peterchae/forlabs_government/frontend && npm run dev &
# Check http://localhost:3000 loads without error
curl -s http://localhost:3000 | grep -c "html"
```

**Step 4: Commit**

```bash
git add frontend/src/components/AppShell.tsx frontend/src/app/layout.tsx
git commit -m "feat: replace Header with Palantir Foundry AppShell (sidebar + workspace bar)"
```

---

## Task 3: Create CommandPalette Component (Cmd+K)

**Files:**
- Create: `frontend/src/components/CommandPalette.tsx`
- Modify: `frontend/src/components/AppShell.tsx` (import and render CommandPalette)

**Step 1: Create CommandPalette.tsx**

```tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, GitBranch, TrendingUp, Network, Zap, LayoutDashboard, FileText, ArrowRight } from "lucide-react";
import { FOUNDRY } from "@/lib/theme";
import { fetchGrants } from "@/lib/api";

const QUICK_ACTIONS = [
  { icon: LayoutDashboard, label: "대시보드", href: "/" },
  { icon: Search,          label: "과제 탐색",        href: "/grants" },
  { icon: GitBranch,       label: "Knowledge Graph",  href: "/graph" },
  { icon: TrendingUp,      label: "트렌드 분석",       href: "/trends" },
  { icon: Network,         label: "기업 네트워크",      href: "/network" },
  { icon: Zap,             label: "자동 매칭",         href: "/matching" },
];

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [grants, setGrants] = useState<{ id: string; title: string; category?: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Open on Cmd+K or custom event
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    }
    function handleCustomEvent() { setOpen(true); }
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("openCommandPalette", handleCustomEvent);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("openCommandPalette", handleCustomEvent);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setGrants([]);
    }
  }, [open]);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setGrants([]); return; }
    setLoading(true);
    try {
      const res = await fetchGrants({ search: q, page_size: "5" });
      setGrants(res.items.slice(0, 5).map((g) => ({ id: g.id, title: g.title, category: g.category })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, search]);

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  const filteredActions = QUICK_ACTIONS.filter((a) =>
    !query || a.label.toLowerCase().includes(query.toLowerCase())
  );

  if (!open) return null;

  return (
    // Backdrop
    <div
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
          width: "100%",
          maxWidth: 560,
          background: FOUNDRY.panel,
          border: `1px solid rgba(45,114,210,0.4)`,
          borderRadius: 12,
          boxShadow: "0 0 40px rgba(45,114,210,0.2), 0 20px 60px rgba(0,0,0,0.6)",
          overflow: "hidden",
        }}
      >
        {/* Search input */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: `1px solid ${FOUNDRY.border}` }}>
          <Search size={16} style={{ color: FOUNDRY.muted, flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="과제 검색, 페이지 이동, 명령..."
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: FOUNDRY.text,
              fontSize: 14,
            }}
          />
          <kbd style={{ fontSize: 10, color: FOUNDRY.muted, opacity: 0.6 }}>ESC</kbd>
        </div>

        <div style={{ maxHeight: 360, overflowY: "auto" }}>
          {/* Quick actions */}
          {filteredActions.length > 0 && (
            <div style={{ padding: "8px 0" }}>
              <p style={{ fontSize: 10, color: FOUNDRY.muted, padding: "4px 16px", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                빠른 이동
              </p>
              {filteredActions.map((action) => (
                <button
                  key={action.href}
                  onClick={() => navigate(action.href)}
                  style={{
                    width: "100%",
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 16px",
                    background: "transparent", border: "none",
                    color: FOUNDRY.text, cursor: "pointer",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = FOUNDRY.glow; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <action.icon size={14} style={{ color: FOUNDRY.primary, flexShrink: 0 }} />
                  <span style={{ fontSize: 13 }}>{action.label}</span>
                  <ArrowRight size={12} style={{ marginLeft: "auto", color: FOUNDRY.muted }} />
                </button>
              ))}
            </div>
          )}

          {/* Grant search results */}
          {(grants.length > 0 || (loading && query)) && (
            <div style={{ borderTop: `1px solid ${FOUNDRY.border}`, padding: "8px 0" }}>
              <p style={{ fontSize: 10, color: FOUNDRY.muted, padding: "4px 16px", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {loading ? "검색중..." : "과제"}
              </p>
              {grants.map((g) => (
                <button
                  key={g.id}
                  onClick={() => navigate(`/grants/${g.id}`)}
                  style={{
                    width: "100%",
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 16px",
                    background: "transparent", border: "none",
                    color: FOUNDRY.text, cursor: "pointer",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = FOUNDRY.glow; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <FileText size={14} style={{ color: FOUNDRY.muted, flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 13, marginBottom: 1 }}>{g.title}</p>
                    {g.category && <p style={{ fontSize: 10, color: FOUNDRY.muted }}>{g.category}</p>}
                  </div>
                  <ArrowRight size={12} style={{ marginLeft: "auto", color: FOUNDRY.muted }} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Add CommandPalette to AppShell.tsx**

In AppShell.tsx, at the top import and render inside the main wrapper:

```tsx
import CommandPalette from "@/components/CommandPalette";
// Inside the return JSX, after the <div style={{display:"flex"...}}> wrapper add:
<CommandPalette />
```

**Step 3: Commit**

```bash
git add frontend/src/components/CommandPalette.tsx frontend/src/components/AppShell.tsx
git commit -m "feat: add Cmd+K command palette with grant search and navigation"
```

---

## Task 4: Redesign Homepage — Foundry Dashboard

**Files:**
- Modify: `frontend/src/app/page.tsx`

The new homepage removes the hero section and replaces it with a Foundry-style **Object Overview** dashboard.

**New layout:**

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchGrants, type Grant } from "@/lib/api";
import { FOUNDRY } from "@/lib/theme";
import { formatDDay, getDDay } from "@/lib/format";
import { GitBranch, TrendingUp, Network, Zap, ArrowRight, Flame, Clock } from "lucide-react";

const INTEL_MODULES = [
  { href: "/graph",    icon: GitBranch,  label: "Knowledge Graph",  desc: "과제·기관·기술 관계",   color: "#3b82f6" },
  { href: "/trends",   icon: TrendingUp, label: "트렌드 분석",        desc: "기술·산업별 동향",       color: "#f97316" },
  { href: "/network",  icon: Network,    label: "기업 네트워크",      desc: "유사 기업 클러스터",     color: "#8b5cf6" },
  { href: "/matching", icon: Zap,        label: "자동 매칭",         desc: "내 기업 맞춤 과제",      color: "#23A26D" },
] as const;

type Tab = "urgent" | "recent";

export default function HomePage() {
  const [grants, setGrants] = useState<Record<Tab, Grant[]>>({ urgent: [], recent: [] });
  const [tab, setTab] = useState<Tab>("urgent");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, accepting: 0 });

  useEffect(() => {
    async function load() {
      try {
        const [urgentRes, recentRes] = await Promise.all([
          fetchGrants({ sort: "deadline", page_size: "10" }).catch(() => null),
          fetchGrants({ sort: "recent",   page_size: "10" }).catch(() => null),
        ]);
        setGrants({ urgent: urgentRes?.items || [], recent: recentRes?.items || [] });
        const total = urgentRes?.total || recentRes?.total || 0;
        const accepting = urgentRes?.items?.filter((g) => g.status === "접수중").length || 0;
        setStats({ total, accepting });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div style={{ background: FOUNDRY.bg, minHeight: "100%", padding: "24px 28px" }}>

      {/* Object Overview header */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 10, color: FOUNDRY.muted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>
          OBJECT OVERVIEW
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {[
            { value: stats.total.toLocaleString() || "—", label: "Total Grants" },
            { value: "1,024", label: "Accepting" },
            { value: "268", label: "Agencies" },
            { value: "5",   label: "Tech Areas" },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                background: FOUNDRY.card,
                border: `1px solid ${FOUNDRY.border}`,
                borderRadius: 8,
                padding: "14px 16px",
              }}
            >
              <p style={{ fontSize: 22, fontWeight: 700, color: FOUNDRY.text, fontFamily: "monospace" }}>
                {stat.value}
              </p>
              <p style={{ fontSize: 11, color: FOUNDRY.muted, marginTop: 2 }}>{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Intelligence Modules */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 10, color: FOUNDRY.muted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>
          INTELLIGENCE MODULES
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {INTEL_MODULES.map(({ href, icon: Icon, label, desc, color }) => (
            <Link
              key={href}
              href={href}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 14px",
                background: FOUNDRY.card,
                border: `1px solid ${FOUNDRY.border}`,
                borderRadius: 8,
                textDecoration: "none",
              }}
            >
              <div
                style={{
                  width: 34, height: 34,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  borderRadius: 8,
                  background: `${color}18`,
                  flexShrink: 0,
                }}
              >
                <Icon size={16} color={color} />
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: FOUNDRY.text }}>{label}</p>
                <p style={{ fontSize: 10, color: FOUNDRY.muted }}>{desc}</p>
              </div>
              <ArrowRight size={12} color={FOUNDRY.muted} style={{ marginLeft: "auto" }} />
            </Link>
          ))}
        </div>
      </div>

      {/* Grant list */}
      <div>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
          <p style={{ fontSize: 10, color: FOUNDRY.muted, letterSpacing: "0.12em", textTransform: "uppercase", flex: 1 }}>
            GRANTS
          </p>
          <div style={{ display: "flex", gap: 2 }}>
            {([["urgent", "마감임박", Flame], ["recent", "최근등록", Clock]] as const).map(([key, label, Icon]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "4px 10px",
                  background: tab === key ? FOUNDRY.glow : "transparent",
                  border: `1px solid ${tab === key ? FOUNDRY.primary : "transparent"}`,
                  borderRadius: 5,
                  cursor: "pointer",
                  color: tab === key ? FOUNDRY.primary : FOUNDRY.muted,
                  fontSize: 11,
                }}
              >
                <Icon size={11} /> {label}
              </button>
            ))}
          </div>
          <Link href="/grants" style={{ fontSize: 11, color: FOUNDRY.muted, textDecoration: "none", marginLeft: 12, display: "flex", alignItems: "center", gap: 4 }}>
            전체 보기 <ArrowRight size={11} />
          </Link>
        </div>
        <div style={{ background: FOUNDRY.card, border: `1px solid ${FOUNDRY.border}`, borderRadius: 8, overflow: "hidden" }}>
          {loading
            ? [...Array(6)].map((_, i) => (
                <div key={i} style={{ height: 52, background: FOUNDRY.card, borderBottom: `1px solid ${FOUNDRY.border}`, padding: "14px 16px" }}>
                  <div style={{ height: 12, width: "60%", borderRadius: 4, background: "rgba(255,255,255,0.06)" }} />
                </div>
              ))
            : grants[tab].map((grant) => {
                const dday = getDDay(grant.end_date);
                const ddayText = formatDDay(grant.end_date);
                const isUrgent = dday !== null && dday >= -7 && dday <= 0;
                return (
                  <Link
                    key={grant.id}
                    href={`/grants/${grant.id}`}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "11px 16px",
                      borderBottom: `1px solid ${FOUNDRY.border}`,
                      textDecoration: "none",
                    }}
                  >
                    <span
                      style={{
                        width: 52, textAlign: "center",
                        fontSize: 10, fontWeight: 700,
                        color: isUrgent ? "#C23030" : FOUNDRY.primary,
                        fontFamily: "monospace",
                        flexShrink: 0,
                      }}
                    >
                      {ddayText}
                    </span>
                    <span style={{ flex: 1, fontSize: 13, color: FOUNDRY.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {grant.title}
                    </span>
                    <span style={{ fontSize: 11, color: FOUNDRY.muted, flexShrink: 0 }}>{grant.organization}</span>
                    {grant.status === "접수중" && (
                      <span style={{ fontSize: 9, color: "#23A26D", background: "rgba(35,162,109,0.12)", borderRadius: 3, padding: "2px 6px", flexShrink: 0 }}>
                        LIVE
                      </span>
                    )}
                  </Link>
                );
              })}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/app/page.tsx
git commit -m "feat: redesign homepage as Foundry-style Object Overview dashboard"
```

---

## Task 5: Knowledge Graph — Split Panel Layout

**Files:**
- Modify: `frontend/src/app/graph/page.tsx`

Replace the current single-column layout with a **75/25 split panel** where the right panel shows the Object Inspector when a node is clicked.

The Inspector panel must:
- Start hidden (no node selected)
- Slide in from the right when a node is tapped
- Show: node type badge, label, grant_count, total_amount, related links
- CTAs: "드릴다운", "과제 목록 보기"

Key changes to `graph/page.tsx`:
1. Outer layout: `display: flex` — left canvas `flex: 1`, right inspector `width: 280px` (collapsible)
2. Pass `onNodeClick` callback to `<KnowledgeGraph>` — set selected node state
3. Right panel renders node details from `selectedNode`
4. All existing drilldown / breadcrumb / hint logic stays intact

**Inspector panel JSX (add to graph/page.tsx):**

```tsx
// State additions:
const [selectedNode, setSelectedNode] = useState<GraphNode["data"] | null>(null);

// Wrap current graph container in flex:
<div style={{ display: "flex", height: "calc(100vh - 40px)" }}>
  {/* Graph canvas */}
  <div style={{ flex: 1, position: "relative" }}>
    {/* existing graph JSX, unchanged */}
    <KnowledgeGraph
      data={displayData}
      mode={mode}
      cyRef={cyRef}
      onNodeClick={(node) => {
        setSelectedNode(node);
        // existing highlight logic stays in KnowledgeGraph
      }}
    />
    {/* existing overlays (legend, zoom, hint, breadcrumb) unchanged */}
  </div>

  {/* Inspector panel */}
  <div
    style={{
      width: selectedNode ? 280 : 0,
      overflow: "hidden",
      transition: "width 200ms ease",
      background: FOUNDRY.panel,
      borderLeft: `1px solid ${FOUNDRY.border}`,
      flexShrink: 0,
    }}
  >
    {selectedNode && (
      <div style={{ width: 280, padding: 16, height: "100%", overflowY: "auto" }}>
        <p style={{ fontSize: 9, color: FOUNDRY.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
          OBJECT INSPECTOR
        </p>
        <div
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "3px 8px",
            background: FOUNDRY.glow,
            border: `1px solid rgba(45,114,210,0.3)`,
            borderRadius: 4,
            marginBottom: 12,
          }}
        >
          <span style={{ fontSize: 10, color: FOUNDRY.primary }}>{selectedNode.type}</span>
        </div>
        <p style={{ fontSize: 14, fontWeight: 700, color: FOUNDRY.text, marginBottom: 16, lineHeight: 1.4 }}>
          {selectedNode.label}
        </p>
        {/* Stats */}
        {[
          selectedNode.grant_count != null && { label: "과제 수", value: `${selectedNode.grant_count}개` },
          selectedNode.total_amount != null && { label: "총 지원액", value: selectedNode.total_amount >= 1e8 ? `${(selectedNode.total_amount/1e8).toFixed(1)}억` : `${Math.round(selectedNode.total_amount/1e4)}만` },
          selectedNode.amount_max != null && { label: "최대 지원액", value: selectedNode.amount_max >= 1e8 ? `${(selectedNode.amount_max/1e8).toFixed(1)}억` : `${Math.round(selectedNode.amount_max/1e4)}만` },
          selectedNode.end_date && { label: "마감일", value: selectedNode.end_date },
        ].filter(Boolean).map((stat: any) => (
          <div key={stat.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: FOUNDRY.muted }}>{stat.label}</span>
            <span style={{ fontSize: 11, color: FOUNDRY.text, fontFamily: "monospace" }}>{stat.value}</span>
          </div>
        ))}
        {/* Actions */}
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 8 }}>
          {(selectedNode.type === "Agency" || selectedNode.type === "TechArea") && (
            <button
              onClick={() => drillDown(selectedNode.id)}
              style={{
                padding: "8px 12px", background: FOUNDRY.primary,
                border: "none", borderRadius: 6, color: "#fff",
                fontSize: 12, cursor: "pointer", fontWeight: 600,
              }}
            >
              드릴다운 →
            </button>
          )}
          {selectedNode.type === "Grant" && (
            <Link
              href={`/grants/${selectedNode.id}`}
              style={{
                display: "block", padding: "8px 12px",
                background: FOUNDRY.primary,
                borderRadius: 6, color: "#fff",
                fontSize: 12, textDecoration: "none", textAlign: "center", fontWeight: 600,
              }}
            >
              과제 상세 →
            </Link>
          )}
          <button
            onClick={() => setSelectedNode(null)}
            style={{
              padding: "8px 12px",
              background: "transparent",
              border: `1px solid ${FOUNDRY.border}`,
              borderRadius: 6, color: FOUNDRY.muted,
              fontSize: 12, cursor: "pointer",
            }}
          >
            닫기
          </button>
        </div>
      </div>
    )}
  </div>
</div>
```

**Step 2: Update FOUNDRY import in graph/page.tsx**

```tsx
import { FOUNDRY } from "@/lib/theme";
```

Replace all hardcoded colors with FOUNDRY tokens where applicable (bg, panel, border, text, muted).

**Step 3: Commit**

```bash
git add frontend/src/app/graph/page.tsx
git commit -m "feat: Knowledge Graph split panel with Object Inspector"
```

---

## Task 6: Matching Page — 3-Column Foundry Layout

**Files:**
- Modify: `frontend/src/app/matching/page.tsx`

Replace the current vertical step-based layout with a Foundry 3-column layout:
- **Left (260px):** Query Params form (always visible, non-step-based)
- **Center (flex):** Match Path Graph (Cytoscape)
- **Right (320px):** Matched Grants list

No more "Step 1/2/3" — all panels visible simultaneously. Form on left, graph updates on submit.

Key structure:
```tsx
<div style={{ display: "flex", height: "calc(100vh - 40px)", background: FOUNDRY.bg }}>
  {/* Left: Query Params */}
  <div style={{ width: 260, borderRight: `1px solid ${FOUNDRY.border}`, padding: 16, overflowY: "auto" }}>
    <p style={{ /* QUERY PARAMS label */ }}>QUERY PARAMS</p>
    {/* Form fields */}
    {/* Match button */}
  </div>

  {/* Center: Graph */}
  <div style={{ flex: 1, position: "relative" }}>
    {result ? <KnowledgeGraph data={result.graph} /> : <EmptyState />}
  </div>

  {/* Right: Results */}
  <div style={{ width: 320, borderLeft: `1px solid ${FOUNDRY.border}`, overflowY: "auto" }}>
    <p style={{ /* MATCHED GRANTS label */ }}>MATCHED GRANTS</p>
    {result?.matched_grants.map((grant, idx) => (
      <GrantResultCard key={grant.grant_id} grant={grant} rank={idx + 1} />
    ))}
  </div>
</div>
```

Style all form inputs and select elements with Foundry tokens (bg: FOUNDRY.card, border: FOUNDRY.border, color: FOUNDRY.text).

**Step 2: Commit**

```bash
git add frontend/src/app/matching/page.tsx
git commit -m "feat: Matching page 3-column Foundry layout (form | graph | results)"
```

---

## Task 7: Toast Notification Component (Foundry style)

**Files:**
- Create: `frontend/src/components/Toaster.tsx`
- Modify: `frontend/src/components/AppShell.tsx` (add Toaster + export toast fn)

**Step 1: Create Toaster.tsx**

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle, AlertTriangle, X, Info } from "lucide-react";
import { FOUNDRY } from "@/lib/theme";

type ToastType = "success" | "warning" | "info" | "error";

interface Toast {
  id: string;
  message: string;
  sub?: string;
  type: ToastType;
}

let addToastFn: ((toast: Omit<Toast, "id">) => void) | null = null;

export function toast(message: string, options: { sub?: string; type?: ToastType } = {}) {
  addToastFn?.({ message, sub: options.sub, type: options.type || "info" });
}

const ICONS = { success: CheckCircle, warning: AlertTriangle, error: AlertTriangle, info: Info };
const COLORS = {
  success: { border: "#23A26D", icon: "#23A26D" },
  warning: { border: "#BF7326", icon: "#BF7326" },
  error:   { border: "#C23030", icon: "#C23030" },
  info:    { border: FOUNDRY.primary, icon: FOUNDRY.primary },
};

export default function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((t: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 3000);
  }, []);

  useEffect(() => {
    addToastFn = addToast;
    return () => { addToastFn = null; };
  }, [addToast]);

  return (
    <div style={{ position: "fixed", top: 56, right: 16, display: "flex", flexDirection: "column", gap: 8, zIndex: 300 }}>
      {toasts.map((t) => {
        const Icon = ICONS[t.type];
        const colors = COLORS[t.type];
        return (
          <div
            key={t.id}
            style={{
              display: "flex", alignItems: "flex-start", gap: 10,
              padding: "12px 14px",
              background: FOUNDRY.panel,
              border: `1px solid ${FOUNDRY.border}`,
              borderLeft: `3px solid ${colors.border}`,
              borderRadius: 8,
              width: 300,
              boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
              animation: "slideIn 200ms ease",
            }}
          >
            <Icon size={15} style={{ color: colors.icon, flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12, color: FOUNDRY.text, fontWeight: 600 }}>{t.message}</p>
              {t.sub && <p style={{ fontSize: 11, color: FOUNDRY.muted, marginTop: 2 }}>{t.sub}</p>}
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              style={{ background: "none", border: "none", cursor: "pointer", color: FOUNDRY.muted, padding: 0 }}
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
```

Add `<style>{`.slideIn { animation: slideIn 200ms ease; } @keyframes slideIn { from { transform: translateX(20px); opacity: 0; } to { transform: none; opacity: 1; }}`}</style>` in global CSS or as inline style tag.

**Step 2: Add Toaster to AppShell.tsx**

```tsx
import Toaster from "@/components/Toaster";
// Inside AppShell return, before closing </div>:
<Toaster />
```

**Step 3: Use toast() in graph/page.tsx**

```tsx
import { toast } from "@/components/Toaster";

// In drillDown():
toast("드릴다운 로드 완료", { sub: `${hub.grant_count}개 과제`, type: "success" });

// In loadOverview():
toast("Knowledge Graph 로드 완료", { sub: `${nodes}개 노드`, type: "success" });
```

**Step 4: Commit**

```bash
git add frontend/src/components/Toaster.tsx frontend/src/components/AppShell.tsx frontend/src/app/graph/page.tsx
git commit -m "feat: add Foundry-style toast notifications to graph interactions"
```

---

## Task 8: Final Polish — Grants List as Data Table

**Files:**
- Modify: `frontend/src/app/grants/page.tsx`

Foundry data tables are dense, column-based, with monospace values. Replace the current card grid with a proper data table style.

- Compact rows (height 44px)
- Columns: [D-Day] [제목] [기관] [카테고리] [최대금액] [상태]
- Column header row with subtle bg
- Hover highlight on rows
- Status column: `● LIVE` / `● 마감` with color dots
- All using FOUNDRY tokens

**Step 2: Commit**

```bash
git add frontend/src/app/grants/page.tsx
git commit -m "feat: grants list as Foundry-style dense data table"
```

---

## Verification

After all tasks:

```bash
cd /Users/peterchae/forlabs_government/frontend
npx tsc --noEmit
# Expected: 0 errors

# Start dev server
npm run dev
# Visit http://localhost:3000 and verify:
# ✓ Left sidebar visible (60px), expands to 220px on hover
# ✓ Workspace bar (40px) at top with breadcrumb + Cmd+K
# ✓ Cmd+K opens command palette
# ✓ Homepage shows Object Overview stats
# ✓ Graph page has split Inspector panel
# ✓ Matching page is 3-column
# ✓ Toast appears on graph load
# ✓ Data Sources panel opens in sidebar
```
