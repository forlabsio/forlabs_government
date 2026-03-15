"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  fetchGraphOverview,
  fetchGraphExpand,
  type GraphData,
  type GraphNode,
} from "@/lib/api";
import { GRAPH_COLORS, FOUNDRY } from "@/lib/theme";
import { toast } from "@/components/Toaster";
import {
  GitBranch, Loader2, X, ZoomIn, ZoomOut, Maximize2,
  Search, ChevronLeft, TrendingUp, ArrowUpRight,
} from "lucide-react";
import cytoscape from "cytoscape";

const KnowledgeGraph = dynamic(() => import("@/components/KnowledgeGraph"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
    </div>
  ),
});

type ViewMode = "overview" | "drilldown";

interface HubInfo {
  id: string;
  label: string;
  type: string;
  grant_count: number;
}

function formatAmount(amount: number): string {
  if (amount >= 100000000) return `${(amount / 100000000).toFixed(1)}억원`;
  if (amount >= 10000) return `${Math.round(amount / 10000)}만원`;
  return amount.toLocaleString() + "원";
}

function computeSize(data: GraphNode["data"]): number {
  const w = data.weight ?? 0.3;
  if (data.is_hub) return 80;
  if (data.type === "TechArea") return 50 + w * 55;
  if (data.type === "Agency") return 20 + w * 48;
  return 10 + w * 30;
}

function truncateLabel(label: string, type: string): string {
  if (type === "Grant") return label.length > 20 ? label.slice(0, 20) + "…" : label;
  if (type === "Agency") return label.length > 14 ? label.slice(0, 14) + "…" : label;
  return label;
}

function enrichNodes(d: GraphData): GraphData {
  return {
    ...d,
    nodes: d.nodes.map((n) => ({
      data: {
        ...n.data,
        size: computeSize(n.data),
        label: truncateLabel(n.data.label, n.data.type),
      },
    })),
  };
}

const TYPE_LABELS: Record<string, string> = {
  Grant: "과제", Agency: "기관", TechArea: "기술분야",
};

