"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchBriefing, type BriefingResponse } from "@/lib/api";
import { FOUNDRY } from "@/lib/theme";
import { Loader2, Share2, ExternalLink, ChevronLeft } from "lucide-react";

const F = FOUNDRY;

function StatBox({ value, label }: { value: string; label: string }) {
  return (
    <div
      style={{
        background: F.card,
        border: `1px solid ${F.border}`,
        borderRadius: 8,
        padding: "16px 20px",
        textAlign: "center" as const,
        flex: 1,
      }}
    >
      <p
        style={{
          fontSize: 26,
          fontWeight: 700,
          color: F.text,
          fontFamily: "monospace",
          marginBottom: 4,
          margin: "0 0 4px",
        }}
      >
        {value}
      </p>
      <p style={{ fontSize: 11, color: F.muted, margin: 0 }}>{label}</p>
    </div>
  );
}

function formatAmount(krw: number): string {
  if (krw >= 100_000_000) return `${(krw / 100_000_000).toFixed(1)}억`;
  return `${Math.round(krw / 10_000)}만`;
}

export default function BriefingPage() {
  const [data, setData] = useState<BriefingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("govgrants_token");
    if (!token) {
      setError("로그인이 필요합니다.");
      setLoading(false);
      return;
    }
    fetchBriefing(token)
      .then(setData)
      .catch(() => setError("브리핑 데이터를 불러올 수 없습니다."))
      .finally(() => setLoading(false));
  }, []);

  function handleShare() {
    if (!data) return;
    const shareUrl = "https://danbi.forlabs.io/briefing";
    const totalText =
      data.total_opportunity_krw > 0
        ? formatAmount(data.total_opportunity_krw)
        : "—";
    const text = `📊 이번 주 우리 회사 과제 기회\n${totalText}\n신청가능 ${data.available_count}건 · 마감임박 ${data.urgent_count}건`;
    if (navigator.share) {
      navigator.share({ title: "과제 기회 브리핑", text, url: shareUrl });
    } else {
      navigator.clipboard.writeText(text + "\n" + shareUrl);
      alert("클립보드에 복사되었습니다.");
    }
  }

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "calc(100vh - 40px)",
          background: F.bg,
        }}
      >
        <Loader2
          size={24}
          style={{ color: F.muted }}
          className="animate-spin"
        />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "calc(100vh - 40px)",
          background: F.bg,
          gap: 12,
        }}
      >
        <p style={{ fontSize: 13, color: F.muted }}>
          {error || "데이터를 불러올 수 없습니다."}
        </p>
        {error?.includes("로그인") && (
          <Link href="/login" style={{ fontSize: 12, color: F.primary }}>
            로그인하기 →
          </Link>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        height: "calc(100vh - 40px)",
        overflow: "auto",
        background: F.bg,
      }}
    >
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 32px" }}>
        {/* Back */}
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 12,
            color: F.muted,
            textDecoration: "none",
            marginBottom: 20,
          }}
        >
          <ChevronLeft size={14} />
          대시보드
        </Link>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              marginBottom: 4,
            }}
          >
            <span
              style={{
                fontSize: 10,
                color: F.muted,
                letterSpacing: "0.12em",
                textTransform: "uppercase" as const,
              }}
            >
              Intelligence Briefing
            </span>
            <span
              style={{
                fontSize: 10,
                color: F.muted,
                fontFamily: "monospace",
              }}
            >
              {data.date_label} · {data.week_label}
            </span>
          </div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: F.text,
              margin: "0 0 4px",
            }}
          >
            이번 주 과제 기회 브리핑
          </h1>
          <p style={{ fontSize: 12, color: F.muted, margin: 0 }}>
            {data.company_label}
          </p>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 10, marginBottom: 28 }}>
          <StatBox value={String(data.available_count)} label="신청 가능 건수" />
          <StatBox value={String(data.urgent_count)} label="마감 임박 (D-7)" />
          <StatBox
            value={
              data.total_opportunity_krw > 0
                ? formatAmount(data.total_opportunity_krw)
                : "—"
            }
            label="총 기회 금액"
          />
        </div>

        {/* Profile incomplete warning */}
        {data.profile_incomplete && (
          <div
            style={{
              background: "rgba(45,114,210,0.08)",
              border: "1px solid rgba(45,114,210,0.2)",
              borderRadius: 8,
              padding: "12px 16px",
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <p style={{ fontSize: 12, color: F.primary, margin: 0 }}>
              {data.missing_profile_fields[0]}을(를) 입력하면 더 많은 과제가
              매칭됩니다
            </p>
            <Link
              href="/mypage"
              style={{
                fontSize: 11,
                color: F.primary,
                textDecoration: "none",
                flexShrink: 0,
              }}
            >
              프로필 완성 →
            </Link>
          </div>
        )}

        {/* Urgent grants */}
        {data.urgent_grants.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <p
              style={{
                fontSize: 10,
                color: F.danger,
                letterSpacing: "0.1em",
                textTransform: "uppercase" as const,
                fontWeight: 600,
                marginBottom: 12,
              }}
            >
              🔴 지금 바로 신청하세요 (D-7 이내)
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.urgent_grants.map((g) => (
                <Link
                  key={g.grant_id}
                  href={`/grants/${g.grant_id}`}
                  style={{ textDecoration: "none" }}
                >
                  <div
                    style={{
                      background: F.card,
                      border: `1px solid ${F.border}`,
                      borderRadius: 8,
                      padding: "12px 16px",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginBottom:
                          g.eligibility_checklist &&
                          g.eligibility_checklist.length > 0
                            ? 8
                            : 0,
                      }}
                    >
                      {/* D-day badge */}
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: F.danger,
                          background: "rgba(194,48,48,0.12)",
                          borderRadius: 4,
                          padding: "2px 6px",
                          fontFamily: "monospace",
                          flexShrink: 0,
                        }}
                      >
                        D-{g.days_left}
                      </span>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: F.text,
                          flex: 1,
                        }}
                      >
                        {g.title}
                      </span>
                      {g.amount_max && (
                        <span
                          style={{
                            fontSize: 12,
                            color: F.primary,
                            fontWeight: 600,
                            flexShrink: 0,
                          }}
                        >
                          최대 {formatAmount(g.amount_max)}원
                        </span>
                      )}
                      {g.eligibility_score !== undefined &&
                        g.eligibility_score !== null && (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color:
                                g.eligibility_score >= 80
                                  ? F.success
                                  : F.primary,
                              background:
                                g.eligibility_score >= 80
                                  ? "rgba(35,162,109,0.12)"
                                  : F.glow,
                              borderRadius: 4,
                              padding: "2px 7px",
                              flexShrink: 0,
                            }}
                          >
                            적격성 {g.eligibility_score}%
                          </span>
                        )}
                    </div>
                    {/* Checklist summary */}
                    {g.eligibility_checklist &&
                      g.eligibility_checklist.length > 0 && (
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap" as const,
                            gap: "3px 12px",
                          }}
                        >
                          {g.eligibility_checklist.slice(0, 3).map((item, i) => (
                            <span
                              key={i}
                              style={{
                                fontSize: 10,
                                color:
                                  item.status === "pass"
                                    ? F.success
                                    : item.status === "fail"
                                    ? F.danger
                                    : F.warning,
                              }}
                            >
                              {item.status === "pass"
                                ? "✅"
                                : item.status === "fail"
                                ? "❌"
                                : "⚠️"}{" "}
                              {item.message}
                            </span>
                          ))}
                        </div>
                      )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* New grants this week */}
        {data.new_grants.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <p
              style={{
                fontSize: 10,
                color: F.warning,
                letterSpacing: "0.1em",
                textTransform: "uppercase" as const,
                fontWeight: 600,
                marginBottom: 12,
              }}
            >
              🟡 이번 주 신규 공고 (귀사 관련)
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {data.new_grants.slice(0, 8).map((g) => (
                <Link
                  key={g.grant_id}
                  href={`/grants/${g.grant_id}`}
                  style={{ textDecoration: "none" }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 14px",
                      background: F.card,
                      border: `1px solid ${F.border}`,
                      borderRadius: 6,
                    }}
                  >
                    {g.eligibility_score !== undefined &&
                      g.eligibility_score !== null && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: F.primary,
                            minWidth: 32,
                            flexShrink: 0,
                          }}
                        >
                          {g.eligibility_score}%
                        </span>
                      )}
                    <span
                      style={{
                        fontSize: 12,
                        color: F.text,
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap" as const,
                      }}
                    >
                      {g.title}
                    </span>
                    {g.amount_max && (
                      <span
                        style={{ fontSize: 11, color: F.muted, flexShrink: 0 }}
                      >
                        {formatAmount(g.amount_max)}원
                      </span>
                    )}
                    <ExternalLink
                      size={11}
                      color={F.muted}
                      style={{ flexShrink: 0 }}
                    />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Empty state if no eligible grants */}
        {data.available_count === 0 && (
          <div
            style={{
              textAlign: "center" as const,
              padding: "40px 20px",
              color: F.muted,
            }}
          >
            <p style={{ fontSize: 13, marginBottom: 8 }}>
              아직 매칭된 과제가 없습니다.
            </p>
            <Link
              href="/mypage"
              style={{ fontSize: 12, color: F.primary, textDecoration: "none" }}
            >
              프로필을 완성하면 더 많은 과제가 매칭됩니다 →
            </Link>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button
            onClick={handleShare}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: F.primary,
              color: F.text,
              border: "none",
              borderRadius: 6,
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Share2 size={14} />
            브리핑 공유하기
          </button>
          <Link
            href="/matching"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "transparent",
              color: F.muted,
              border: `1px solid ${F.border}`,
              borderRadius: 6,
              padding: "10px 20px",
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            전체 매칭 보기 →
          </Link>
        </div>
      </div>
    </div>
  );
}
