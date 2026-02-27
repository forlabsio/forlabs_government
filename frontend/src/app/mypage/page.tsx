"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import Link from "next/link";
import {
  User,
  Building2,
  LogOut,
  Save,
  CheckCircle2,
} from "lucide-react";

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
  emailNotification: boolean;
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
      // Save to localStorage as fallback
      localStorage.setItem("govgrants_profile", JSON.stringify(profile));

      // Save to server if token available
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
    <div className="min-h-[calc(100vh-64px)] bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Left Sidebar */}
          <aside className="w-full lg:w-72">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              {/* Avatar */}
              <div className="mb-4 flex flex-col items-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 text-2xl font-bold text-blue-600">
                  {user?.email?.charAt(0).toUpperCase() || "U"}
                </div>
                <p className="mt-3 text-sm font-medium text-gray-900">
                  {user?.name || user?.email || "사용자"}
                </p>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>

              <hr className="my-4 border-gray-100" />

              {/* Navigation */}
              <nav className="flex flex-col gap-1">
                <Link
                  href="/mypage"
                  className="flex items-center gap-3 rounded-xl bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700"
                >
                  <Building2 className="h-4 w-4" />
                  기업 정보
                </Link>
                <button
                  onClick={signOut}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
                >
                  <LogOut className="h-4 w-4" />
                  로그아웃
                </button>
              </nav>
            </div>
          </aside>

          {/* Right Content */}
          <div className="flex-1">
            <div className="rounded-2xl bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-6">
                <h1 className="text-xl font-bold text-gray-900">기업 정보</h1>
                <p className="mt-1 text-sm text-gray-500">
                  기업 정보를 등록하면 맞춤형 지원사업을 추천받을 수 있습니다.
                </p>
              </div>

              <form onSubmit={handleSave} className="space-y-6">
                {/* Company Name */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    기업명
                  </label>
                  <input
                    type="text"
                    value={profile.companyName}
                    onChange={(e) => updateField("companyName", e.target.value)}
                    placeholder="주식회사 예시"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                {/* Industry + Years */}
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      업종
                    </label>
                    <select
                      value={profile.industry}
                      onChange={(e) => updateField("industry", e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="">선택하세요</option>
                      {INDUSTRIES.map((ind) => (
                        <option key={ind} value={ind}>
                          {ind}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      업력
                    </label>
                    <input
                      type="text"
                      value={profile.yearsInBusiness}
                      onChange={(e) =>
                        updateField("yearsInBusiness", e.target.value)
                      }
                      placeholder="예: 3년"
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>

                {/* Region + Employee Count */}
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      소재지
                    </label>
                    <select
                      value={profile.region}
                      onChange={(e) => updateField("region", e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="">선택하세요</option>
                      {REGIONS.map((reg) => (
                        <option key={reg} value={reg}>
                          {reg}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      직원수
                    </label>
                    <input
                      type="text"
                      value={profile.employeeCount}
                      onChange={(e) =>
                        updateField("employeeCount", e.target.value)
                      }
                      placeholder="예: 15명"
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>

                {/* Revenue Range */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    매출 구간
                  </label>
                  <select
                    value={profile.revenueRange}
                    onChange={(e) =>
                      updateField("revenueRange", e.target.value)
                    }
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">선택하세요</option>
                    {REVENUE_RANGES.map((rev) => (
                      <option key={rev} value={rev}>
                        {rev}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Email Notification Toggle */}
                <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      이메일 알림 수신
                    </p>
                    <p className="text-xs text-gray-500">
                      맞춤 지원사업이 등록되면 이메일로 알려드립니다
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updateField(
                        "emailNotification",
                        !profile.emailNotification
                      )
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
                      profile.emailNotification ? "bg-blue-600" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow-sm transition-transform ${
                        profile.emailNotification
                          ? "translate-x-5"
                          : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>

                {/* Save Button */}
                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? (
                      <>저장 중...</>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        저장하기
                      </>
                    )}
                  </button>
                  {saved && (
                    <span className="flex items-center gap-1 text-sm text-emerald-600">
                      <CheckCircle2 className="h-4 w-4" />
                      저장되었습니다
                    </span>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
