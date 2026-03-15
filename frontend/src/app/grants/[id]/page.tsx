"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { fetchGrantDetail, fetchGrants, type Grant } from "@/lib/api";
import { formatDDay, getDDay } from "@/lib/format";
import GrantCard from "@/components/GrantCard";
import { FOUNDRY, SOURCE_LABELS } from "@/lib/theme";
import {
  ArrowLeft,
  Bookmark,
  Calendar,
  Building2,
  MapPin,
  ExternalLink,
  Tag,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import type { CSSProperties } from "react";

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

export default function GrantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const [grant, setGrant] = useState<Grant | null>(null);
  const [relatedGrants, setRelatedGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const detail = await fetchGrantDetail(id);
        if (cancelled) return;
        setGrant(detail);

        if (detail.category) {
          const related = await fetchGrants({ category: detail.category, size: "3" }).catch(() => null);
          if (cancelled) return;
          if (related?.items) {
            setRelatedGrants(related.items.filter((g: Grant) => g.id !== id).slice(0, 3));
          }
        }
      } catch {
        if (!cancelled) setError("지원사업 정보를 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  const pageStyle: CSSProperties = {
    height: "calc(100vh - 40px)",
    overflow: "auto",
    background: FOUNDRY.bg,
  };

  const innerStyle: CSSProperties = {
    maxWidth: 860,
    margin: "0 auto",
    padding: "28px 24px 64px",
  };

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={innerStyle}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[32, 48, 240].map((h, i) => (
              <div
                key={i}
                style={{
                  height: h,
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.06)",
                  animation: "pulse 1.5s ease-in-out infinite",
                  width: i === 1 ? "75%" : "100%",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !grant) {
    return (
      <div style={pageStyle}>
        <div style={{ ...innerStyle, textAlign: "center", paddingTop: 80 }}>
          <p style={{ fontSize: 15, color: FOUNDRY.muted, marginBottom: 16 }}>
            {error || "지원사업을 찾을 수 없습니다."}
          </p>
          <Link
            href="/grants"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, color: FOUNDRY.primary, fontSize: 14, textDecoration: "none" }}
          >
            <ArrowLeft size={15} />
            목록으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const ddayText = formatDDay(grant.end_date);
  const ddayStyle = getDDayStyle(grant.end_date);

  return (
    <div style={pageStyle}>
      <div style={innerStyle}>
        {/* Back link */}
        <Link
          href="/grants"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontSize: 13,
            fontWeight: 500,
            color: FOUNDRY.muted,
            textDecoration: "none",
            marginBottom: 20,
            transition: "color 0.15s",
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = FOUNDRY.text)}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = FOUNDRY.muted)}
        >
          <ArrowLeft size={14} />
          목록으로
        </Link>

        {/* Main Card */}
        <article
          style={{
            borderRadius: 12,
            border: `1px solid ${FOUNDRY.border}`,
            background: FOUNDRY.panel,
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              borderBottom: `1px solid ${FOUNDRY.border}`,
              padding: "28px 28px 24px",
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <span
                style={{
                  ...ddayStyle,
                  display: "inline-flex",
                  alignItems: "center",
                  borderRadius: 7,
                  padding: "5px 12px",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {ddayText}
              </span>
              {grant.category && (
                <span
                  style={{
                    background: "rgba(45,114,210,0.15)",
                    color: FOUNDRY.primary,
                    borderRadius: 100,
                    padding: "4px 12px",
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  {grant.category}
                </span>
              )}
              {grant.sources?.map((src) => (
                <span
                  key={src}
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    color: FOUNDRY.muted,
                    borderRadius: 100,
                    padding: "4px 12px",
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  {SOURCE_LABELS[src] || src}
                </span>
              ))}
            </div>

            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, lineHeight: 1.4, color: FOUNDRY.text }}>
              {grant.title}
            </h1>
          </div>

          {/* Info Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 1,
              background: FOUNDRY.border,
              borderBottom: `1px solid ${FOUNDRY.border}`,
            }}
          >
            {[
              { icon: <Building2 size={16} color={FOUNDRY.muted} />, label: "주관기관", value: grant.organization || "-" },
              { icon: <MapPin size={16} color={FOUNDRY.muted} />, label: "지역", value: grant.target_region?.length ? grant.target_region.join(", ") : "전국" },
              { icon: <Calendar size={16} color={FOUNDRY.muted} />, label: "마감일", value: grant.end_date || "상시접수" },
            ].map(({ icon, label, value }) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  background: FOUNDRY.card,
                  padding: "14px 20px",
                }}
              >
                <div style={{ flexShrink: 0 }}>{icon}</div>
                <div>
                  <p style={{ margin: 0, fontSize: 11, color: FOUNDRY.muted, marginBottom: 3 }}>{label}</p>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: FOUNDRY.text }}>{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          {grant.summary && (
            <div style={{ padding: "24px 28px" }}>
              <h2
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  margin: "0 0 16px",
                  fontSize: 15,
                  fontWeight: 600,
                  color: FOUNDRY.text,
                }}
              >
                <Tag size={15} color={FOUNDRY.muted} />
                사업 개요
              </h2>
              <div
                style={{
                  whiteSpace: "pre-wrap",
                  fontSize: 14,
                  lineHeight: 1.75,
                  color: FOUNDRY.muted,
                }}
              >
                {grant.summary}
              </div>
            </div>
          )}

          {/* Actions */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              borderTop: `1px solid ${FOUNDRY.border}`,
              padding: "18px 28px",
            }}
          >
            {grant.detail_url && (
              <a
                href={grant.detail_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  background: FOUNDRY.primary,
                  color: "#fff",
                  borderRadius: 8,
                  padding: "10px 20px",
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: "none",
                  transition: "opacity 0.15s",
                }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = "0.85")}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = "1")}
              >
                원문 보기
                <ExternalLink size={14} />
              </a>
            )}
            {user && (
              <button
                type="button"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  background: "transparent",
                  border: `1px solid ${FOUNDRY.border}`,
                  color: FOUNDRY.muted,
                  borderRadius: 8,
                  padding: "10px 20px",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "border-color 0.15s, color 0.15s",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = FOUNDRY.primary;
                  (e.currentTarget as HTMLElement).style.color = FOUNDRY.primary;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = FOUNDRY.border;
                  (e.currentTarget as HTMLElement).style.color = FOUNDRY.muted;
                }}
              >
                <Bookmark size={14} />
                관심 사업
              </button>
            )}
          </div>
        </article>

        {/* Related Grants */}
        {relatedGrants.length > 0 && (
          <section style={{ marginTop: 48 }}>
            <h2
              style={{
                margin: "0 0 20px",
                fontSize: 16,
                fontWeight: 600,
                color: FOUNDRY.text,
              }}
            >
              비슷한 지원사업
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap: 14,
              }}
            >
              {relatedGrants.map((g) => (
                <GrantCard key={g.id} grant={g} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
