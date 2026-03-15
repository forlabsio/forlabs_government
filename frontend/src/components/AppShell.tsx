"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  GitBranch,
  LayoutDashboard,
  Search,
  TrendingUp,
  Network,
  Zap,
  Database,
  Settings,
  Bell,
  ChevronRight,
  User,
  LogOut,
  Shield,
  Bookmark,
  Command,
} from "lucide-react";
import { FOUNDRY } from "@/lib/theme";
import { useAuth } from "@/components/AuthProvider";
import CommandPalette from "@/components/CommandPalette";
import Toaster from "@/components/Toaster";

/* ─── Types ──────────────────────────────────────────────────────────── */

interface NavItem {
  href: string;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>;
  section?: string;
  isAction?: boolean;
}

/* ─── Nav definition ─────────────────────────────────────────────────── */

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: LayoutDashboard, section: "MAIN" },
  { href: "/grants", label: "과제 탐색", icon: Search, section: "MAIN" },
  { href: "/graph", label: "Knowledge Graph", icon: GitBranch, section: "INTELLIGENCE" },
  { href: "/trends", label: "트렌드 분석", icon: TrendingUp, section: "INTELLIGENCE" },
  { href: "/network", label: "기업 네트워크", icon: Network, section: "INTELLIGENCE" },
  { href: "/matching", label: "자동 매칭", icon: Zap, section: "INTELLIGENCE" },
  { href: "#data-sources", label: "Data Sources", icon: Database, section: "DATA", isAction: true },
];

/* ─── Breadcrumb label map ───────────────────────────────────────────── */

const BREADCRUMB_MAP: Record<string, string> = {
  "/": "대시보드",
  "/grants": "과제 탐색",
  "/graph": "Knowledge Graph",
  "/trends": "트렌드 분석",
  "/network": "기업 네트워크",
  "/matching": "자동 매칭",
  "/admin": "관리자",
  "/mypage": "내 프로필",
  "/bookmarks": "북마크",
  "/login": "로그인",
  "/signup": "회원가입",
};

function getBreadcrumb(pathname: string): string {
  if (BREADCRUMB_MAP[pathname]) return BREADCRUMB_MAP[pathname];
  const base = "/" + pathname.split("/")[1];
  return BREADCRUMB_MAP[base] || pathname.split("/")[1] || "대시보드";
}

/* ─── Data Sources Panel ─────────────────────────────────────────────── */

const DATA_SOURCES = [
  { name: "기업마당", status: "LIVE" },
  { name: "K-Startup", status: "LIVE" },
  { name: "KOCCA", status: "LIVE" },
  { name: "보조금24", status: "LIVE" },
  { name: "중소벤처24", status: "LIVE" },
  { name: "Neo4j Graph", status: "CONNECTED" },
];

function DataSourcesPanel({ onClose }: { onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={panelRef}
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
      <p
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase" as const,
          color: FOUNDRY.muted,
          marginBottom: 12,
        }}
      >
        Data Connections
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {DATA_SOURCES.map((ds) => (
          <div
            key={ds.name}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: FOUNDRY.success,
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 12, color: FOUNDRY.text }}>{ds.name}</span>
            </div>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: FOUNDRY.success,
                letterSpacing: "0.05em",
              }}
            >
              {ds.status}
            </span>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 16,
          paddingTop: 12,
          borderTop: `1px solid ${FOUNDRY.border}`,
        }}
      >
        <p style={{ fontSize: 11, color: FOUNDRY.muted }}>Last sync: 2m ago</p>
        <p style={{ fontSize: 11, color: FOUNDRY.muted, marginTop: 2 }}>
          Total: 10,938 grants
        </p>
      </div>
    </div>
  );
}

/* ─── Sidebar ────────────────────────────────────────────────────────── */

const SECTIONS = ["MAIN", "INTELLIGENCE", "DATA"] as const;

