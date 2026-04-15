"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  LayoutDashboard,
  Search,
  Image,
  FileText,
  Users,
  ChevronLeft,
} from "lucide-react";
import type { ReactNode } from "react";
import { FOUNDRY } from "@/lib/theme";
import { useAuth } from "@/components/AuthProvider";

const NAV_ITEMS = [
  { label: "대시보드",   href: "/admin",                 icon: LayoutDashboard },
  { label: "검색 인사이트", href: "/admin/search-insights", icon: Search },
  { label: "회원 관리",  href: "/admin/users",           icon: Users },
  { label: "배너 관리",  href: "/admin/banners",         icon: Image },
  { label: "수집 로그",  href: "/admin/fetch-logs",      icon: FileText },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && (!user || !user.is_admin)) {
      router.replace("/");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: FOUNDRY.bg }}>
        <span style={{ color: FOUNDRY.muted, fontSize: 13 }}>로딩 중...</span>
      </div>
    );
  }

  if (!user?.is_admin) {
    return null;
  }

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  return (
    <div
      style={{
        display: "flex",
        height: "calc(100vh - 40px)",
        overflow: "hidden",
        background: FOUNDRY.bg,
      }}
    >
      {/* Admin Sidebar */}
      <aside
        style={{
          width: 200,
          flexShrink: 0,
          background: FOUNDRY.sidebar,
          borderRight: `1px solid ${FOUNDRY.border}`,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Sidebar Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            borderBottom: `1px solid ${FOUNDRY.border}`,
            padding: "14px 16px",
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              background: FOUNDRY.primary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 700,
              color: "#fff",
              flexShrink: 0,
            }}
          >
            G
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: FOUNDRY.text }}>관리자 패널</span>
        </div>

        {/* Nav Items */}
        <nav style={{ flex: 1, padding: "10px 8px" }}>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                      borderRadius: 7,
                      padding: "8px 10px",
                      fontSize: 13,
                      fontWeight: active ? 600 : 400,
                      color: active ? "#fff" : FOUNDRY.muted,
                      background: active ? FOUNDRY.primary : "transparent",
                      textDecoration: "none",
                      transition: "background 0.12s, color 0.12s",
                    }}
                    onMouseEnter={e => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
                        (e.currentTarget as HTMLElement).style.color = FOUNDRY.text;
                      }
                    }}
                    onMouseLeave={e => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.background = "transparent";
                        (e.currentTarget as HTMLElement).style.color = FOUNDRY.muted;
                      }
                    }}
                  >
                    <Icon size={14} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Back to Site */}
        <div style={{ borderTop: `1px solid ${FOUNDRY.border}`, padding: "10px 8px" }}>
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              borderRadius: 7,
              padding: "8px 10px",
              fontSize: 12,
              fontWeight: 400,
              color: FOUNDRY.muted,
              textDecoration: "none",
              transition: "color 0.12s",
            }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = FOUNDRY.text)}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = FOUNDRY.muted)}
          >
            <ChevronLeft size={13} />
            사이트로 돌아가기
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, overflowY: "auto", background: FOUNDRY.bg }}>
        {children}
      </main>
    </div>
  );
}
