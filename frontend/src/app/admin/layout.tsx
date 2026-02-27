"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Search,
  Image,
  FileText,
  Users,
  ChevronLeft,
} from "lucide-react";
import type { ReactNode } from "react";

const NAV_ITEMS = [
  {
    label: "대시보드",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    label: "검색 인사이트",
    href: "/admin/search-insights",
    icon: Search,
  },
  {
    label: "회원 관리",
    href: "/admin/users",
    icon: Users,
  },
  {
    label: "배너 관리",
    href: "/admin/banners",
    icon: Image,
  },
  {
    label: "수집 로그",
    href: "/admin/fetch-logs",
    icon: FileText,
  },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  return (
    <div className="flex min-h-[calc(100vh-64px)]">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 bg-[#1E293B] lg:block">
        <div className="flex h-full flex-col">
          {/* Sidebar Header */}
          <div className="flex items-center gap-2 border-b border-white/10 px-5 py-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
              G
            </div>
            <span className="text-sm font-bold text-white">관리자 패널</span>
          </div>

          {/* Nav Items */}
          <nav className="flex-1 px-3 py-4">
            <ul className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                        active
                          ? "bg-blue-600 text-white"
                          : "text-gray-400 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Back to Site */}
          <div className="border-t border-white/10 px-3 py-4">
            <Link
              href="/"
              className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
              사이트로 돌아가기
            </Link>
          </div>
        </div>
      </aside>

      {/* Mobile Nav Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white lg:hidden">
        <nav className="flex items-center justify-around py-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 px-3 py-1 text-xs font-medium ${
                  active ? "text-blue-600" : "text-gray-400"
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-gray-50 pb-20 lg:pb-0">
        {children}
      </main>
    </div>
  );
}