function Sidebar({
  expanded,
  onMouseEnter,
  onMouseLeave,
}: {
  expanded: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [dataSourcesOpen, setDataSourcesOpen] = useState(false);

  function isActive(item: NavItem): boolean {
    if (item.isAction) return false;
    if (item.href === "/") return pathname === "/";
    return pathname.startsWith(item.href);
  }

  return (
    <div
      style={{
        position: "relative",
        width: expanded ? 220 : 60,
        minWidth: expanded ? 220 : 60,
        background: FOUNDRY.sidebar,
        borderRight: `1px solid ${FOUNDRY.border}`,
        display: "flex",
        flexDirection: "column",
        transition: "width 200ms ease, min-width 200ms ease",
        overflow: "visible",
        flexShrink: 0,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={() => {
        onMouseLeave();
        setDataSourcesOpen(false);
      }}
    >
      <nav style={{ flex: 1, paddingTop: 8, paddingBottom: 8 }}>
        {SECTIONS.map((section) => {
          const items = NAV_ITEMS.filter((item) => item.section === section);
          return (
            <div key={section} style={{ marginBottom: 4 }}>
              {/* Section label */}
              {expanded && (
                <p
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase" as const,
                    color: FOUNDRY.muted,
                    paddingLeft: 16,
                    paddingRight: 16,
                    paddingTop: section === "MAIN" ? 8 : 16,
                    paddingBottom: 6,
                    opacity: 0.7,
                  }}
                >
                  {section}
                </p>
              )}

              {items.map((item) => {
                const active = isActive(item);
                const Icon = item.icon;

                if (item.isAction) {
                  return (
                    <div key={item.href} style={{ position: "relative" }}>
                      <button
                        onClick={() => {
                          if (expanded) setDataSourcesOpen((v) => !v);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: expanded ? 10 : 0,
                          width: "100%",
                          padding: expanded ? "8px 16px" : "8px 0",
                          justifyContent: expanded ? "flex-start" : "center",
                          borderLeft: "2px solid transparent",
                          background: dataSourcesOpen && expanded
                            ? FOUNDRY.glow
                            : "transparent",
                          color: dataSourcesOpen && expanded ? FOUNDRY.primary : FOUNDRY.muted,
                          cursor: "pointer",
                          transition: "background 150ms ease, color 150ms ease",
                          border: "none",
                          outline: "none",
                        }}
                      >
                        <Icon
                          size={16}
                          style={{ flexShrink: 0 }}
                        />
                        {expanded && (
                          <span style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden" }}>
                            {item.label}
                          </span>
                        )}
                      </button>

                      {dataSourcesOpen && expanded && (
                        <DataSourcesPanel onClose={() => setDataSourcesOpen(false)} />
                      )}
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: expanded ? 10 : 0,
                      padding: expanded ? "8px 16px" : "8px 0",
                      justifyContent: expanded ? "flex-start" : "center",
                      borderLeft: active
                        ? `2px solid ${FOUNDRY.primary}`
                        : "2px solid transparent",
                      background: active ? FOUNDRY.glow : "transparent",
                      color: active ? FOUNDRY.primary : FOUNDRY.muted,
                      textDecoration: "none",
                      transition: "background 150ms ease, color 150ms ease",
                    }}
                  >
                    <Icon size={16} style={{ flexShrink: 0 }} />
                    {expanded && (
                      <span
                        style={{
                          fontSize: 13,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                        }}
                      >
                        {item.label}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Bottom: Settings (admin only) */}
      {user?.is_admin && (
        <div style={{ padding: "8px 0", borderTop: `1px solid ${FOUNDRY.border}` }}>
          <Link
            href="/admin"
            style={{
              display: "flex",
              alignItems: "center",
              gap: expanded ? 10 : 0,
              padding: expanded ? "8px 16px" : "8px 0",
              justifyContent: expanded ? "flex-start" : "center",
              borderLeft: pathname.startsWith("/admin")
                ? `2px solid ${FOUNDRY.primary}`
                : "2px solid transparent",
              background: pathname.startsWith("/admin") ? FOUNDRY.glow : "transparent",
              color: pathname.startsWith("/admin") ? FOUNDRY.primary : FOUNDRY.muted,
              textDecoration: "none",
              transition: "background 150ms ease, color 150ms ease",
            }}
          >
            <Settings size={16} style={{ flexShrink: 0 }} />
            {expanded && (
              <span style={{ fontSize: 13, whiteSpace: "nowrap" }}>Settings</span>
            )}
          </Link>
        </div>
      )}
    </div>
  );
}

/* ─── User Dropdown ──────────────────────────────────────────────────── */

function UserDropdown() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [open]);

  if (loading) {
    return (
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.1)",
          animation: "pulse 1.5s ease-in-out infinite",
        }}
      />
    );
  }

  if (!user) {
    return (
      <Link
        href="/login"
        style={{
          fontSize: 12,
          color: FOUNDRY.text,
          background: FOUNDRY.primary,
          padding: "4px 12px",
          borderRadius: 4,
          textDecoration: "none",
          fontWeight: 500,
        }}
      >
        로그인
      </Link>
    );
  }

  const avatarLetter = user.email?.charAt(0).toUpperCase() || "U";

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`User menu for ${user.email}`}
        aria-expanded={open}
        aria-haspopup="menu"
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: FOUNDRY.primary,
          color: "#fff",
          fontSize: 12,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          border: "none",
          outline: "none",
        }}
      >
        {avatarLetter}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            width: 176,
            background: FOUNDRY.panel,
            border: `1px solid ${FOUNDRY.border}`,
            borderRadius: 6,
            paddingTop: 4,
            paddingBottom: 4,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            zIndex: 100,
          }}
        >
          <DropdownLink href="/mypage" onClick={() => setOpen(false)} icon={User}>
            내 프로필
          </DropdownLink>
          <DropdownLink href="/bookmarks" onClick={() => setOpen(false)} icon={Bookmark}>
            북마크
          </DropdownLink>
          {user.is_admin && (
            <DropdownLink href="/admin" onClick={() => setOpen(false)} icon={Shield}>
              관리자
            </DropdownLink>
          )}
          <hr
            style={{
              borderColor: FOUNDRY.border,
              marginTop: 4,
              marginBottom: 4,
              border: "none",
              borderTop: `1px solid ${FOUNDRY.border}`,
            }}
          />
          <button
            onClick={async () => {
              setOpen(false);
              await signOut();
              router.push("/login");
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "8px 16px",
              fontSize: 13,
              color: FOUNDRY.muted,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              textAlign: "left" as const,
            }}
          >
            <LogOut size={14} />
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}

