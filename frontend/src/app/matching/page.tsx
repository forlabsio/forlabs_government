"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { fetchMatchResult, type MatchResult } from "@/lib/api";
import { FOUNDRY, INDUSTRY_OPTIONS, REGION_OPTIONS } from "@/lib/theme";
import { Loader2, GitBranch } from "lucide-react";

const KnowledgeGraph = dynamic(() => import("@/components/KnowledgeGraph"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
      }}
    >
      <Loader2 size={24} style={{ color: FOUNDRY.muted }} className="animate-spin" />
    </div>
  ),
});

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
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MatchResult | null>(null);

  async function handleMatch() {
    if (!form.industry) return;
    setLoading(true);
    try {
      const res = await fetchMatchResult({
        industry: form.industry,
        region: form.region,
        employee_count: form.employee_count ? Number(form.employee_count) : undefined,
        company_age: form.company_age ? Number(form.company_age) : undefined,
      });
      setResult(res);
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

      {/* ── Center Panel: Match Path Graph (flex: 1) ──────────────── */}
      <div
        style={{
          flex: 1,
          background: FOUNDRY.bg,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {!result && !loading && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              gap: 12,
            }}
          >
            <GitBranch size={32} style={{ color: FOUNDRY.muted }} />
            <p style={{ fontSize: 13, color: FOUNDRY.muted }}>
              업종을 선택하고 매칭을 실행하세요
            </p>
          </div>
        )}

        {loading && !result && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              gap: 12,
            }}
          >
            <Loader2 size={28} style={{ color: FOUNDRY.primary }} className="animate-spin" />
            <p style={{ fontSize: 13, color: FOUNDRY.muted }}>
              Knowledge Graph를 탐색하는 중...
            </p>
          </div>
        )}

        {result && (
          <div style={{ height: "100%", width: "100%" }}>
            <KnowledgeGraph data={result.graph} />
          </div>
        )}
      </div>

      {/* ── Right Panel: Matched Grants (320px) ───────────────────── */}
      <div
        style={{
          width: 320,
          flexShrink: 0,
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
          <p style={SECTION_LABEL_STYLE as React.CSSProperties}>Matched Grants</p>
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

        {/* match_reason */}
        {result?.match_reason && (
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
