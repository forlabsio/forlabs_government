"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { fetchGraphData, type GraphData, type GraphNode } from "@/lib/api";
import { GRAPH_COLORS } from "@/lib/theme";
import { GitBranch, Loader2, X } from "lucide-react";

const KnowledgeGraph = dynamic(() => import("@/components/KnowledgeGraph"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
    </div>
  ),
});

export default function GraphPage() {
  const [data, setData] = useState<GraphData | null>(null);
  const [selected, setSelected] = useState<GraphNode["data"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [nodeCount, setNodeCount] = useState(100);

  useEffect(() => {
    setLoading(true);
    fetchGraphData(nodeCount)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [nodeCount]);

  const stats = data
    ? {
        grants: data.nodes.filter((n) => n.data.type === "Grant").length,
        agencies: data.nodes.filter((n) => n.data.type === "Agency").length,
        tech: data.nodes.filter((n) => n.data.type === "TechArea").length,
        edges: data.edges.length,
      }
    : null;

  return (
    <div className="flex h-screen flex-col" style={{ background: "#0a0e1a" }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="flex items-center gap-3">
          <GitBranch className="h-5 w-5 text-cyan-400" />
          <div>
            <h1 className="text-lg font-semibold text-white">정부 R&D Knowledge Graph</h1>
            {stats && (
              <p className="text-xs text-gray-500">
                과제 {stats.grants} · 기관 {stats.agencies} · 기술분야 {stats.tech} · 관계 {stats.edges}
              </p>
            )}
          </div>
        </div>
        <select
          value={nodeCount}
          onChange={(e) => setNodeCount(Number(e.target.value))}
          className="rounded-lg px-3 py-1.5 text-sm text-white"
          style={{ background: "#141c30", border: "1px solid rgba(255,255,255,0.12)" }}
        >
          <option value={50}>50 노드</option>
          <option value={100}>100 노드</option>
          <option value={200}>200 노드</option>
          <option value={300}>300 노드</option>
        </select>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Legend */}
        <div
          className="w-48 shrink-0 p-4"
          style={{ borderRight: "1px solid rgba(255,255,255,0.06)" }}
        >
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            노드 유형
          </p>
          {Object.entries(GRAPH_COLORS).map(([type, color]) => (
            <div key={type} className="mb-2 flex items-center gap-2">
              <div className="h-3 w-3 rounded-full" style={{ background: color }} />
              <span className="text-xs text-gray-400">
                {type === "Grant"
                  ? "과제"
                  : type === "Agency"
                  ? "기관"
                  : type === "TechArea"
                  ? "기술분야"
                  : "기업"}
              </span>
            </div>
          ))}
          <hr style={{ borderColor: "rgba(255,255,255,0.06)" }} className="my-4" />
          <p className="text-xs text-gray-600">클릭: 노드 상세 보기</p>
          <p className="text-xs text-gray-600">드래그: 위치 이동</p>
          <p className="text-xs text-gray-600">스크롤: 줌 인/아웃</p>
        </div>

        {/* Graph canvas */}
        <div className="relative flex-1">
          {loading ? (
            <div className="flex h-full items-center justify-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
              <span className="text-sm text-gray-500">Knowledge Graph 로딩 중...</span>
            </div>
          ) : data ? (
            <KnowledgeGraph data={data} onNodeClick={setSelected} />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-gray-500">데이터를 불러올 수 없습니다</p>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div
            className="w-72 shrink-0 p-4 overflow-y-auto"
            style={{
              borderLeft: "1px solid rgba(255,255,255,0.08)",
              background: "#0f1628",
            }}
          >
            <div className="mb-4 flex items-center justify-between">
              <span
                className="rounded-md px-2 py-0.5 text-xs font-medium"
                style={{
                  background: `${GRAPH_COLORS[selected.type as keyof typeof GRAPH_COLORS]}20`,
                  color: GRAPH_COLORS[selected.type as keyof typeof GRAPH_COLORS],
                }}
              >
                {selected.type}
              </span>
              <button
                onClick={() => setSelected(null)}
                className="text-gray-500 hover:text-gray-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <h3 className="mb-3 text-sm font-semibold text-white leading-snug">
              {selected.label}
            </h3>
            <div className="space-y-2">
              {selected.category && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">카테고리</span>
                  <span className="text-gray-300">{selected.category}</span>
                </div>
              )}
              {selected.organization && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">기관</span>
                  <span className="text-gray-300">{selected.organization}</span>
                </div>
              )}
              {selected.amount_max && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">최대 지원금</span>
                  <span className="text-cyan-400">
                    {(selected.amount_max / 10000).toFixed(0)}만원
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
