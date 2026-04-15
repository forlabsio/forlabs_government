import Link from "next/link";
import { formatDDay, getDDay } from "@/lib/format";
import type { Grant } from "@/lib/api";
import { FOUNDRY, SOURCE_LABELS } from "@/lib/theme";
import type { CSSProperties } from "react";

const SOURCE_STYLES: Record<string, CSSProperties> = {
  bizinfo:   { background: "rgba(45,114,210,0.15)",  color: "#2D72D2" },
  kocca:     { background: "rgba(191,115,38,0.15)",  color: "#BF7326" },
  kstartup:  { background: "rgba(139,92,246,0.15)",  color: "#a78bfa" },
  subsidy24: { background: "rgba(194,48,48,0.15)",   color: "#ef4444" },
  smes:      { background: "rgba(139,92,246,0.12)",  color: "#c4b5fd" },
  default:   { background: "rgba(255,255,255,0.06)", color: FOUNDRY.muted },
};

function getDDayStyle(deadline: string | undefined): CSSProperties {
  const dday = getDDay(deadline);
  if (dday === null) return { background: "rgba(255,255,255,0.06)", color: FOUNDRY.muted };
  if (dday > 0) return { background: "rgba(255,255,255,0.06)", color: FOUNDRY.muted };
  const remaining = Math.abs(dday);
  if (remaining <= 7)
    return { background: "rgba(194,48,48,0.15)", color: FOUNDRY.danger, border: "1px solid rgba(194,48,48,0.3)" };
  if (remaining <= 14)
    return { background: "rgba(191,115,38,0.15)", color: FOUNDRY.warning, border: "1px solid rgba(191,115,38,0.3)" };
  return { background: "rgba(35,162,109,0.15)", color: FOUNDRY.success, border: "1px solid rgba(35,162,109,0.3)" };
}

interface GrantCardProps {
  grant: Grant;
}

export default function GrantCard({ grant }: GrantCardProps) {
  const ddayText = formatDDay(grant.end_date);
  const ddayStyle = getDDayStyle(grant.end_date);
  const primarySource = grant.sources?.[0] || "default";
  const srcStyle = SOURCE_STYLES[primarySource] ?? SOURCE_STYLES.default;
  const sourceLabel = SOURCE_LABELS[primarySource] || primarySource;

  return (
    <Link
      href={`/grants/${grant.id}`}
      style={{ display: "block", textDecoration: "none" }}
      title={grant.title}
    >
      <article
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          borderRadius: 10,
          border: `1px solid ${FOUNDRY.border}`,
          background: FOUNDRY.card,
          padding: "18px 20px",
          transition: "border-color 0.15s, transform 0.15s",
          cursor: "pointer",
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.borderColor = FOUNDRY.primary;
          (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.borderColor = FOUNDRY.border;
          (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
        }}
      >
        {/* Top: D-Day Badge + Source */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <span style={{ ...ddayStyle, display: "inline-flex", alignItems: "center", borderRadius: 7, padding: "4px 10px", fontSize: 12, fontWeight: 700 }}>
            {ddayText}
          </span>
          <div style={{ display: "flex", gap: 4 }}>
            <span style={{ ...srcStyle, borderRadius: 5, padding: "3px 8px", fontSize: 11, fontWeight: 500 }}>
              {sourceLabel}
            </span>
            {grant.sources?.length > 1 && (
              <span style={{ background: "rgba(255,255,255,0.06)", color: FOUNDRY.muted, borderRadius: 5, padding: "3px 8px", fontSize: 11, fontWeight: 500 }}>
                +{grant.sources.length - 1}
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <h3
          style={{
            margin: "0 0 7px",
            fontSize: 14,
            fontWeight: 600,
            lineHeight: 1.45,
            color: FOUNDRY.text,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {grant.title}
        </h3>

        {/* Organization */}
        <p style={{ margin: "0 0 12px", fontSize: 12, color: FOUNDRY.muted, lineHeight: 1.4 }}>
          {grant.organization}
        </p>

        <div style={{ flex: 1 }} />

        {/* Bottom: Category + Status */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center" }}>
          {grant.category && (
            <span style={{ background: "rgba(255,255,255,0.06)", color: FOUNDRY.muted, borderRadius: 100, padding: "3px 9px", fontSize: 11, fontWeight: 500 }}>
              {grant.category}
            </span>
          )}
          {grant.status && (
            <span style={{
              background: ["접수중", "공고중", "진행중"].includes(grant.status ?? "") ? "rgba(35,162,109,0.15)" : "rgba(255,255,255,0.06)",
              color: ["접수중", "공고중", "진행중"].includes(grant.status ?? "") ? FOUNDRY.success : FOUNDRY.muted,
              borderRadius: 100,
              padding: "3px 9px",
              fontSize: 11,
              fontWeight: 500,
            }}>
              {["접수중", "공고중", "진행중"].includes(grant.status ?? "") ? "LIVE" : grant.status}
            </span>
          )}
        </div>
      </article>
    </Link>
  );
}
