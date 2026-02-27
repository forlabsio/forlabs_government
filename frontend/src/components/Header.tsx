"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
            G
          </div>
          <span className="text-lg font-bold text-gray-900">
            정부지원금
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-8 md:flex">
          <Link
            href="/grants"
            className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
          >
            지원사업 찾기
          </Link>
          <Link
            href="/grants?category=자금"
            className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
          >
            자금지원
          </Link>
          <Link
            href="/grants?category=R%26D"
            className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
          >
            R&D
          </Link>
        </nav>

        {/* Auth Button (Desktop) */}
        <div className="hidden items-center gap-3 md:flex">
          <button className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50">
            로그인
          </button>
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700">
            시작하기
          </button>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden"
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

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="border-t border-gray-100 bg-white px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-3">
            <Link
              href="/grants"
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
              onClick={() => setMobileOpen(false)}
            >
              지원사업 찾기
            </Link>
            <Link
              href="/grants?category=자금"
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
              onClick={() => setMobileOpen(false)}
            >
              자금지원
            </Link>
            <Link
              href="/grants?category=R%26D"
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
              onClick={() => setMobileOpen(false)}
            >
              R&D
            </Link>
            <hr className="my-2 border-gray-100" />
            <button className="rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-600">
              로그인
            </button>
            <button className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white">
              시작하기
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}
