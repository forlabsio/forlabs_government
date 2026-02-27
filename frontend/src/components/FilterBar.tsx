"use client";

import { useRouter, useSearchParams } from "next/navigation";

const CATEGORIES = [
  { label: "전체", value: "" },
  { label: "자금", value: "자금" },
  { label: "R&D", value: "R&D" },
  { label: "인력", value: "인력" },
  { label: "창업", value: "창업" },
  { label: "교육", value: "교육" },
  { label: "수출", value: "수출" },
  { label: "기타", value: "기타" },
];

const REGIONS = [
  { label: "전체 지역", value: "" },
  { label: "서울", value: "서울" },
  { label: "경기", value: "경기" },
  { label: "인천", value: "인천" },
  { label: "부산", value: "부산" },
  { label: "대구", value: "대구" },
  { label: "광주", value: "광주" },
  { label: "대전", value: "대전" },
  { label: "울산", value: "울산" },
  { label: "세종", value: "세종" },
  { label: "강원", value: "강원" },
  { label: "충북", value: "충북" },
  { label: "충남", value: "충남" },
  { label: "전북", value: "전북" },
  { label: "전남", value: "전남" },
  { label: "경북", value: "경북" },
  { label: "경남", value: "경남" },
  { label: "제주", value: "제주" },
];

interface FilterBarProps {
  className?: string;
}

export default function FilterBar({ className = "" }: FilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentCategory = searchParams.get("category") || "";
  const currentRegion = searchParams.get("region") || "";

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    // Reset to page 1 when filters change
    params.delete("page");
    router.push(`/grants?${params.toString()}`);
  }

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Category Chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value || "all"}
            onClick={() => updateFilter("category", cat.value)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-all ${
              currentCategory === cat.value
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Region Chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {REGIONS.map((reg) => (
          <button
            key={reg.value || "all-region"}
            onClick={() => updateFilter("region", reg.value)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              currentRegion === reg.value
                ? "bg-gray-900 text-white"
                : "bg-gray-50 text-gray-500 hover:bg-gray-100"
            }`}
          >
            {reg.label}
          </button>
        ))}
      </div>
    </div>
  );
}
