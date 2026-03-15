"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchRecommendations, type Grant } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import {
  Sparkles,
  GitBranch,
  TrendingUp,
  Network,
  Zap,
  Loader2,
  ArrowRight,
  Clock,
} from "lucide-react";
import { formatDDay, getDDay } from "@/lib/format";
import { FOUNDRY } from "@/lib/theme";

const INTELLIGENCE_CARDS = [
  {
    href: "/graph",
    icon: GitBranch,
    color: FOUNDRY.primary,
    title: "Knowledge Graph",
    desc: "과제·기관·기술분야 관계 탐색",
  },
  {
    href: "/trends",
    icon: TrendingUp,
    color: "#f97316",
    title: "트렌드 분석",
    desc: "기술·산업별 지원 동향 차트",
  },
  {
    href: "/network",
    icon: Network,
    color: FOUNDRY.success,
    title: "기업 네트워크",
    desc: "유사 기업 클러스터 분석",
  },
  {
    href: "/matching",
    icon: Zap,
    color: "#8b5cf6",
    title: "자동 매칭",
    desc: "내 기업 맞춤 과제 탐색",
  },
] as const;

export default function IntelligencePage() {
  const { user } = useAuth();
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("govgrants_token") : null;
    if (!token) return;
    setLoading(true);
    fetchRecommendations(token, 8)
      .then((r) => setGrants(r.items))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div
      style={{
        height: "calc(100vh - 40px)",
        overflow: "auto",
        background: FOUNDRY.bg,
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 32px" }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 8,
            }}
          >
            <Sparkles style={{ width: 14, height: 14, color: FOUNDRY.muted }} />
            <span
              style={{
                fontSize: 10,
                color: FOUNDRY.muted,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              INTELLIGENCE DASHBOARD
            </span>
          </div>
          <h1
            style={{
              fontSize: 24,
              color: FOUNDRY.text,
              fontWeight: 700,
              margin: 0,
            }}
          >
            나의 Intelligence 대시보드
          </h1>
          <p
            style={{
              fontSize: 13,
              color: FOUNDRY.muted,
              marginTop: 6,
              marginBottom: 0,
            }}
          >
            정부 R&D Knowledge Graph 기반 맞춤형 인텔리전스
          </p>
        </div>

        {/* Module Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
            marginBottom: 32,
          }}
        >
          {INTELLIGENCE_CARDS.map(({ href, icon: Icon, color, title, desc }) => (
            <Link
              key={href}
              href={href}
              style={{
                background: FOUNDRY.panel,
                border: `1px solid ${FOUNDRY.border}`,
                borderRadius: 8,
                padding: 16,
                textDecoration: "none",
                display: "block",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 6,
                  background: `${color}15`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 10,
                }}
              >
                <Icon style={{ width: 18, height: 18, color }} />
              </div>
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: FOUNDRY.text,
                  margin: 0,
                }}
              >
                {title}
              </p>
              <p
                style={{
                  fontSize: 11,
                  color: FOUNDRY.muted,
                  marginTop: 2,
                  marginBottom: 0,
                }}
              >
                {desc}
              </p>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  marginTop: 12,
                  color,
                  fontSize: 11,
                }}
              >
                탐색하기
                <ArrowRight style={{ width: 12, height: 12 }} />
              </div>
            </Link>
          ))}
        </div>

        {/* AI Recommendation Panel */}
        <div
          style={{
            background: FOUNDRY.panel,
            border: `1px solid ${FOUNDRY.border}`,
            borderRadius: 8,
            padding: 20,
          }}
        >
          {/* Panel Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Sparkles
                style={{ width: 16, height: 16, color: FOUNDRY.primary }}
              />
              <h2
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: FOUNDRY.text,
                  margin: 0,
                }}
              >
                AI 맞춤 추천 과제
              </h2>
            </div>
            <Link
              href="/grants"
              style={{
                fontSize: 12,
                color: FOUNDRY.muted,
                textDecoration: "none",
              }}
            >
              전체보기 →
            </Link>
          </div>

          {/* States */}
          {!user ? (
            <div style={{ padding: "32px 0", textAlign: "center" }}>
              <p style={{ fontSize: 13, color: FOUNDRY.muted, marginBottom: 12 }}>
                맞춤 추천을 받으려면 로그인하세요.
              </p>
              <Link
                href="/login"
                style={{
                  display: "inline-block",
                  background: FOUNDRY.primary,
                  color: FOUNDRY.text,
                  fontSize: 13,
                  fontWeight: 500,
                  padding: "8px 16px",
                  borderRadius: 6,
                  textDecoration: "none",
                }}
              >
                로그인
              </Link>
            </div>
          ) : loading ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "32px 0",
              }}
            >
              <Loader2
                className="animate-spin"
                style={{ width: 20, height: 20, color: FOUNDRY.primary }}
              />
              <span style={{ fontSize: 13, color: FOUNDRY.muted }}>
                맞춤 과제 분석 중...
              </span>
            </div>
          ) : grants.length > 0 ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 10,
              }}
            >
              {grants.map((grant) => {
                const dday = getDDay(grant.end_date);
                const ddayText = formatDDay(grant.end_date);
                const isUrgent = dday !== null && dday >= -7 && dday <= 0;
                return (
                  <Link
                    key={grant.id}
                    href={`/grants/${grant.id}`}
                    style={{
                      background: FOUNDRY.bg,
                      border: `1px solid ${FOUNDRY.border}`,
                      borderRadius: 6,
                      padding: "10px 12px",
                      display: "flex",
                      gap: 10,
                      textDecoration: "none",
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        flexShrink: 0,
                        borderRadius: 6,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        fontWeight: 700,
                        lineHeight: 1.2,
                        background: isUrgent
                          ? "rgba(194,48,48,0.15)"
                          : FOUNDRY.glow,
                        color: isUrgent ? FOUNDRY.danger : FOUNDRY.primary,
                      }}
                    >
                      {ddayText}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          color: FOUNDRY.text,
                          margin: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {grant.title}
                      </p>
                      <p
                        style={{
                          fontSize: 11,
                          color: FOUNDRY.muted,
                          marginTop: 4,
                          marginBottom: 0,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Clock style={{ width: 11, height: 11 }} />
                        {grant.organization || "-"}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: "32px 0", textAlign: "center" }}>
              <p style={{ fontSize: 13, color: FOUNDRY.muted, marginBottom: 8 }}>
                프로필을 채우면 맞춤 추천이 시작됩니다.
              </p>
              <Link
                href="/mypage"
                style={{
                  fontSize: 13,
                  color: FOUNDRY.primary,
                  textDecoration: "none",
                }}
              >
                프로필 설정하기
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
