"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import {
  sendVerificationCode,
  verifyCode,
  signup,
} from "@/lib/api";
import Link from "next/link";
import { Mail, KeyRound, Building2, CheckCircle2, Eye, EyeOff } from "lucide-react";

const F = {
  bg:      "#0B1117",
  sidebar: "#161C22",
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

// Shared input style factory
function inputStyle(focused: boolean): React.CSSProperties {
  return {
    width: "100%",
    background: F.card,
    border: `1px solid ${focused ? F.primary : F.border}`,
    borderRadius: 6,
    padding: "10px 12px",
    fontSize: 13,
    color: F.text,
    outline: "none",
    boxSizing: "border-box",
  };
}

function selectStyle(focused: boolean): React.CSSProperties {
  return {
    width: "100%",
    background: F.card,
    border: `1px solid ${focused ? F.primary : F.border}`,
    borderRadius: 6,
    padding: "10px 12px",
    fontSize: 13,
    color: F.text,
    outline: "none",
    boxSizing: "border-box",
    appearance: "none" as React.CSSProperties["appearance"],
  };
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  color: F.muted,
  fontWeight: 500,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  marginBottom: 6,
};

export default function SignupPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 1
  const [email, setEmail] = useState("");
  const [emailFocused, setEmailFocused] = useState(false);

  // Step 2
  const [code, setCode] = useState("");
  const [codeFocused, setCodeFocused] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Step 3 focus states
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Step 3
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [companyAge, setCompanyAge] = useState("");
  const [region, setRegion] = useState("");
  const [employeeCount, setEmployeeCount] = useState("");
  const [revenueRange, setRevenueRange] = useState("");
  const [emailOptIn, setEmailOptIn] = useState(true);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleSendCode = useCallback(async () => {
    if (!email.trim() || !email.includes("@")) {
      setError("올바른 이메일 주소를 입력해주세요.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await sendVerificationCode(email.trim());
      setStep(2);
      setCountdown(600);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "인증코드 발송에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [email]);

  const handleResendCode = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await sendVerificationCode(email.trim());
      setCountdown(600);
      setCode("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "인증코드 재발송에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [email]);

  const handleVerifyCode = useCallback(async () => {
    if (code.length !== 6) {
      setError("6자리 인증코드를 입력해주세요.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await verifyCode(email.trim(), code);
      setStep(3);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "인증코드 확인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [email, code]);

  const handleSignup = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (password.length < 8) {
        setError("비밀번호는 8자 이상이어야 합니다.");
        return;
      }
      if (password !== passwordConfirm) {
        setError("비밀번호가 일치하지 않습니다.");
        return;
      }

      setLoading(true);
      setError("");
      try {
        const result = await signup({
          email: email.trim(),
          password,
          name: companyName || email.split("@")[0],
          company_name: companyName || undefined,
          industry: industry || undefined,
          company_age: companyAge ? parseInt(companyAge, 10) : undefined,
          region: region || undefined,
          employee_count: employeeCount
            ? parseInt(employeeCount, 10)
            : undefined,
          revenue_range: revenueRange || undefined,
          email_opt_in: emailOptIn,
          verification_code: code,
        });

        localStorage.setItem("govgrants_token", result.token);
        await refreshUser();
        setStep(4);
        setTimeout(() => router.push("/grants"), 2000);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "회원가입에 실패했습니다.");
      } finally {
        setLoading(false);
      }
    },
    [
      email,
      password,
      passwordConfirm,
      companyName,
      industry,
      companyAge,
      region,
      employeeCount,
      revenueRange,
      emailOptIn,
      code,
      refreshUser,
      router,
    ]
  );

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const errorBlock = error ? (
    <div
      style={{
        marginTop: 12,
        background: "rgba(194,48,48,0.1)",
        border: `1px solid ${F.danger}`,
        borderRadius: 6,
        padding: "10px 12px",
        fontSize: 12,
        color: F.danger,
      }}
    >
      {error}
    </div>
  ) : null;

  return (
    <div
      style={{
        height: "calc(100vh - 40px)",
        background: F.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 16px",
        overflowY: "auto",
      }}
    >
      <div style={{ width: 460 }}>
        {/* Progress bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 6,
            marginBottom: 24,
          }}
        >
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              style={{
                height: 3,
                width: 60,
                borderRadius: 2,
                background: step >= s ? F.primary : F.border,
                transition: "background 0.2s",
              }}
            />
          ))}
        </div>

        <div
          style={{
            background: F.panel,
            border: `1px solid ${F.border}`,
            borderRadius: 12,
            padding: 40,
          }}
        >
          {/* ─── Step 1: Email ─── */}
          {step === 1 && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: F.glow,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Mail size={16} color={F.primary} />
                </div>
                <div>
                  <h1 style={{ fontSize: 16, fontWeight: 700, color: F.text, margin: 0 }}>
                    회원가입
                  </h1>
                  <p style={{ fontSize: 12, color: F.muted, margin: 0, marginTop: 2 }}>
                    이메일 주소를 입력해주세요
                  </p>
                </div>
              </div>

              <label style={labelStyle}>이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendCode()}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                placeholder="example@company.com"
                style={{ ...inputStyle(emailFocused), marginBottom: 16 }}
                autoFocus
              />

              {errorBlock}

              <button
                type="button"
                onClick={handleSendCode}
                disabled={loading || !email.trim()}
                style={{
                  marginTop: error ? 12 : 0,
                  width: "100%",
                  background: loading || !email.trim() ? "rgba(45,114,210,0.3)" : F.primary,
                  color: F.text,
                  border: "none",
                  borderRadius: 6,
                  padding: "11px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: loading || !email.trim() ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "발송 중..." : "인증코드 발송"}
              </button>

              <p style={{ fontSize: 12, color: F.muted, textAlign: "center", marginTop: 20, marginBottom: 0 }}>
                이미 계정이 있으신가요?{" "}
                <Link href="/login" style={{ color: F.primary, textDecoration: "none" }}>
                  로그인
                </Link>
              </p>
            </div>
          )}

          {/* ─── Step 2: Verify Code ─── */}
          {step === 2 && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: F.glow,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <KeyRound size={16} color={F.primary} />
                </div>
                <div>
                  <h1 style={{ fontSize: 16, fontWeight: 700, color: F.text, margin: 0 }}>
                    이메일 인증
                  </h1>
                  <p style={{ fontSize: 12, color: F.muted, margin: 0, marginTop: 2 }}>
                    <span style={{ color: F.text }}>{email}</span>으로 발송된 인증코드를 입력해주세요
                  </p>
                </div>
              </div>

              <label style={labelStyle}>인증코드 6자리</label>
              <input
                type="text"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                onKeyDown={(e) => e.key === "Enter" && handleVerifyCode()}
                onFocus={() => setCodeFocused(true)}
                onBlur={() => setCodeFocused(false)}
                placeholder="000000"
                maxLength={6}
                style={{
                  ...inputStyle(codeFocused),
                  textAlign: "center",
                  fontSize: 24,
                  fontWeight: 700,
                  letterSpacing: "0.4em",
                  marginBottom: 8,
                }}
                autoFocus
              />

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: F.muted }}>
                  {countdown > 0
                    ? `남은 시간: ${formatCountdown(countdown)}`
                    : "인증코드가 만료되었습니다"}
                </span>
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={loading}
                  style={{
                    background: "none",
                    border: "none",
                    color: F.primary,
                    fontSize: 12,
                    cursor: loading ? "not-allowed" : "pointer",
                    padding: 0,
                  }}
                >
                  재발송
                </button>
              </div>

              {errorBlock}

              <button
                type="button"
                onClick={handleVerifyCode}
                disabled={loading || code.length !== 6 || countdown <= 0}
                style={{
                  marginTop: 12,
                  width: "100%",
                  background:
                    loading || code.length !== 6 || countdown <= 0
                      ? "rgba(45,114,210,0.3)"
                      : F.primary,
                  color: F.text,
                  border: "none",
                  borderRadius: 6,
                  padding: "11px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor:
                    loading || code.length !== 6 || countdown <= 0
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {loading ? "확인 중..." : "확인"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setError("");
                }}
                style={{
                  marginTop: 10,
                  width: "100%",
                  background: "none",
                  border: "none",
                  color: F.muted,
                  fontSize: 12,
                  cursor: "pointer",
                  padding: "8px 0",
                }}
              >
                이메일 변경
              </button>
            </div>
          )}

          {/* ─── Step 3: Company Info + Password ─── */}
          {step === 3 && (
            <form onSubmit={handleSignup}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: F.glow,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Building2 size={16} color={F.primary} />
                </div>
                <div>
                  <h1 style={{ fontSize: 16, fontWeight: 700, color: F.text, margin: 0 }}>
                    기업 정보
                  </h1>
                  <p style={{ fontSize: 12, color: F.muted, margin: 0, marginTop: 2 }}>
                    맞춤 지원사업 추천을 위해 정보를 입력해주세요
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Company Name */}
                <div>
                  <label style={labelStyle}>기업명</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    onFocus={() => setFocusedField("companyName")}
                    onBlur={() => setFocusedField(null)}
                    placeholder="기업명을 입력해주세요"
                    style={inputStyle(focusedField === "companyName")}
                  />
                </div>

                {/* Industry + Region */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={labelStyle}>업종</label>
                    <select
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      onFocus={() => setFocusedField("industry")}
                      onBlur={() => setFocusedField(null)}
                      style={selectStyle(focusedField === "industry")}
                    >
                      <option value="">선택</option>
                      {INDUSTRIES.map((i) => (
                        <option key={i} value={i}>{i}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>소재지</label>
                    <select
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      onFocus={() => setFocusedField("region")}
                      onBlur={() => setFocusedField(null)}
                      style={selectStyle(focusedField === "region")}
                    >
                      <option value="">선택</option>
                      {REGIONS.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Company Age + Employee Count */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={labelStyle}>업력 (년)</label>
                    <input
                      type="number"
                      value={companyAge}
                      onChange={(e) => setCompanyAge(e.target.value)}
                      onFocus={() => setFocusedField("companyAge")}
                      onBlur={() => setFocusedField(null)}
                      placeholder="예: 3"
                      min="0"
                      style={inputStyle(focusedField === "companyAge")}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>직원수</label>
                    <input
                      type="number"
                      value={employeeCount}
                      onChange={(e) => setEmployeeCount(e.target.value)}
                      onFocus={() => setFocusedField("employeeCount")}
                      onBlur={() => setFocusedField(null)}
                      placeholder="예: 10"
                      min="0"
                      style={inputStyle(focusedField === "employeeCount")}
                    />
                  </div>
                </div>

                {/* Revenue Range */}
                <div>
                  <label style={labelStyle}>매출 구간</label>
                  <select
                    value={revenueRange}
                    onChange={(e) => setRevenueRange(e.target.value)}
                    onFocus={() => setFocusedField("revenueRange")}
                    onBlur={() => setFocusedField(null)}
                    style={selectStyle(focusedField === "revenueRange")}
                  >
                    <option value="">선택</option>
                    {REVENUE_RANGES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                {/* Divider */}
                <div style={{ borderTop: `1px solid ${F.border}`, paddingTop: 14 }}>
                  <label style={labelStyle}>비밀번호</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocusedField("password")}
                      onBlur={() => setFocusedField(null)}
                      placeholder="8자 이상"
                      style={{
                        ...inputStyle(focusedField === "password"),
                        paddingRight: 40,
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: "absolute",
                        right: 12,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                        color: F.muted,
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      {showPassword ? (
                        <EyeOff size={14} />
                      ) : (
                        <Eye size={14} />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>비밀번호 확인</label>
                  <input
                    type="password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    onFocus={() => setFocusedField("passwordConfirm")}
                    onBlur={() => setFocusedField(null)}
                    placeholder="비밀번호를 다시 입력해주세요"
                    style={inputStyle(focusedField === "passwordConfirm")}
                  />
                  {passwordConfirm && password !== passwordConfirm && (
                    <p style={{ marginTop: 4, fontSize: 11, color: F.danger }}>
                      비밀번호가 일치하지 않습니다
                    </p>
                  )}
                </div>

                {/* Email opt-in toggle */}
                <div
                  style={{
                    background: F.card,
                    border: `1px solid ${F.border}`,
                    borderRadius: 8,
                    padding: "12px 14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: F.text, margin: 0 }}>
                      이메일 알림 수신
                    </p>
                    <p style={{ fontSize: 11, color: F.muted, margin: 0, marginTop: 2 }}>
                      맞춤 지원사업이 등록되면 이메일로 알려드립니다
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEmailOptIn(!emailOptIn)}
                    style={{
                      position: "relative",
                      width: 44,
                      height: 24,
                      borderRadius: 12,
                      background: emailOptIn ? F.primary : "rgba(255,255,255,0.12)",
                      border: "none",
                      cursor: "pointer",
                      flexShrink: 0,
                      transition: "background 0.2s",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        top: 4,
                        left: emailOptIn ? 24 : 4,
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        background: "#fff",
                        transition: "left 0.2s",
                      }}
                    />
                  </button>
                </div>
              </div>

              {errorBlock}

              <button
                type="submit"
                disabled={loading || !password || !passwordConfirm}
                style={{
                  marginTop: 20,
                  width: "100%",
                  background:
                    loading || !password || !passwordConfirm
                      ? "rgba(45,114,210,0.3)"
                      : F.primary,
                  color: F.text,
                  border: "none",
                  borderRadius: 6,
                  padding: "11px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor:
                    loading || !password || !passwordConfirm
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {loading ? "가입 중..." : "가입하기"}
              </button>
            </form>
          )}

          {/* ─── Step 4: Success ─── */}
          {step === 4 && (
            <div style={{ padding: "32px 0", textAlign: "center" }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "rgba(35,162,109,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px",
                }}
              >
                <CheckCircle2 size={32} color={F.success} />
              </div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: F.text, margin: "0 0 8px" }}>
                가입 완료!
              </h1>
              <p style={{ fontSize: 13, color: F.muted, margin: 0 }}>
                잠시 후 지원사업 목록으로 이동합니다...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
