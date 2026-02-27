"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { fetchSearchInsights, fetchZeroResults } from "@/lib/api";
import { TrendingUp, AlertCircle } from "lucide-react";

interface SearchKeyword {
  keyword: string;
  count: number;
  last_searched: string;
}

interface ZeroResultKeyword {
  keyword: string;
  count: number;
  last_searched: string;
}

export default function SearchInsightsPage() {
  const { session } = useAuth();
  const [popular, setPopular] = useState<SearchKeyword[]>([]);
  const [zeroResults, setZeroResults] = useState<ZeroResultKeyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const token = session?.access_token;
        if (token) {
          const [popularData, zeroData] = await Promise.all([
            fetchSearchInsights(token, days),
            fetchZeroResults(token, days),
          ]);
          setPopular(popularData?.keywords || []);
          setZeroResults(zeroData?.keywords || []);
        }
      } catch {
        // Use empty arrays on error
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [session, days]);

  return (
    <div className="px-6 py-8 lg:px-8">
      {/* Page Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">검색 인사이트</h1>
          <p className="mt-1 text-sm text-gray-500">
            사용자들의 검색 패턴을 분석합니다
          </p>
        </div>
        <div className="flex items-center gap-2">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                days === d
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {d}일
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Popular Keywords */}
        <div className="rounded-2xl bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">
                인기 검색어 TOP 20
              </h2>
              <p className="text-xs text-gray-500">최근 {days}일 기준</p>
            </div>
          </div>

          {loading ? (
            <div className="p-6">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="mb-3 h-10 animate-pulse rounded-lg bg-gray-50"
                />
              ))}
            </div>
          ) : popular.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <th className="px-6 py-3 w-12">#</th>
                    <th className="px-6 py-3">검색어</th>
                    <th className="px-6 py-3 text-right">검색 횟수</th>
                    <th className="px-6 py-3 text-right">최근 검색</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {popular.map((item, idx) => (
                    <tr
                      key={item.keyword}
                      className={idx % 2 === 1 ? "bg-gray-50/50" : ""}
                    >
                      <td className="px-6 py-3">
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                            idx < 3
                              ? "bg-blue-600 text-white"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {idx + 1}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm font-medium text-gray-900">
                        {item.keyword}
                      </td>
                      <td className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                        {item.count.toLocaleString()}
                      </td>
                      <td className="px-6 py-3 text-right text-sm text-gray-400">
                        {item.last_searched}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center">
              <TrendingUp className="mx-auto mb-3 h-8 w-8 text-gray-300" />
              <p className="text-sm text-gray-400">검색 데이터가 없습니다</p>
            </div>
          )}
        </div>

        {/* Zero Results */}
        <div className="rounded-2xl bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">
                결과없는 검색어 (Zero-Result)
              </h2>
              <p className="text-xs text-gray-500">
                데이터 보강이 필요한 검색어
              </p>
            </div>
          </div>

          {loading ? (
            <div className="p-6">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="mb-3 h-10 animate-pulse rounded-lg bg-gray-50"
                />
              ))}
            </div>
          ) : zeroResults.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <th className="px-6 py-3 w-12">#</th>
                    <th className="px-6 py-3">검색어</th>
                    <th className="px-6 py-3 text-right">시도 횟수</th>
                    <th className="px-6 py-3 text-right">최근 검색</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {zeroResults.map((item, idx) => (
                    <tr
                      key={item.keyword}
                      className={idx % 2 === 1 ? "bg-gray-50/50" : ""}
                    >
                      <td className="px-6 py-3">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-50 text-xs font-bold text-red-500">
                          {idx + 1}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm font-medium text-gray-900">
                        {item.keyword}
                      </td>
                      <td className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                        {item.count.toLocaleString()}
                      </td>
                      <td className="px-6 py-3 text-right text-sm text-gray-400">
                        {item.last_searched}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center">
              <AlertCircle className="mx-auto mb-3 h-8 w-8 text-gray-300" />
              <p className="text-sm text-gray-400">
                Zero-Result 검색어가 없습니다
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
