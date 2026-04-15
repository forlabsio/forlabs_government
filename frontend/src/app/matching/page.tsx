"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { fetchMatchResult, type MatchResult } from "@/lib/api";
import { FOUNDRY, INDUSTRY_OPTIONS, REGION_OPTIONS } from "@/lib/theme";
import { Loader2, Layers } from "lucide-react";

const LABEL_STYLE: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  color: FOUNDRY.muted,
  marginBottom: 5,
};

const INPUT_STYLE: React.CSSProperties = {
  background: FOUNDRY.card,
  border: `1px solid ${FOUNDRY.border}`,
  borderRadius: 6,
  color: FOUNDRY.text,
  padding: "7px 10px",
  fontSize: 13,
  width: "100%",
  outline: "none",
};

const SECTION_LABEL_STYLE: React.CSSProperties = {
  fontSize: 9,
  color: FOUNDRY.muted,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  fontWeight: 600,
  marginBottom: 16,
};

interface FormFieldProps {
  label: string;
  children: React.ReactNode;
}

function FormField({ label, children }: FormFieldProps) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={LABEL_STYLE}>{label}</label>
      {children}
    </div>
  );
}

export default function MatchingPage() {
  const [form, setForm] = useState({
    industry: "",
    region: "전국",
    employee_count: "",
    company_age: "",
    revenue_range: "",
    is_corporate: false as boolean | undefined,
    is_venture: false as boolean | undefined,
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [missingProfileFields, setMissingProfileFields] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem("govgrants_profile");
    if (stored) {
      try {
        const p = JSON.parse(stored);
        setForm(prev => ({
          ...prev,
          industry: p.industry || prev.industry,
          region: p.region || prev.region,
          employee_count: p.employeeCount ? String(p.employeeCount) : prev.employee_count,
          company_age: p.yearsInBusiness ? String(p.yearsInBusiness) : prev.company_age,
          revenue_range: p.revenueRange || prev.revenue_range,
          is_corporate: p.isCorporate ?? prev.is_corporate,
          is_venture: p.isVenture ?? prev.is_venture,
        }));
        const missing: string[] = [];
        if (!p.industry) missing.push("업종");
        if (!p.yearsInBusiness) missing.push("업력");
        if (!p.region) missing.push("소재지");
        if (!p.employeeCount) missing.push("직원수");
        setMissingProfileFields(missing);
      } catch {}
    }
  }, []);

  async function handleMatch() {
    if (!form.industry) return;
    setLoading(true);
    try {
      const res = await fetchMatchResult({
        industry: form.industry,
        region: form.region,
        employee_count: form.employee_count ? Number(form.employee_count) : undefined,
        company_age: form.company_age ? Number(form.company_age) : undefined,
        revenue_range: form.revenue_range || undefined,
        is_corporate: form.is_corporate,
        is_venture: form.is_venture,
      });
      // Sort by eligibility_score descending before setting state
      const sorted = {
        ...res,
        matched_grants: [...res.matched_grants].sort((a, b) => {
          if (a.eligibility_score == null && b.eligibility_score == null) return 0;
          if (a.eligibility_score == null) return 1;
          if (b.eligibility_score == null) return -1;
          return b.eligibility_score - a.eligibility_score;
        }),
      };
      setResult(sorted);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        height: "calc(100vh - 40px)",
        overflow: "hidden",
        background: FOUNDRY.bg,
      }}
    >
      {/* ── Left Panel: Query Params (260px) ─────────────────────── */}
      <div
        style={{
          width: 260,
          flexShrink: 0,
          background: FOUNDRY.sidebar,
          borderRight: `1px solid ${FOUNDRY.border}`,
          padding: 16,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <p style={SECTION_LABEL_STYLE}>Query Params</p>

        <FormField label="업종 *">
          <select
            value={form.industry}
            onChange={(e) => setForm({ ...form, industry: e.target.value })}
            style={INPUT_STYLE as React.CSSProperties}
          >
            <option value="">업종 선택</option>
            {INDUSTRY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="지역">
          <select
            value={form.region}
            onChange={(e) => setForm({ ...form, region: e.target.value })}
            style={INPUT_STYLE as React.CSSProperties}
          >
            {REGION_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="직원 수">
          <input
            type="number"
            placeholder="예: 10"
            value={form.employee_count}
            onChange={(e) => setForm({ ...form, employee_count: e.target.value })}
            style={INPUT_STYLE}
          />
        </FormField>

        <FormField label="업력 (년)">
          <input
            type="number"
            placeholder="예: 3"
            value={form.company_age}
            onChange={(e) => setForm({ ...form, company_age: e.target.value })}
            style={INPUT_STYLE}
          />
        </FormField>

        {missingProfileFields.length > 0 && (
          <div style={{
            marginBottom: 8,
            padding: "8px 10px",
            background: "rgba(45,114,210,0.08)",
            border: "1px solid rgba(45,114,210,0.2)",
            borderRadius: 6,
            fontSize: 10,
            color: FOUNDRY.primary,
            lineHeight: 1.4,
          }}>
            <Link href="/mypage" style={{ color: FOUNDRY.primary, textDecoration: "none", fontWeight: 600 }}>
              프로필 완성 →
            </Link>
            {" "}{missingProfileFields[0]}을(를) 입력하면 더 정확한 매칭이 가능합니다
          </div>
        )}

        <div style={{ marginTop: "auto", paddingTop: 16 }}>
          <button
            onClick={handleMatch}
            disabled={!form.industry || loading}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              border: "none",
              cursor: form.industry && !loading ? "pointer" : "not-allowed",
              background: form.industry ? FOUNDRY.primary : "rgba(255,255,255,0.05)",
              color: form.industry ? "#fff" : FOUNDRY.muted,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                매칭 중...
              </>
            ) : (
              "매칭 실행 →"
            )}
          </button>
        </div>
      </div>

      {/* ── Right Panel: Matched Grants (flex: 1) ───────────────────── */}
      <div
        style={{
          flex: 1,
          background: FOUNDRY.sidebar,
          borderLeft: `1px solid ${FOUNDRY.border}`,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Top bar */}
        <div
          style={{
            padding: "12px 16px 10px",
            borderBottom: `1px solid ${FOUNDRY.border}`,
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <Layers size={12} style={{ color: FOUNDRY.muted }} />
          <p style={{ ...SECTION_LABEL_STYLE, margin: 0 } as React.CSSProperties}>Matched Grants</p>
          {result && (
            <span
              style={{
                marginLeft: "auto",
                background: FOUNDRY.glow,
                color: FOUNDRY.primary,
                borderRadius: 999,
                padding: "2px 8px",
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {result.matched_grants.length}개
            </span>
          )}
        </div>

        {result && result.match_reason && (
          <p
            style={{
              fontSize: 11,
              color: FOUNDRY.muted,
              padding: "10px 16px 4px",
              lineHeight: 1.5,
              flexShrink: 0,
            }}
          >
            {result.match_reason}
          </p>
        )}

        {/* Empty state when no result */}
        {!result && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
              gap: 8,
              padding: 24,
            }}
          >
            <p style={{ fontSize: 12, color: FOUNDRY.muted, textAlign: "center" }}>
              매칭 결과가 여기에 표시됩니다
            </p>
          </div>
        )}

        {/* Grant cards */}
        {result && (
          <div style={{ flex: 1, paddingTop: 8 }}>
            {result.matched_grants.map((grant, idx) => (
              <Link
                key={grant.grant_id}
                href={`/grants/${grant.grant_id}`}
                style={{ textDecoration: "none", display: "block" }}
              >
                <div
                  style={{
                    background: FOUNDRY.card,
                    border: `1px solid ${FOUNDRY.border}`,
                    borderRadius: 8,
                    padding: 12,
                    margin: "0 12px 8px",
                    cursor: "pointer",
                    transition: "border-color 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor =
                      "rgba(45,114,210,0.5)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor =
                      FOUNDRY.border;
                  }}
                >
                  {/* Header row: rank badge + title */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                    <span
                      style={{
                        flexShrink: 0,
                        background: FOUNDRY.glow,
                        color: FOUNDRY.primary,
                        borderRadius: 4,
                        padding: "2px 6px",
                        fontSize: 10,
                        fontWeight: 700,
                        marginTop: 1,
                      }}
                    >
                      #{idx + 1}
                    </span>
                    <p
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: FOUNDRY.text,
                        lineHeight: 1.4,
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {grant.title}
                    </p>
                  </div>

                  {/* Stats row */}
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: "4px 8px",
                      marginBottom: 6,
                    }}
                  >
                    {grant.category && (
                      <span
                        style={{
                          background: FOUNDRY.border,
                          color: FOUNDRY.muted,
                          borderRadius: 4,
                          padding: "2px 6px",
                          fontSize: 10,
                        }}
                      >
                        {grant.category}
                      </span>
                    )}
                    {grant.organization && (
                      <span
                        style={{
                          fontSize: 11,
                          color: FOUNDRY.muted,
                          maxWidth: 90,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {grant.organization}
                      </span>
                    )}
                    {grant.amount_max && (
                      <span style={{ fontSize: 11, color: FOUNDRY.primary }}>
                        최대{" "}
                        {grant.amount_max >= 100000000
                          ? `${(grant.amount_max / 100000000).toFixed(1)}억`
                          : `${Math.round(grant.amount_max / 10000)}만`}
                        원
                      </span>
                    )}
                    {grant.end_date && (
                      <span style={{ fontSize: 11, color: FOUNDRY.warning }}>
                        마감 {grant.end_date}
                      </span>
                    )}
                  </div>

                  {/* Match reasons chips (up to 2) */}
                  {grant.match_reasons && grant.match_reasons.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {grant.match_reasons.slice(0, 2).map((r, i) => (
                        <span
                          key={i}
                          style={{
                            background: FOUNDRY.glow,
                            color: FOUNDRY.primary,
                            borderRadius: 999,
                            padding: "2px 8px",
                            fontSize: 10,
                          }}
                        >
                          ✓ {r}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Eligibility score + checklist */}
                  {grant.eligibility_score !== undefined && grant.eligibility_score !== null && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${FOUNDRY.border}` }}>
                      {/* Score bar */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <div style={{
                          flex: 1,
                          height: 4,
                          borderRadius: 2,
                          background: "rgba(255,255,255,0.08)",
                          overflow: "hidden",
                        }}>
                          <div style={{
                            height: "100%",
                            width: `${grant.eligibility_score}%`,
                            borderRadius: 2,
                            background: grant.eligibility_score >= 80 ? FOUNDRY.success
                                       : grant.eligibility_score >= 60 ? FOUNDRY.primary
                                       : FOUNDRY.warning,
                          }} />
                        </div>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: grant.eligibility_score >= 80 ? FOUNDRY.success
                                 : grant.eligibility_score >= 60 ? FOUNDRY.primary
                                 : FOUNDRY.warning,
                          flexShrink: 0,
                          minWidth: 32,
                          textAlign: "right" as const,
                        }}>
                          {grant.eligibility_score}%
                        </span>
                      </div>

                      {/* Checklist items */}
                      {grant.eligibility_checklist && grant.eligibility_checklist.map((item, i) => (
                        <div key={i} style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 5,
                          marginBottom: 3,
                        }}>
                          <span style={{ fontSize: 10, flexShrink: 0, marginTop: 1 }}>
                            {item.status === "pass" ? "✅" : item.status === "fail" ? "❌" : "⚠️"}
                          </span>
                          <span style={{
                            fontSize: 10,
                            color: item.status === "pass" ? FOUNDRY.success
                                   : item.status === "fail" ? FOUNDRY.danger
                                   : FOUNDRY.warning,
                            lineHeight: 1.4,
                          }}>
                            {item.message}
                          </span>
                        </div>
                      ))}

                      {/* Low confidence warning */}
                      {grant.eligibility_confidence === "low" && (
                        <p style={{ fontSize: 9, color: FOUNDRY.muted, marginTop: 4, margin: 0 }}>
                          ⚠️ 공고문 직접 확인 권장
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Reset button */}
        {result && (
          <div style={{ padding: "8px 12px 16px", flexShrink: 0 }}>
            <button
              onClick={() => setResult(null)}
              style={{
                width: "100%",
                padding: "9px",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                background: "transparent",
                border: `1px solid ${FOUNDRY.border}`,
                color: FOUNDRY.muted,
                cursor: "pointer",
              }}
            >
              다시 검색
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
