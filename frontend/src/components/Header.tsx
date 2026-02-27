"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { Menu, X, ChevronDown, User, Bookmark, LogOut, Shield } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

export default function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user, loading, signOut } = useAuth();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayName =
    user?.name ||
    user?.email?.split("@")[0] ||
    "사용자";

  const avatarLetter =
    user?.email?.charAt(0).toUpperCase() || "U";

  function navLinkClass(href: string) {
    const isActive =
      href === "/grants"
        ? pathname === "/grants" || pathname.startsWith("/grants?")
        : pathname === href;
    return `text-sm font-medium transition-colors ${
      isActive ? "text-blue-600" : "text-gray-600 hover:text-gray-900"
    }`;
  }

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-bold text-blue-600">
            ForLabsAI
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-8 md:flex">
          <Link href="/grants" className={navLinkClass("/grants")}>
            지원사업 찾기
          </Link>
          <Link href="/grants?category=자금" className={navLinkClass("/grants?category=자금")}>
            자금지원
          </Link>
          <Link href="/grants?category=R%26D" className={navLinkClass("/grants?category=R%26D")}>
            R&D
          </Link>
          <Link href="/grants?category=보조금" className={navLinkClass("/grants?category=보조금")}>
            보조금
          </Link>
          {user && (
            <Link
              href="/bookmarks"
              className={`flex items-center gap-1.5 ${navLinkClass("/bookmarks")}`}
            >
              <Bookmark className={`h-4 w-4 ${pathname === "/bookmarks" ? "fill-blue-600" : ""}`} />
              나의 사업관리
            </Link>
          )}
        </nav>

        {/* Auth Section (Desktop) */}
        <div className="hidden items-center gap-2 md:flex">
          {loading ? (
            <div className="h-8 w-20 animate-pulse rounded-lg bg-gray-100" />
          ) : user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-600">
                  {avatarLetter}
                </div>
                <span className="max-w-[120px] truncate">{displayName}</span>
                <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-gray-100 bg-white py-1 shadow-lg">
                  <Link
                    href="/mypage"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    <User className="h-4 w-4 text-gray-400" />
                    내 프로필
                  </Link>
                  {user?.is_admin && (
                    <Link
                      href="/admin"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      <Shield className="h-4 w-4 text-gray-400" />
                      관리자
                    </Link>
                  )}
                  <hr className="my-1 border-gray-100" />
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      signOut();
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    <LogOut className="h-4 w-4 text-gray-400" />
                    로그아웃
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                로그인
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                회원가입
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <div className="flex items-center gap-3 md:hidden">
          {user && (
            <Link
              href="/bookmarks"
              className="relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-gray-50"
            >
              <Bookmark className={`h-5 w-5 ${pathname === "/bookmarks" ? "fill-blue-600 text-blue-600" : "text-gray-600"}`} />
            </Link>
          )}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <X className="h-6 w-6 text-gray-600" />
            ) : (
              <Menu className="h-6 w-6 text-gray-600" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="border-t border-gray-100 bg-white px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-1">
            <Link
              href="/grants"
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
              onClick={() => setMobileOpen(false)}
            >
              지원사업 찾기
            </Link>
            <Link
              href="/grants?category=자금"
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
              onClick={() => setMobileOpen(false)}
            >
              자금지원
            </Link>
            <Link
              href="/grants?category=R%26D"
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
              onClick={() => setMobileOpen(false)}
            >
              R&D
            </Link>
            {user && (
              <Link
                href="/bookmarks"
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50"
                onClick={() => setMobileOpen(false)}
              >
                <Bookmark className="h-4 w-4 fill-blue-600" />
                나의 사업관리
              </Link>
            )}
            <hr className="my-2 border-gray-100" />
            {user ? (
              <>
                <Link
                  href="/mypage"
                  className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600"
                  onClick={() => setMobileOpen(false)}
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-600">
                    {avatarLetter}
                  </div>
                  {displayName}
                </Link>
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    signOut();
                  }}
                  className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-gray-600"
                >
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-gray-600"
                  onClick={() => setMobileOpen(false)}
                >
                  로그인
                </Link>
                <Link
                  href="/signup"
                  className="rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-medium text-white"
                  onClick={() => setMobileOpen(false)}
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
