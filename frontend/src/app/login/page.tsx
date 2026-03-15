"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { login } from "@/lib/api";
import Link from "next/link";

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

export default function LoginPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setLoading(true);
    setError("");

    try {
      const { token } = await login(email.trim(), password);
      localStorage.setItem("govgrants_token", token);
      await refreshUser();
      router.push("/grants");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "로그인 중 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        height: "calc(100vh - 40px)",
        background: F.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 16px",
      }}
    >
      <div
        style={{
          width: 400,
          background: F.panel,
          border: `1px solid ${F.border}`,
          borderRadius: 12,
          padding: 40,
        }}
      >
        {/* Header */}
        <div>
          <div
            style={{
              width: 36,
              height: 36,
              background: F.primary,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>G</span>
          </div>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: F.text,
              marginTop: 16,
              marginBottom: 0,
            }}
          >
            로그인
          </h1>
          <p
            style={{
              fontSize: 12,
              color: F.muted,
              marginTop: 4,
              marginBottom: 0,
            }}
          >
            맞춤형 지원사업 알림과 관심 사업 관리를 이용하세요
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} style={{ marginTop: 28 }}>
          {/* Email */}
          <div style={{ marginBottom: 16 }}>
            <label
              htmlFor="email"
              style={{
                display: "block",
                fontSize: 11,
                color: F.muted,
                fontWeight: 500,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              이메일
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              required
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
              style={{
                width: "100%",
                background: F.card,
                border: `1px solid ${emailFocused ? F.primary : F.border}`,
                borderRadius: 6,
                padding: "10px 12px",
                fontSize: 13,
                color: F.text,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 20 }}>
            <label
              htmlFor="password"
              style={{
                display: "block",
                fontSize: 11,
                color: F.muted,
                fontWeight: 500,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호 입력"
              required
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              style={{
                width: "100%",
                background: F.card,
                border: `1px solid ${passwordFocused ? F.primary : F.border}`,
                borderRadius: 6,
                padding: "10px 12px",
                fontSize: 13,
                color: F.text,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              background: F.primary,
              color: F.text,
              border: "none",
              borderRadius: 6,
              padding: "11px",
              fontSize: 13,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.5 : 1,
            }}
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        {/* Error */}
        {error && (
          <div
            style={{
              marginTop: 16,
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
        )}

        {/* Signup link */}
        <p
          style={{
            fontSize: 12,
            color: F.muted,
            textAlign: "center",
            marginTop: 20,
            marginBottom: 0,
          }}
        >
          계정이 없으신가요?{" "}
          <Link
            href="/signup"
            style={{ color: F.primary, textDecoration: "none" }}
          >
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}