function DropdownLink({
  href,
  onClick,
  icon: Icon,
  children,
}: {
  href: string;
  onClick: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 16px",
        fontSize: 13,
        color: FOUNDRY.muted,
        textDecoration: "none",
      }}
    >
      <Icon size={14} />
      {children}
    </Link>
  );
}

/* ─── WorkspaceBar ───────────────────────────────────────────────────── */

function WorkspaceBar() {
  const pathname = usePathname();
  const breadcrumb = getBreadcrumb(pathname);

  function triggerCommandPalette() {
    window.dispatchEvent(new CustomEvent("openCommandPalette"));
  }

  return (
    <div
      style={{
        height: 40,
        background: FOUNDRY.sidebar,
        borderBottom: `1px solid ${FOUNDRY.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingLeft: 16,
        paddingRight: 16,
        flexShrink: 0,
        zIndex: 10,
      }}
    >
      {/* Left: Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, width: 44, minWidth: 44 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: FOUNDRY.primary,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <GitBranch size={14} color="#fff" />
        </div>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: FOUNDRY.text,
            whiteSpace: "nowrap",
          }}
        >
          GovGraph
        </span>
      </div>

      {/* Center: Breadcrumb */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          fontFamily: "monospace",
          fontSize: 12,
          color: FOUNDRY.muted,
        }}
      >
        <span style={{ color: FOUNDRY.muted }}>GovGraph</span>
        <ChevronRight size={12} />
        <span style={{ color: FOUNDRY.text }}>{breadcrumb}</span>
      </div>

      {/* Right: Search / Bell / Avatar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* Cmd+K trigger */}
        <button
          onClick={triggerCommandPalette}
          title="Command Palette (Cmd+K)"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "3px 8px",
            borderRadius: 4,
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${FOUNDRY.border}`,
            color: FOUNDRY.muted,
            fontSize: 11,
            cursor: "pointer",
            outline: "none",
          }}
        >
          <Command size={12} />
          <span>K</span>
        </button>

        {/* Bell */}
        <button
          style={{
            background: "transparent",
            border: "none",
            color: FOUNDRY.muted,
            cursor: "pointer",
            padding: 4,
            display: "flex",
            alignItems: "center",
          }}
          title="알림"
          aria-label="알림"
        >
          <Bell size={15} />
        </button>

        {/* User */}
        <UserDropdown />
      </div>
    </div>
  );
}

/* ─── CommandPaletteTrigger ──────────────────────────────────────────── */

function CommandPaletteTrigger() {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("openCommandPalette"));
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return null;
}

/* ─── AppShell ───────────────────────────────────────────────────────── */

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  const handleSidebarEnter = useCallback(() => setSidebarExpanded(true), []);
  const handleSidebarLeave = useCallback(() => setSidebarExpanded(false), []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: FOUNDRY.bg,
      }}
    >
      <WorkspaceBar />

      <div
        style={{
          display: "flex",
          flex: 1,
          overflow: "hidden",
        }}
      >
        <Sidebar
          expanded={sidebarExpanded}
          onMouseEnter={handleSidebarEnter}
          onMouseLeave={handleSidebarLeave}
        />

        <main
          style={{
            flex: 1,
            overflow: "auto",
            background: FOUNDRY.bg,
          }}
        >
          {children}
        </main>
      </div>

      <CommandPaletteTrigger />
      <CommandPalette />
      <Toaster />
    </div>
  );
}
