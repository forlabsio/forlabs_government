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

export default function SignupPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 1
  const [email, setEmail] = useState("");

  // Step 2
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(0);

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
      setCountdown(600); // 10 minutes
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

  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-md">
        {/* Progress bar */}
        <div className="mb-8 flex justify-center gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 w-16 rounded-full transition-colors ${
                step >= s ? "bg-blue-600" : "bg-gray-200"
              }`}
            />
          ))}
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-sm">
          {/* ─── Step 1: Email ─── */}
          {step === 1 && (
            <div>
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                  <Mail className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900">
                    회원가입
                  </h1>
                  <p className="text-sm text-gray-500">
                    이메일 주소를 입력해주세요
                  </p>
                </div>
              </div>

              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                이메일
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendCode()}
                placeholder="example@company.com"
                className="mb-4 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                autoFocus
              />

              {error && (
                <p className="mb-4 text-sm text-red-500">{error}</p>
              )}

              <button
                type="button"
                onClick={handleSendCode}
                disabled={loading || !email.trim()}
                className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-gray-300"
              >
                {loading ? "발송 중..." : "인증코드 발송"}
              </button>

              <p className="mt-6 text-center text-sm text-gray-500">
                이미 계정이 있으신가요?{" "}
                <Link
                  href="/login"
                  className="font-medium text-blue-600 hover:text-blue-700"
                >
                  로그인
                </Link>
              </p>
            </div>
          )}

          {/* ─── Step 2: Verify Code ─── */}
          {step === 2 && (
            <div>
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                  <KeyRound className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900">
                    이메일 인증
                  </h1>
                  <p className="text-sm text-gray-500">
                    <span className="font-medium text-gray-700">{email}</span>
                    으로 발송된 인증코드를 입력해주세요
                  </p>
                </div>
              </div>

              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                인증코드 6자리
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                onKeyDown={(e) => e.key === "Enter" && handleVerifyCode()}
                placeholder="000000"
                maxLength={6}
                className="mb-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                autoFocus
              />

              <div className="mb-4 flex items-center justify-between text-sm">
                <span className="text-gray-400">
                  {countdown > 0
                    ? `남은 시간: ${formatCountdown(countdown)}`
                    : "인증코드가 만료되었습니다"}
                </span>
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={loading}
                  className="text-blue-600 hover:text-blue-700"
                >
                  재발송
                </button>
              </div>

              {error && (
                <p className="mb-4 text-sm text-red-500">{error}</p>
              )}

              <button
                type="button"
                onClick={handleVerifyCode}
                disabled={loading || code.length !== 6 || countdown <= 0}
                className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-gray-300"
              >
                {loading ? "확인 중..." : "확인"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setError("");
                }}
                className="mt-3 w-full py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                이메일 변경
              </button>
            </div>
          )}

          {/* ─── Step 3: Company Info + Password ─── */}
          {step === 3 && (
            <form onSubmit={handleSignup}>
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                  <Building2 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900">
                    기업 정보
                  </h1>
                  <p className="text-sm text-gray-500">
                    맞춤 지원사업 추천을 위해 정보를 입력해주세요
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Company Name */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    기업명
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="기업명을 입력해주세요"
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                {/* Industry + Region */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      업종
                    </label>
                    <select
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">선택</option>
                      {INDUSTRIES.map((i) => (
                        <option key={i} value={i}>
                          {i}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      소재지
                    </label>
                    <select
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">선택</option>
                      {REGIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Company Age + Employee Count */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      업력 (년)
                    </label>
                    <input
                      type="number"
                      value={companyAge}
                      onChange={(e) => setCompanyAge(e.target.value)}
                      placeholder="예: 3"
                      min="0"
                      className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      직원수
                    </label>
                    <input
                      type="number"
                      value={employeeCount}
                      onChange={(e) => setEmployeeCount(e.target.value)}
                      placeholder="예: 10"
                      min="0"
                      className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                {/* Revenue Range */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    매출 구간
                  </label>
                  <select
                    value={revenueRange}
                    onChange={(e) => setRevenueRange(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">선택</option>
                    {REVENUE_RANGES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-100 pt-4">
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    비밀번호
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="8자 이상"
                      className="w-full rounded-xl border border-gray-200 px-4 py-2.5 pr-10 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    비밀번호 확인
                  </label>
                  <input
                    type="password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="비밀번호를 다시 입력해주세요"
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                  {passwordConfirm && password !== passwordConfirm && (
                    <p className="mt-1 text-xs text-red-500">
                      비밀번호가 일치하지 않습니다
                    </p>
                  )}
                </div>

                {/* Email opt-in */}
                <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      이메일 알림 수신
                    </p>
                    <p className="text-xs text-gray-400">
                      맞춤 지원사업이 등록되면 이메일로 알려드립니다
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEmailOptIn(!emailOptIn)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                      emailOptIn ? "bg-blue-600" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                        emailOptIn ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {error && (
                <p className="mt-4 text-sm text-red-500">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !password || !passwordConfirm}
                className="mt-6 w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-gray-300"
              >
                {loading ? "가입 중..." : "가입하기"}
              </button>
            </form>
          )}

          {/* ─── Step 4: Success ─── */}
          {step === 4 && (
            <div className="py-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <h1 className="mb-2 text-xl font-bold text-gray-900">
                가입 완료!
              </h1>
              <p className="text-sm text-gray-500">
                잠시 후 지원사업 목록으로 이동합니다...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
