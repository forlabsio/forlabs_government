"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { fetchMatchResult, type MatchResult } from "@/lib/api";
import { INDUSTRY_OPTIONS, REGION_OPTIONS } from "@/lib/theme";
import { Zap, Loader2, ChevronRight } from "lucide-react";

const KnowledgeGraph = dynamic(() => import("@/components/KnowledgeGraph"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
    </div>
  ),
});

type Step = 1 | 2 | 3;

export default function MatchingPage() {
  const [step, setStep] = useState<Step>(1);
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
    setStep(2);
    try {
      const res = await fetchMatchResult({
        industry: form.industry,
        region: form.region,
        employee_count: form.employee_count ? Number(form.employee_count) : undefined,
        company_age: form.company_age ? Number(form.company_age) : undefined,
      });
      setResult(res);
      setStep(3);
    } catch (e) {
      console.error(e);
      setStep(1);
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    background: "#141c30",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#e8edf5",
    borderRadius: "8px",
    padding: "10px 12px",
    width: "100%",
    fontSize: "14px",
  };

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6" style={{ background: "#0a0e1a" }}>
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <Zap className="h-6 w-6 text-cyan-400" />
          <div>
            <h1 className="text-xl font-semibold text-white">지원사업 자동매칭</h1>
            <p className="text-sm text-gray-500">
              기업 정보 입력 → Knowledge Graph 탐색 → 최적 과제 추천
            </p>
          </div>
        </div>

        {/* Step indicators */}
        <div className="mb-8 flex items-center gap-2">
          {([1, 2, 3] as Step[]).map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
                style={{
                  background: step >= s ? "#00d4ff" : "#1e2d4a",
                  color: step >= s ? "#0a0e1a" : "#4a6080",
                }}
              >
                {s}
              </div>
              <span className={`text-sm ${step >= s ? "text-white" : "text-gray-600"}`}>
                {s === 1 ? "기업 정보" : s === 2 ? "그래프 탐색" : "매칭 결과"}
              </span>
              {s < 3 && <ChevronRight className="h-4 w-4 text-gray-700" />}
            </div>
          ))}
        </div>

        {/* Step 1: Form */}
        {step === 1 && (
          <div
            className="max-w-md rounded-xl p-6"
            style={{
              background: "#0f1628",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <h2 className="mb-5 text-base font-semibold text-white">기업 정보 입력</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs text-gray-500">업종 *</label>
                <select
                  value={form.industry}
                  onChange={(e) => setForm({ ...form, industry: e.target.value })}
                  style={inputStyle as React.CSSProperties}
                >
                  <option value="">업종 선택</option>
                  {INDUSTRY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-gray-500">지역</label>
                <select
                  value={form.region}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                  style={inputStyle as React.CSSProperties}
                >
                  {REGION_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs text-gray-500">직원 수</label>
                  <input
                    type="number"
                    placeholder="예: 10"
                    value={form.employee_count}
                    onChange={(e) =>
                      setForm({ ...form, employee_count: e.target.value })
                    }
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-gray-500">업력 (년)</label>
                  <input
                    type="number"
                    placeholder="예: 3"
                    value={form.company_age}
                    onChange={(e) => setForm({ ...form, company_age: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>
              <button
                onClick={handleMatch}
                disabled={!form.industry}
                className="mt-2 w-full rounded-lg py-3 text-sm font-semibold text-gray-900 transition-colors disabled:opacity-50"
                style={{ background: form.industry ? "#00d4ff" : "#1e2d4a" }}
              >
                매칭 시작 →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Loading */}
        {step === 2 && loading && (
          <div className="flex h-48 flex-col items-center justify-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
            <p className="text-sm text-gray-400">Knowledge Graph를 탐색하는 중...</p>
            <p className="text-xs text-gray-600">업종 → 기술분야 → 과제 경로 계산</p>
          </div>
        )}

        {/* Step 3: Results */}
        {step === 3 && result && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Match graph */}
            <div
              className="overflow-hidden rounded-xl"
              style={{
                background: "#0f1628",
                border: "1px solid rgba(255,255,255,0.08)",
                height: 400,
              }}
            >
              <div
                className="px-4 py-3"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
              >
                <p className="text-xs font-semibold text-gray-400">매칭 경로 시각화</p>
              </div>
              <div style={{ height: 350 }}>
                <KnowledgeGraph data={result.graph} />
              </div>
            </div>

            {/* Matched grants list */}
            <div
              className="rounded-xl p-4"
              style={{
                background: "#0f1628",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-400">매칭된 과제</p>
                <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-400">
                  {result.matched_grants.length}개
                </span>
              </div>
              <p className="mb-4 text-xs text-gray-500">{result.match_reason}</p>
              <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 320 }}>
                {result.matched_grants.map((grant) => (
                  <a
                    key={grant.grant_id}
                    href={`/grants/${grant.grant_id}`}
                    className="block rounded-lg p-3 transition-colors"
                    style={{ background: "#141c30" }}
                  >
                    <p className="text-sm font-medium text-white line-clamp-2">
                      {grant.title}
                    </p>
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-500">
                      {grant.organization && <span>{grant.organization}</span>}
                      {grant.amount_max && (
                        <span className="text-cyan-400">
                          최대 {(grant.amount_max / 10000).toFixed(0)}만원
                        </span>
                      )}
                      {grant.end_date && <span>마감 {grant.end_date}</span>}
                    </div>
                  </a>
                ))}
              </div>
              <button
                onClick={() => {
                  setStep(1);
                  setResult(null);
                }}
                className="mt-4 w-full rounded-lg py-2 text-sm text-gray-400 hover:bg-white/5"
                style={{ border: "1px solid rgba(255,255,255,0.08)" }}
              >
                다시 검색
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
