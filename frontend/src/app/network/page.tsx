"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { fetchNetworkData, type GraphData, type GraphNode } from "@/lib/api";
import { FOUNDRY, GRAPH_COLORS } from "@/lib/theme";
import { Network, Loader2, X } from "lucide-react";

const KnowledgeGraph = dynamic(() => import("@/components/KnowledgeGraph"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        display: "flex",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Loader2
        className="h-8 w-8 animate-spin"
        style={{ color: FOUNDRY.success }}
      />
    </div>
  ),
});

function PropertyRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
      <span style={{ color: FOUNDRY.muted }}>{label}</span>
      <span style={{ color: color ?? FOUNDRY.text }}>{value}</span>
    </div>
  );
}

export default function NetworkPage() {
  const [data, setData] = useState<
    (GraphData & { stats: { company_count: number; edge_count: number } }) | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<GraphNode["data"] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchNetworkData()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setError("네트워크 데이터를 불러올 수 없습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      style={{
        height: "calc(100vh - 40px)",
        display: "flex",
        flexDirection: "column",
        background: FOUNDRY.bg,
      }}
    >
      {/* Workspace row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          height: 44,
          borderBottom: `1px solid ${FOUNDRY.border}`,
          background: "#161C22",
          flexShrink: 0,
          gap: 10,
        }}
      >
        <Network size={16} style={{ color: FOUNDRY.success }} />
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: FOUNDRY.text,
          }}
        >
          기업 네트워크 분석
        </span>
        {data?.stats && (
          <span style={{ fontSize: 11, color: FOUNDRY.muted }}>
            {data.stats.company_count}개 기업 · {data.stats.edge_count}개 연결
          </span>
        )}
        <div style={{ flex: 1 }} />
        <span
          style={{
            background: "rgba(35,162,109,0.15)",
            color: FOUNDRY.success,
            fontSize: 10,
            padding: "2px 8px",
            borderRadius: 4,
          }}
        >
          Company Network
        </span>
      </div>

      {/* Main area */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Left: Graph area */}
        <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          {loading ? (
            <div
              style={{
                display: "flex",
                height: "100%",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
              }}
            >
              <Loader2
                className="h-6 w-6 animate-spin"
                style={{ color: FOUNDRY.success }}
              />
              <span style={{ fontSize: 13, color: FOUNDRY.muted }}>
                네트워크 분석 중...
              </span>
            </div>
          ) : error ? (
            <div
              style={{
                display: "flex",
                height: "100%",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
              }}
            >
              <Network size={48} style={{ color: FOUNDRY.muted }} />
              <p style={{ fontSize: 14, color: FOUNDRY.muted }}>{error}</p>
            </div>
          ) : data && data.nodes.length > 0 ? (
            <KnowledgeGraph data={data} onNodeClick={setSelected} />
          ) : (
            <div
              style={{
                display: "flex",
                height: "100%",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
              }}
            >
              <Network size={48} style={{ color: FOUNDRY.muted }} />
              <p style={{ fontSize: 14, color: FOUNDRY.muted }}>
                북마크 데이터가 충분하지 않습니다.
              </p>
              <p style={{ fontSize: 12, color: FOUNDRY.muted, opacity: 0.7 }}>
                과제를 북마크하면 기업 네트워크가 형성됩니다.
              </p>
            </div>
          )}
        </div>

        {/* Right: Inspector panel */}
        {selected !== null && (
          <div
            style={{
              width: 280,
              borderLeft: `1px solid ${FOUNDRY.border}`,
              background: FOUNDRY.panel,
              display: "flex",
              flexDirection: "column",
              overflow: "auto",
              transition: "width 200ms ease",
              flexShrink: 0,
            }}
          >
            {/* Header row */}
            <div
              style={{
                padding: "12px 16px",
                borderBottom: `1px solid ${FOUNDRY.border}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: 9,
                  color: FOUNDRY.muted,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                OBJECT INSPECTOR
              </span>
              <button
                onClick={() => setSelected(null)}
                aria-label="Inspector 닫기"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: FOUNDRY.muted,
                  padding: 0,
                  lineHeight: 1,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Type badge + label */}
            <div style={{ padding: "16px 16px 0" }}>
              <span
                style={{
                  background: `${GRAPH_COLORS[selected.type as keyof typeof GRAPH_COLORS] ?? FOUNDRY.primary}20`,
                  color: GRAPH_COLORS[selected.type as keyof typeof GRAPH_COLORS] ?? FOUNDRY.primary,
                  fontSize: 10,
                  padding: "2px 6px",
                  borderRadius: 4,
                  fontWeight: 600,
                }}
              >
                {selected.type}
              </span>
              <p
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: FOUNDRY.text,
                  marginTop: 8,
                  marginBottom: 0,
                }}
              >
                {selected.label}
              </p>
            </div>

            {/* Properties */}
            <div
              style={{
                padding: "12px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {selected.industry && (
                <PropertyRow label="업종" value={selected.industry} />
              )}
              {(selected as GraphNode["data"] & { region?: string }).region && (
                <PropertyRow
                  label="지역"
                  value={(selected as GraphNode["data"] & { region?: string }).region!}
                />
              )}
              {(selected as GraphNode["data"] & { employee_count?: number }).employee_count && (
                <PropertyRow
                  label="직원 수"
                  value={`${(selected as GraphNode["data"] & { employee_count?: number }).employee_count}명`}
                />
              )}
              {selected.amount_max && (
                <PropertyRow
                  label="최대 지원금"
                  value={`${Math.round(selected.amount_max / 10000)}만원`}
                  color={FOUNDRY.primary}
                />
              )}
              {selected.category && (
                <PropertyRow label="카테고리" value={selected.category} />
              )}
              {selected.grant_count != null && (
                <PropertyRow label="과제 수" value={`${selected.grant_count}개`} />
              )}
              {selected.end_date && (
                <PropertyRow label="마감일" value={selected.end_date} color={FOUNDRY.warning} />
              )}
              {selected.organization && (
                <PropertyRow label="주관기관" value={selected.organization} />
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
