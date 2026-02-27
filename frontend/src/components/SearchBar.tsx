"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

interface SearchBarProps {
  /** Initial query value */
  defaultValue?: string;
  /** Size variant */
  size?: "default" | "large";
  /** Additional CSS classes */
  className?: string;
}

export default function SearchBar({
  defaultValue = "",
  size = "default",
  className = "",
}: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultValue);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(`/grants?q=${encodeURIComponent(trimmed)}`);
  }

  const isLarge = size === "large";

  return (
    <form onSubmit={handleSubmit} className={`w-full ${className}`}>
      <div
        className={`flex items-center gap-3 rounded-2xl border border-gray-200 bg-white shadow-sm transition-all focus-within:border-blue-400 focus-within:shadow-md ${
          isLarge ? "px-6 py-4" : "px-4 py-3"
        }`}
      >
        <Search
          className={`shrink-0 text-gray-400 ${isLarge ? "h-6 w-6" : "h-5 w-5"}`}
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="설립 3년차 서울 IT 기업 마케팅 지원사업 찾아줘"
          className={`w-full bg-transparent outline-none placeholder:text-gray-400 ${
            isLarge ? "text-lg" : "text-base"
          }`}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="shrink-0 rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <span className="sr-only">Clear</span>
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
        <button
          type="submit"
          className={`shrink-0 rounded-xl bg-blue-600 font-medium text-white transition-colors hover:bg-blue-700 ${
            isLarge ? "px-6 py-2.5 text-base" : "px-4 py-2 text-sm"
          }`}
        >
          검색
        </button>
      </div>
    </form>
  );
}
