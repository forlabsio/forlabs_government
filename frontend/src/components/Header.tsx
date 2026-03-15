"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import {
  Menu, X, ChevronDown, User, LogOut, Shield,
  Network, TrendingUp, GitBranch, Zap, Bookmark,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

const INTELLIGENCE_LINKS = [
  { href: "/graph", label: "Knowledge Graph", icon: GitBranch, desc: "과제·기관·기술 관계 탐색" },
  { href: "/trends", label: "트렌드 분석", icon: TrendingUp, desc: "기술·산업별 지원 동향" },
  { href: "/network", label: "기업 네트워크", icon: Network, desc: "유사 기업 클러스터 분석" },
  { href: "/matching", label: "자동 매칭", icon: Zap, desc: "내 기업에 맞는 과제 탐색" },
] as const;

export default function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [intelOpen, setIntelOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const intelRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const { user, loading, signOut } = useAuth();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (intelRef.current && !intelRef.current.contains(e.target as Node)) setIntelOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const displayName = user?.name || user?.email?.split("@")[0] || "사용자";
  const avatarLetter = user?.email?.charAt(0).toUpperCase() || "U";
  const isIntelligencePath = INTELLIGENCE_LINKS.some((l) => pathname.startsWith(l.href));

  return (
    <header
      style={{ background: "rgba(10,14,26,0.9)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      className="sticky top-0 z-50 backdrop-blur-md"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/30">
            <GitBranch className="h-4 w-4 text-cyan-400" />
          </div>
          <span className="text-base font-bold text-white">
            Danbi<span className="text-cyan-400">.Day</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-1 md:flex">
          <Link
            href="/grants"
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              pathname.startsWith("/grants") && !isIntelligencePath
                ? "bg-blue-500/10 text-blue-400"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            과제 찾기
          </Link>

          {/* Intelligence Dropdown */}
          <div className="relative" ref={intelRef}>
            <button
              onClick={() => setIntelOpen(!intelOpen)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isIntelligencePath
                  ? "bg-cyan-500/10 text-cyan-400"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              Intelligence
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${intelOpen ? "rotate-180" : ""}`}
              />
            </button>

            {intelOpen && (
              <div
                className="absolute left-0 top-full mt-2 w-72 rounded-xl p-2 shadow-2xl"
                style={{
                  background: "#0f1628",
                  border: "1px solid rgba(0,212,255,0.2)",
                  boxShadow: "0 0 30px rgba(0,212,255,0.1)",
                }}
              >
                {INTELLIGENCE_LINKS.map(({ href, label, icon: Icon, desc }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setIntelOpen(false)}
                    className="flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-white/5"
                  >
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-cyan-500/10">
                      <Icon className="h-3.5 w-3.5 text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{label}</p>
                      <p className="text-xs text-gray-500">{desc}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {user && (
            <Link
              href="/intelligence"
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                pathname === "/intelligence"
                  ? "bg-blue-500/10 text-blue-400"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              내 대시보드
            </Link>
          )}
        </nav>

        {/* Auth Section */}
        <div className="hidden items-center gap-2 md:flex">
          {loading ? (
            <div className="h-8 w-20 animate-pulse rounded-lg bg-white/10" />
          ) : user ? (
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-white/5"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-500/20 text-xs font-bold text-cyan-400">
                  {avatarLetter}
                </div>
                <span className="max-w-[100px] truncate">{displayName}</span>
                <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
              </button>
              {profileOpen && (
                <div
                  className="absolute right-0 top-full mt-1 w-44 rounded-xl py-1 shadow-xl"
                  style={{ background: "#0f1628", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <Link
                    href="/mypage"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5"
                  >
                    <User className="h-4 w-4 text-gray-500" /> 내 프로필
                  </Link>
                  <Link
                    href="/bookmarks"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5"
                  >
                    <Bookmark className="h-4 w-4 text-gray-500" /> 북마크
                  </Link>
                  {user?.is_admin && (
                    <Link
                      href="/admin"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5"
                    >
                      <Shield className="h-4 w-4 text-gray-500" /> 관리자
                    </Link>
                  )}
                  <hr style={{ borderColor: "rgba(255,255,255,0.06)" }} className="my-1" />
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      signOut();
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5"
                  >
                    <LogOut className="h-4 w-4 text-gray-500" /> 로그아웃
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5"
              >
                로그인
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-cyan-400"
              >
                회원가입
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-lg p-2 text-gray-400 hover:bg-white/5 md:hidden"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "#0a0e1a" }}
          className="px-4 py-4 md:hidden"
        >
          <nav className="flex flex-col gap-1">
            <Link
              href="/grants"
              onClick={() => setMobileOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm text-gray-300 hover:bg-white/5"
            >
              과제 찾기
            </Link>
            <p className="px-3 pt-2 text-xs font-semibold uppercase tracking-wider text-gray-600">
              Intelligence
            </p>
            {INTELLIGENCE_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2.5 pl-6 text-sm text-gray-400 hover:bg-white/5"
              >
                {label}
              </Link>
            ))}
            {user && (
              <Link
                href="/intelligence"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm text-gray-300 hover:bg-white/5"
              >
                내 대시보드
              </Link>
            )}
            <hr style={{ borderColor: "rgba(255,255,255,0.06)" }} className="my-2" />
            {user ? (
              <>
                <Link
                  href="/mypage"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm text-gray-300"
                >
                  {displayName}
                </Link>
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    signOut();
                  }}
                  className="rounded-lg px-3 py-2.5 text-left text-sm text-gray-400"
                >
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm text-gray-300"
                >
                  로그인
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg bg-cyan-500 px-3 py-2.5 text-sm font-medium text-gray-900"
                >
                  회원가입
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
