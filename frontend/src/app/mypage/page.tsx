"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import {
  User,
  Building2,
  LogOut,
  Save,
  CheckCircle2,
} from "lucide-react";

const F = {
  bg:      "#0B1117",
  panel:   "#1C2B3C",
  card:    "#1F2D3D",
  border:  "rgba(255,255,255,0.08)",
  primary: "#2D72D2",
  glow:    "rgba(45,114,210,0.15)",
  text:    "#F0F4F8",
  muted:   "#7B919E",
  success: "#23A26D",
  warning: "#BF7326",
  danger:  "#C23030",
};

const INDUSTRIES = [
  "IT/소프트웨어",
  "제조업",
  "유통/물류",
  "서비스업",
  "건설/부동산",
  "농업/식품",
  "바이오/의료",
  "에너지/환경",
  "문화/콘텐츠",
  "교육",
  "금융",
  "기타",
];

const REGIONS = [
  "서울",
  "경기",
  "인천",
  "부산",
  "대구",
  "광주",
  "대전",
  "울산",
  "세종",
  "강원",
  "충북",
  "충남",
  "전북",
  "전남",
  "경북",
  "경남",
  "제주",
];

const REVENUE_RANGES = [
  "1억 미만",
  "1억~5억",
  "5억~10억",
  "10억~50억",
  "50억~100억",
  "100억 이상",
];

interface CompanyProfile {
  companyName: string;
  industry: string;
  yearsInBusiness: string;
  region: string;
  employeeCount: string;
  revenueRange: string;
  isCorporate: boolean;
  isVenture: boolean;
  emailNotification: boolean;
}

const inputStyle: React.CSSProperties = {
  background: F.card,
  border: `1px solid ${F.border}`,
  borderRadius: 6,
  color: F.text,
  fontSize: 13,
  padding: "9px 12px",
  width: "100%",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.15s",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: F.muted,
  marginBottom: 4,
  display: "block",
};

function FoundryInput({
  type = "text",
  value,
  onChange,
  placeholder,
}: {
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        ...inputStyle,
        borderColor: focused ? F.primary : F.border,
      }}
    />
  );
}

function FoundrySelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <select
      value={value}
      onChange={onChange}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        ...inputStyle,
        borderColor: focused ? F.primary : F.border,
        appearance: "none",
        cursor: "pointer",
      }}
    >
      {children}
    </select>
  );
}

const PROFILE_FIELDS: Array<{ key: keyof CompanyProfile; label: string }> = [
  { key: "companyName",     label: "기업명" },
  { key: "industry",        label: "업종" },
  { key: "yearsInBusiness", label: "업력" },
  { key: "region",          label: "소재지" },
  { key: "employeeCount",   label: "직원수" },
  { key: "revenueRange",    label: "매출 구간" },
  { key: "isCorporate",     label: "법인 여부" },
];

function getCompleteness(profile: CompanyProfile): { pct: number; missing: string[] } {
  const missing = PROFILE_FIELDS
    .filter(f => {
      const val = profile[f.key];
      return val === undefined || val === null || val === "" || val === false;
    })
    .map(f => f.label);
  const filled = PROFILE_FIELDS.length - missing.length;
  return { pct: Math.round(filled / PROFILE_FIELDS.length * 100), missing };
}