export default function GraphPage() {
  const [mode, setMode] = useState<ViewMode>("overview");
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [overviewCache, setOverviewCache] = useState<GraphData | null>(null);
  const [hub, setHub] = useState<HubInfo | null>(null);
  const [selected, setSelected] = useState<GraphNode["data"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const [search, setSearch] = useState("");
  const cyRef = useRef<cytoscape.Core | null>(null);

  const overviewStats = overviewCache
    ? {
        agencies: overviewCache.nodes.filter((n) => n.data.type === "Agency").length,
        tech: overviewCache.nodes.filter((n) => n.data.type === "TechArea").length,
      }
    : null;

  // Load overview on mount
  useEffect(() => {
    setLoading(true);
    fetchGraphOverview()
      .then((d) => {
        const enriched = enrichNodes(d);
        setGraphData(enriched);
        setOverviewCache(enriched);
        toast("Knowledge Graph 로드 완료", {
          sub: `${enriched.nodes.length}개 노드 · ${enriched.edges.length}개 엣지`,
          type: "success",
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Drilldown into Agency or TechArea
  const drillDown = useCallback(async (nodeId: string) => {
    setTransitioning(true);
    setLoading(true);
    try {
      const result = await fetchGraphExpand(nodeId);
      const enriched = enrichNodes(result);
      setGraphData(enriched);
      setHub(result.hub);
      setMode("drilldown");
      setSelected(null);
      setSearch("");
      toast(`${result.hub.label} 드릴다운`, {
        sub: `${result.hub.grant_count}개 과제`,
        type: "success",
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setTimeout(() => setTransitioning(false), 120);
    }
  }, []);

  function backToOverview() {
    setTransitioning(true);
    setTimeout(() => {
      setGraphData(overviewCache);
      setMode("overview");
      setHub(null);
      setSelected(null);
      setSearch("");
      setTransitioning(false);
    }, 280);
  }

  function handleSearch(q: string) {
    setSearch(q);
    const cy = cyRef.current;
    if (!cy) return;
    if (!q.trim()) {
      cy.elements().removeClass("faded highlighted");
      return;
    }
    const match = cy.nodes().filter((n) =>
      n.data("label")?.toLowerCase().includes(q.toLowerCase())
    );
    cy.elements().addClass("faded");
    if (match.length > 0) {
      match.removeClass("faded").addClass("highlighted");
      match.connectedEdges().removeClass("faded").addClass("highlighted");
      cy.animate({ fit: { eles: match, padding: 80 }, duration: 350 });
    }
  }

  function handleNodeClick(nodeData: GraphNode["data"] | null) {
    setSelected(nodeData);
  }

  const hubColor =
    hub?.type === "TechArea" ? GRAPH_COLORS.TechArea : GRAPH_COLORS.Agency;

  return (
    <div className="relative flex flex-col" style={{ background: "#070b14", height: "calc(100vh - 40px)" }}>

      {/* ── Top bar ── */}
      <div
        className="relative z-10 flex flex-shrink-0 items-center justify-between px-5 py-3"
        style={{
          borderBottom: `1px solid ${FOUNDRY.glow}`,
          background: "rgba(7,11,20,0.97)",
        }}
      >
        <div className="flex min-w-0 items-center gap-3">
          {mode === "drilldown" ? (
            <>
              <button
                onClick={backToOverview}
                className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all hover:bg-white/10"
                style={{ color: FOUNDRY.primary, border: `1px solid ${FOUNDRY.glow}` }}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                전체
              </button>
              <div
                className="h-3 w-px shrink-0"
                style={{ background: "rgba(255,255,255,0.12)" }}
              />
              <div className="flex min-w-0 items-center gap-2">
                <div
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: hubColor }}
                />
                <span className="truncate text-sm font-semibold text-white">{hub?.label}</span>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{ background: FOUNDRY.glow, color: FOUNDRY.primary }}
                >
                  {hub?.grant_count}개 과제
                </span>
              </div>
            </>
          ) : (
            <>
              <GitBranch className="h-4 w-4 shrink-0 text-cyan-400" />
              <span className="text-sm font-semibold text-white">정부 R&amp;D 인텔리전스 그래프</span>
              {overviewStats && (
                <span className="hidden text-xs text-gray-500 md:inline">
                  접수중 1,000개 · 기관 {overviewStats.agencies}개 · 기술분야{" "}
                  {overviewStats.tech}개
                </span>
              )}
            </>
          )}
        </div>

        {/* Search */}
        <div
          className="flex shrink-0 items-center gap-2 rounded-xl px-3 py-1.5"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.09)",
            width: 220,
          }}
        >
          <Search className="h-3.5 w-3.5 shrink-0 text-gray-500" />
          <input
            type="text"
            placeholder={mode === "overview" ? "기관·기술분야 검색…" : "과제명 검색…"}
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full bg-transparent text-xs text-white outline-none placeholder-gray-600"
          />
          {search && (
            <button onClick={() => handleSearch("")}>
              <X className="h-3 w-3 text-gray-500" />
            </button>
          )}
        </div>
      </div>

      {/* ── Graph canvas + Inspector split row ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Graph canvas */}
        <div className="relative flex-1 overflow-hidden">

          {/* Loading overlay */}
          {loading && (
            <div
              className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4"
              style={{ background: "rgba(7,11,20,0.88)", backdropFilter: "blur(4px)" }}
            >
              <div className="relative">
                <div
                  className="h-20 w-20 rounded-full"
                  style={{ border: `1px solid ${FOUNDRY.glow}` }}
                />
                <Loader2 className="absolute inset-0 m-auto h-9 w-9 animate-spin text-cyan-400" />
              </div>
              <p className="text-sm text-gray-400">
                {mode === "overview" ? "Knowledge Graph 구성 중…" : "과제 네트워크 분석 중…"}
              </p>
            </div>
          )}

          {/* Mode-transition fade */}
          <div
            className="pointer-events-none absolute inset-0 z-20 transition-opacity duration-300"
            style={{ background: "#070b14", opacity: transitioning ? 0.85 : 0 }}
          />

          {/* Graph */}
          {graphData && graphData.nodes.length > 0 ? (
            <KnowledgeGraph
              data={graphData}
              mode={mode}
              onNodeClick={handleNodeClick}
              cyRef={cyRef}
            />
          ) : !loading ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-gray-500">데이터를 불러올 수 없습니다</p>
            </div>
          ) : null}

          {/* Overview hint */}
          {mode === "overview" && !selected && !loading && graphData && (
            <div
              className="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full px-4 py-2 text-xs text-gray-400"
              style={{
                background: "rgba(12,18,40,0.88)",
                border: "1px solid rgba(255,255,255,0.07)",
                backdropFilter: "blur(10px)",
              }}
            >
              기관(◇) 또는 기술분야(⬡) 클릭 → 과제 드릴다운
            </div>
          )}

          {/* ── Bottom-left: Legend ── */}
          <div className="absolute bottom-4 left-4 z-20">
            <div
              className="rounded-xl p-3"
              style={{
                background: "rgba(12,18,35,0.93)",
                border: "1px solid rgba(255,255,255,0.08)",
                backdropFilter: "blur(12px)",
                minWidth: 178,
              }}
            >
              {mode === "overview" ? (
                <>
                  <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600">
                    노드 범례
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5">
                      <svg width="14" height="14" viewBox="0 0 14 14">
                        <polygon points="7,1 13,7 7,13 1,7" fill={GRAPH_COLORS.Agency} />
                      </svg>
                      <span className="text-xs text-gray-300">
                        기관{" "}
                        <span className="text-[10px] text-gray-600">크기 = 과제 수</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <svg width="14" height="14" viewBox="0 0 14 14">
                        <polygon points="4,1 10,1 14,7 10,13 4,13 0,7" fill={GRAPH_COLORS.TechArea} />
                      </svg>
                      <span className="text-xs text-gray-300">
                        기술분야{" "}
                        <span className="text-[10px] text-gray-600">크기 = 총 지원금</span>
                      </span>
                    </div>
                  </div>
                  <div
                    className="mt-2 pt-2 text-[10px] text-gray-700"
                    style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    노드 클릭 → 과제 드릴다운
                  </div>
                </>
              ) : (
                <>
                  <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600">
                    드릴다운 모드
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="h-4 w-4 shrink-0 rounded-full"
                        style={{ background: hubColor, border: `2px solid ${FOUNDRY.primary}` }}
                      />
                      <span className="text-xs text-gray-300">허브 노드</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: GRAPH_COLORS.Grant }}
                      />
                      <span className="text-xs text-gray-300">
                        과제{" "}
                        <span className="text-[10px] text-gray-600">크기 = 지원금액</span>
                      </span>
                    </div>
                  </div>
                  <div
                    className="mt-2 pt-2 text-[10px] text-gray-700"
                    style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    과제 클릭 → 상세 패널
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Bottom-right: Zoom controls ── */}
          <div
            className="absolute bottom-4 right-4 z-20 flex flex-col gap-1 rounded-xl p-1.5"
            style={{
              background: "rgba(12,18,35,0.92)",
              border: "1px solid rgba(255,255,255,0.08)",
              backdropFilter: "blur(8px)",
            }}
          >
            <button
              onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 1.25)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 0.8)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "2px 4px" }} />
            <button
              onClick={() => cyRef.current?.fit(undefined, 60)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
              title="전체 보기"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>

        </div>

        {/* ── Inspector panel (slides in/out) ── */}
        <InspectorPanel
          node={selected}
          onClose={() => setSelected(null)}
          onDrillDown={drillDown}
          mode={mode}
        />

      </div>
    </div>
  );
}

