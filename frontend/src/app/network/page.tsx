"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { fetchNetworkData, type GraphData } from "@/lib/api";
import { Network, Loader2 } from "lucide-react";

const KnowledgeGraph = dynamic(() => import("@/components/KnowledgeGraph"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
    </div>
  ),
});

export default function NetworkPage() {
  const [data, setData] = useState<(GraphData & { stats: { company_count: number; edge_count: number } }) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNetworkData()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex h-screen flex-col" style={{ background: "#0a0e1a" }}>
      <div
        className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="flex items-center gap-3">
          <Network className="h-5 w-5 text-emerald-400" />
          <div>
            <h1 className="text-lg font-semibold text-white">기업 네트워크 분석</h1>
            <p className="text-xs text-gray-500">
              {data?.stats
                ? `${data.stats.company_count}개 기업 · ${data.stats.edge_count}개 연결 — 같은 과제에 관심 있는 기업 클러스터`
                : "같은 과제에 관심 있는 기업 클러스터 분석"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1">
        {loading ? (
          <div className="flex h-full items-center justify-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
            <span className="text-sm text-gray-500">네트워크 분석 중...</span>
          </div>
        ) : data && data.nodes.length > 0 ? (
          <KnowledgeGraph data={data} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <Network className="h-12 w-12 text-gray-700" />
            <p className="text-gray-500">북마크 데이터가 충분하지 않습니다.</p>
            <p className="text-sm text-gray-600">
              과제를 북마크하면 기업 네트워크가 형성됩니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