export default function MyPage() {
  const { user, signOut } = useAuth();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<CompanyProfile>({
    companyName: "",
    industry: "",
    yearsInBusiness: "",
    region: "",
    employeeCount: "",
    revenueRange: "",
    isCorporate: false,
    isVenture: false,
    emailNotification: true,
  });

  // Load profile from server (fallback to localStorage)
  useEffect(() => {
    async function loadProfile() {
      const token = localStorage.getItem("govgrants_token");
      if (token) {
        try {
          const { fetchMe } = await import("@/lib/api");
          const me = await fetchMe(token);
          setProfile({
            companyName: me.company_name || "",
            industry: me.industry || "",
            yearsInBusiness: me.company_age ? String(me.company_age) : "",
            region: me.region || "",
            employeeCount: me.employee_count ? String(me.employee_count) : "",
            revenueRange: me.revenue_range || "",
            isCorporate: me.is_corporate ?? false,
            isVenture: me.is_venture ?? false,
            emailNotification: me.email_opt_in ?? true,
          });
          return;
        } catch {
          // fallback to localStorage
        }
      }
      const stored = localStorage.getItem("govgrants_profile");
      if (stored) {
        try {
          setProfile(JSON.parse(stored));
        } catch {
          // ignore
        }
      }
    }
    loadProfile();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    try {
      localStorage.setItem("govgrants_profile", JSON.stringify(profile));

      const token = localStorage.getItem("govgrants_token");
      if (token) {
        const { updateProfile } = await import("@/lib/api");
        await updateProfile(token, {
          company_name: profile.companyName || undefined,
          industry: profile.industry || undefined,
          company_age: profile.yearsInBusiness ? parseInt(profile.yearsInBusiness) : undefined,
          region: profile.region || undefined,
          employee_count: profile.employeeCount ? parseInt(profile.employeeCount) : undefined,
          revenue_range: profile.revenueRange || undefined,
          is_corporate: profile.isCorporate,
          is_venture: profile.isVenture,
          email_opt_in: profile.emailNotification,
        });
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  function updateField<K extends keyof CompanyProfile>(
    key: K,
    value: CompanyProfile[K]
  ) {
    setProfile((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div style={{ height: "calc(100vh - 40px)", overflow: "auto", background: F.bg }}>
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "24px 32px" }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <User size={14} color={F.primary} />
            <span style={{ fontSize: 10, color: F.muted, letterSpacing: "0.12em", textTransform: "uppercase" }}>
              MY PROFILE
            </span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: F.text, margin: 0, marginBottom: 4 }}>
            프로필 설정
          </h1>
          <p style={{ fontSize: 12, color: F.muted, margin: 0 }}>
            {user?.email}
          </p>
        </div>

        {/* Profile form panel */}
        <div style={{
          background: F.panel,
          border: `1px solid ${F.border}`,
          borderRadius: 8,
          padding: 24,
          marginBottom: 16,
        }}>
          {/* Section header */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 20 }}>
            <Building2 size={13} color={F.muted} />
            <span style={{
              fontSize: 10,
              color: F.muted,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}>
              기업 정보
            </span>
          </div>

          {/* Profile completeness */}
          {(() => {
            const { pct, missing } = getCompleteness(profile);
            return (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: F.muted }}>프로필 완성도</span>
                  <span style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: pct >= 80 ? F.success : pct >= 50 ? F.primary : F.warning,
                  }}>
                    {pct}%
                  </span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.08)", marginBottom: 8 }}>
                  <div style={{
                    height: "100%",
                    width: `${pct}%`,
                    borderRadius: 2,
                    background: pct >= 80 ? F.success : pct >= 50 ? F.primary : F.warning,
                    transition: "width 0.3s",
                  }} />
                </div>
                {missing.length > 0 && (
                  <p style={{ fontSize: 11, color: F.primary, margin: 0 }}>
                    {missing[0]}을(를) 입력하면 매칭 정확도가 높아집니다
                  </p>
                )}
              </div>
            );
          })()}

          <form onSubmit={handleSave}>
            {/* Company Name */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>기업명</label>
              <FoundryInput
                value={profile.companyName}
                onChange={(e) => updateField("companyName", e.target.value)}
                placeholder="주식회사 예시"
              />
            </div>

            {/* Industry + Years — 2-column */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>업종</label>
                <FoundrySelect
                  value={profile.industry}
                  onChange={(e) => updateField("industry", e.target.value)}
                >
                  <option value="">선택하세요</option>
                  {INDUSTRIES.map((ind) => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </FoundrySelect>
              </div>
              <div>
                <label style={labelStyle}>업력</label>
                <FoundryInput
                  value={profile.yearsInBusiness}
                  onChange={(e) => updateField("yearsInBusiness", e.target.value)}
                  placeholder="예: 3년"
                />
              </div>
            </div>

            {/* Region + Employee Count — 2-column */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>소재지</label>
                <FoundrySelect
                  value={profile.region}
                  onChange={(e) => updateField("region", e.target.value)}
                >
                  <option value="">선택하세요</option>
                  {REGIONS.map((reg) => (
                    <option key={reg} value={reg}>{reg}</option>
                  ))}
                </FoundrySelect>
              </div>
              <div>
                <label style={labelStyle}>직원수</label>
                <FoundryInput
                  value={profile.employeeCount}
                  onChange={(e) => updateField("employeeCount", e.target.value)}
                  placeholder="예: 15명"
                />
              </div>
            </div>

            {/* Revenue Range */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>매출 구간</label>
              <FoundrySelect
                value={profile.revenueRange}
                onChange={(e) => updateField("revenueRange", e.target.value)}
              >
                <option value="">선택하세요</option>
                {REVENUE_RANGES.map((rev) => (
                  <option key={rev} value={rev}>{rev}</option>
                ))}
              </FoundrySelect>
            </div>

            {/* Corporate / Venture flags — 2-column */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              {(
                [
                  { key: "isCorporate" as const, label: "법인 기업", desc: "법인 필수 과제 지원 가능" },
                  { key: "isVenture" as const, label: "벤처기업 인증", desc: "벤처기업 대상 과제 지원 가능" },
                ] as const
              ).map(({ key, label, desc }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => updateField(key, !profile[key])}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: profile[key] ? "rgba(45,114,210,0.12)" : F.card,
                    border: `1px solid ${profile[key] ? F.primary : F.border}`,
                    borderRadius: 6,
                    padding: "10px 12px",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    border: `1.5px solid ${profile[key] ? F.primary : F.border}`,
                    background: profile[key] ? F.primary : "transparent",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    {profile[key] && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: F.text, margin: 0 }}>{label}</p>
                    <p style={{ fontSize: 10, color: F.muted, margin: 0 }}>{desc}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Email Notification Toggle */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: F.card,
              border: `1px solid ${F.border}`,
              borderRadius: 6,
              padding: "12px 14px",
              marginBottom: 20,
            }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 500, color: F.text, margin: 0, marginBottom: 2 }}>
                  이메일 알림 수신
                </p>
                <p style={{ fontSize: 11, color: F.muted, margin: 0 }}>
                  맞춤 지원사업이 등록되면 이메일로 알려드립니다
                </p>
              </div>
              <button
                type="button"
                onClick={() => updateField("emailNotification", !profile.emailNotification)}
                style={{
                  position: "relative",
                  display: "inline-flex",
                  height: 24,
                  width: 44,
                  flexShrink: 0,
                  cursor: "pointer",
                  borderRadius: 12,
                  border: "none",
                  background: profile.emailNotification ? F.primary : "rgba(255,255,255,0.12)",
                  transition: "background 0.2s",
                  padding: 0,
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    height: 20,
                    width: 20,
                    borderRadius: "50%",
                    background: "#fff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
                    position: "absolute",
                    top: 2,
                    left: profile.emailNotification ? 22 : 2,
                    transition: "left 0.2s",
                  }}
                />
              </button>
            </div>

            {/* Save Button */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: saved ? "rgba(35,162,109,0.15)" : F.primary,
                  color: saved ? F.success : F.text,
                  border: saved ? `1px solid ${F.success}` : "none",
                  borderRadius: 6,
                  padding: "10px 20px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.6 : 1,
                  transition: "all 0.2s",
                }}
              >
                {saved ? (
                  <>
                    <CheckCircle2 size={14} />
                    저장되었습니다
                  </>
                ) : saving ? (
                  <>저장 중...</>
                ) : (
                  <>
                    <Save size={14} />
                    저장하기
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Logout button */}
        <button
          type="button"
          onClick={signOut}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(194,48,48,0.1)",
            color: F.danger,
            border: "1px solid rgba(194,48,48,0.2)",
            borderRadius: 6,
            padding: "10px 20px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <LogOut size={14} />
          로그아웃
        </button>

      </div>
    </div>
  );
}