// ── InspectorPanel ────────────────────────────────────────────────────────────

function InspectorPanel({
  node,
  onClose,
  onDrillDown,
  mode,
}: {
  node: GraphNode["data"] | null;
  onClose: () => void;
  onDrillDown: (id: string) => void;
  mode: ViewMode;
}) {
  return (
    <div
      style={{
        width: node ? 280 : 0,
        overflow: "hidden",
        transition: "width 200ms ease",
        background: "rgba(10,15,30,0.97)",
        borderLeft: `1px solid ${FOUNDRY.glow}`,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {node && (
        <div style={{ width: 280, height: "100%", overflowY: "auto", padding: 16 }}>

          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
              paddingBottom: 12,
              borderBottom: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <p
              style={{
                fontSize: 9,
                color: FOUNDRY.muted,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                margin: 0,
              }}
            >
              OBJECT INSPECTOR
            </p>
            <button
              onClick={onClose}
              aria-label="인스펙터 닫기"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: FOUNDRY.muted,
                padding: 0,
                lineHeight: 1,
                fontSize: 14,
              }}
            >
              ✕
            </button>
          </div>

          {/* Type badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "3px 8px",
              background: FOUNDRY.glow,
              border: `1px solid rgba(45,114,210,0.3)`,
              borderRadius: 4,
              marginBottom: 12,
            }}
          >
            <span
              style={{
                fontSize: 10,
                color: FOUNDRY.primary,
                fontWeight: 600,
                letterSpacing: "0.05em",
              }}
            >
              {TYPE_LABELS[node.type] ?? node.type}
            </span>
          </div>

          {/* Node name */}
          <p
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: FOUNDRY.text,
              lineHeight: 1.4,
              margin: "0 0 16px 0",
            }}
          >
            {node.label}
          </p>

          {/* Stats */}
          <div style={{ marginBottom: 16 }}>
            {node.grant_count != null && (
              <StatRow label="과제 수" value={`${node.grant_count}개`} />
            )}
            {node.total_amount != null && node.total_amount > 0 && (
              <StatRow
                label="총 지원액"
                value={
                  node.total_amount >= 1e8
                    ? `${(node.total_amount / 1e8).toFixed(1)}억원`
                    : `${Math.round(node.total_amount / 1e4)}만원`
                }
              />
            )}
            {node.amount_max != null && node.amount_max > 0 && (
              <StatRow
                label="최대 지원액"
                value={
                  node.amount_max >= 1e8
                    ? `${(node.amount_max / 1e8).toFixed(1)}억원`
                    : `${Math.round(node.amount_max / 1e4)}만원`
                }
              />
            )}
            {node.end_date && (
              <StatRow label="마감일" value={node.end_date} highlight />
            )}
            {node.organization && (
              <StatRow label="주관기관" value={node.organization} />
            )}
            {node.category && (
              <StatRow label="카테고리" value={node.category} />
            )}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {mode === "overview" &&
              (node.type === "Agency" || node.type === "TechArea") && (
                <button
                  onClick={() => onDrillDown(node.id)}
                  style={{
                    padding: "8px 12px",
                    background: `linear-gradient(135deg, ${FOUNDRY.glow}, ${FOUNDRY.glow})`,
                    border: `1px solid ${FOUNDRY.primary}`,
                    borderRadius: 6,
                    color: FOUNDRY.primary,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    textAlign: "center",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <TrendingUp style={{ width: 14, height: 14 }} />
                  드릴다운 →
                </button>
              )}
            {node.type === "Grant" && (
              <a
                href={'/grants/' + node.id}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: "8px 12px",
                  background: FOUNDRY.glow,
                  border: `1px solid ${FOUNDRY.primary}`,
                  borderRadius: 6,
                  color: FOUNDRY.primary,
                  fontSize: 12,
                  fontWeight: 600,
                  textDecoration: "none",
                  textAlign: "center",
                }}
              >
                과제 상세 보기
                <ArrowUpRight style={{ width: 14, height: 14 }} />
              </a>
            )}
          </div>

          <p
            style={{
              marginTop: 20,
              fontSize: 10,
              color: "rgba(255,255,255,0.18)",
            }}
          >
            배경 클릭 시 패널 닫힘
          </p>
        </div>
      )}
    </div>
  );
}

// ── StatRow helper ─────────────────────────────────────────────────────────────

function StatRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        marginBottom: 8,
      }}
    >
      <span style={{ fontSize: 11, color: FOUNDRY.muted }}>{label}</span>
      <span
        style={{
          fontSize: 11,
          color: highlight ? FOUNDRY.warning : FOUNDRY.text,
          fontFamily: "monospace",
          maxWidth: 150,
          textAlign: "right",
          wordBreak: "break-word",
        }}
      >
        {value}
      </span>
    </div>
  );
}
