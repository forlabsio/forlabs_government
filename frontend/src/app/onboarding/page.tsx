"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { updateProfile } from "@/lib/api";
import { FOUNDRY } from "@/lib/theme";

const INDUSTRIES = [
  "IT/소프트웨어", "제조업", "바이오/의료", "문화/콘텐츠",
  "에너지/환경", "농업/식품", "서비스업", "건설/건축", "기타",
];

const REGIONS = [
  "서울", "경기", "인천", "부산", "대구", "대전", "광주",
  "울산", "세종", "강원", "충북", "충남", "전북", "전남",
  "경북", "경남", "제주",
];

const CERT_OPTIONS = [
  "벤처기업", "이노비즈", "메인비즈", "ISO 9001", "ISO 14001",
  "기업부설연구소", "연구개발전담부서",
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    company_name: "",
    industry: "",
    region: "",
    employee_count: 0,
    revenue_krw: 0,
    company_age: 0,
    is_corporate: false,
    is_venture: false,
    certifications: [] as string[],
  });

  function update(key: string, value: any) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleCert(cert: string) {
    setForm((prev) => ({
      ...prev,
      certifications: prev.certifications.includes(cert)
        ? prev.certifications.filter((c) => c !== cert)
        : [...prev.certifications, cert],
    }));
  }

  async function handleComplete() {
    const token = localStorage.getItem("govgrants_token");
    if (!token) return;
    setSaving(true);
    try {
      await updateProfile(token, form);
      await refreshUser();
      router.push("/matching");
    } catch {
      alert("저장에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    width: "100%", padding: "10px 14px", background: FOUNDRY.bg, color: FOUNDRY.text,
    border: `1px solid ${FOUNDRY.border}`, borderRadius: 8, fontSize: 14, outline: "none",
  } as const;

  const labelStyle = { display: "block", fontSize: 13, color: FOUNDRY.muted, marginBottom: 6 } as const;

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: FOUNDRY.bg, padding: 24,
    }}>
      <div style={{
        width: "100%", maxWidth: 480, background: FOUNDRY.card,
        border: `1px solid ${FOUNDRY.border}`, borderRadius: 16, padding: "32px 28px",
      }}>
        {/* Progress */}
        <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
          {[1, 2, 3].map((s) => (
            <div key={s} style={{
              flex: 1, height: 4, borderRadius: 2,
              background: s <= step ? FOUNDRY.primary : FOUNDRY.border,
              transition: "background 0.2s",
            }} />
          ))}
        </div>

        <h1 style={{ fontSize: 20, fontWeight: 700, color: FOUNDRY.text, margin: "0 0 6px" }}>
          {step === 1 && "기업 기본 정보"}
          {step === 2 && "기업 규모"}
          {step === 3 && "자격 및 특성"}
        </h1>
        <p style={{ fontSize: 13, color: FOUNDRY.muted, margin: "0 0 24px" }}>
          {step === 1 && "맞춤 지원사업 매칭을 위해 기본 정보를 입력해주세요."}
          {step === 2 && "기업 규모에 따라 더 정확한 매칭이 가능합니다."}
          {step === 3 && "보유 인증과 특성을 선택해주세요."}
        </p>

        {/* Step 1: Basic info */}
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={labelStyle}>회사명 *</label>
              <input style={inputStyle} value={form.company_name} onChange={(e) => update("company_name", e.target.value)} placeholder="주식회사 예시" />
            </div>
            <div>
              <label style={labelStyle}>업종 *</label>
              <select style={{ ...inputStyle, cursor: "pointer" }} value={form.industry} onChange={(e) => update("industry", e.target.value)}>
                <option value="">선택하세요</option>
                {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>소재지 *</label>
              <select style={{ ...inputStyle, cursor: "pointer" }} value={form.region} onChange={(e) => update("region", e.target.value)}>
                <option value="">선택하세요</option>
                {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Step 2: Size */}
        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={labelStyle}>직원수</label>
              <input style={inputStyle} type="number" min={0} value={form.employee_count || ""} onChange={(e) => update("employee_count", parseInt(e.target.value) || 0)} placeholder="10" />
            </div>
            <div>
              <label style={labelStyle}>연매출 (원)</label>
              <input style={inputStyle} type="number" min={0} value={form.revenue_krw || ""} onChange={(e) => update("revenue_krw", parseInt(e.target.value) || 0)} placeholder="500000000" />
            </div>
            <div>
              <label style={labelStyle}>업력 (년)</label>
              <input style={inputStyle} type="number" min={0} value={form.company_age || ""} onChange={(e) => update("company_age", parseInt(e.target.value) || 0)} placeholder="3" />
            </div>
          </div>
        )}

        {/* Step 3: Certs */}
        {step === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={labelStyle}>법인 여부</label>
              <div style={{ display: "flex", gap: 10 }}>
                {[{ label: "법인", key: "is_corporate" }, { label: "벤처기업", key: "is_venture" }].map((opt) => (
                  <button key={opt.key} onClick={() => update(opt.key, !(form as any)[opt.key])} style={{
                    padding: "8px 16px", borderRadius: 8, fontSize: 13, cursor: "pointer",
                    background: (form as any)[opt.key] ? FOUNDRY.primary + "20" : "transparent",
                    color: (form as any)[opt.key] ? FOUNDRY.primary : FOUNDRY.muted,
                    border: `1px solid ${(form as any)[opt.key] ? FOUNDRY.primary : FOUNDRY.border}`,
                  }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={labelStyle}>보유 인증 (복수 선택)</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {CERT_OPTIONS.map((cert) => (
                  <button key={cert} onClick={() => toggleCert(cert)} style={{
                    padding: "6px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer",
                    background: form.certifications.includes(cert) ? FOUNDRY.primary + "20" : "transparent",
                    color: form.certifications.includes(cert) ? FOUNDRY.primary : FOUNDRY.muted,
                    border: `1px solid ${form.certifications.includes(cert) ? FOUNDRY.primary : FOUNDRY.border}`,
                  }}>
                    {cert}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 28 }}>
          {step > 1 ? (
            <button onClick={() => setStep(step - 1)} style={{
              padding: "10px 20px", background: "transparent", color: FOUNDRY.muted,
              border: `1px solid ${FOUNDRY.border}`, borderRadius: 8, fontSize: 13, cursor: "pointer",
            }}>
              이전
            </button>
          ) : <div />}
          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={step === 1 && (!form.company_name || !form.industry || !form.region)}
              style={{
                padding: "10px 24px", background: FOUNDRY.primary, color: "white",
                border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                opacity: step === 1 && (!form.company_name || !form.industry || !form.region) ? 0.4 : 1,
              }}
            >
              다음
            </button>
          ) : (
            <button onClick={handleComplete} disabled={saving} style={{
              padding: "10px 24px", background: FOUNDRY.success, color: "white",
              border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
              opacity: saving ? 0.6 : 1,
            }}>
              {saving ? "저장 중..." : "완료"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
