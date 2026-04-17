"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { validateInviteToken, acceptInvitation } from "@/lib/api";
import { FOUNDRY } from "@/lib/theme";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "valid" | "error">("loading");
  const [error, setError] = useState("");
  const [inviteInfo, setInviteInfo] = useState<{ email: string } | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!token) return;
    validateInviteToken(token)
      .then((info) => {
        setInviteInfo(info);
        setStatus("valid");
      })
      .catch((err) => {
        setError(err.message);
        setStatus("error");
      });
  }, [token]);

  async function handleAccept() {
    if (!token) return;
    setAccepting(true);
    try {
      await acceptInvitation(token);
      // Check if user is logged in
      const existingToken = localStorage.getItem("govgrants_token");
      if (existingToken) {
        router.push("/onboarding");
      } else {
        // Redirect to signup with invite context
        router.push(`/signup?invite=${token}&email=${encodeURIComponent(inviteInfo?.email || "")}`);
      }
    } catch (err: any) {
      if (err.message.includes("회원가입")) {
        router.push(`/signup?invite=${token}&email=${encodeURIComponent(inviteInfo?.email || "")}`);
      } else {
        setError(err.message);
        setStatus("error");
      }
    } finally {
      setAccepting(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: FOUNDRY.bg, padding: 24,
    }}>
      <div style={{
        width: "100%", maxWidth: 420, background: FOUNDRY.card,
        border: `1px solid ${FOUNDRY.border}`, borderRadius: 16, padding: "36px 28px",
        textAlign: "center",
      }}>
        {status === "loading" && (
          <>
            <h1 style={{ fontSize: 18, color: FOUNDRY.text, margin: "0 0 8px" }}>초대 확인 중...</h1>
            <p style={{ fontSize: 13, color: FOUNDRY.muted }}>잠시만 기다려주세요.</p>
          </>
        )}

        {status === "valid" && inviteInfo && (
          <>
            <div style={{
              width: 56, height: 56, borderRadius: "50%", margin: "0 auto 16px",
              background: FOUNDRY.primary + "20", color: FOUNDRY.primary,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24,
            }}>
              ✉
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: FOUNDRY.text, margin: "0 0 8px" }}>
              단비에 초대되었습니다
            </h1>
            <p style={{ fontSize: 14, color: FOUNDRY.muted, margin: "0 0 24px" }}>
              맞춤 정부지원사업을 탐색할 수 있습니다.
            </p>
            <button
              onClick={handleAccept}
              disabled={accepting}
              style={{
                width: "100%", padding: "13px 24px", background: FOUNDRY.primary,
                color: "white", border: "none", borderRadius: 10, fontSize: 15,
                fontWeight: 600, cursor: "pointer", opacity: accepting ? 0.6 : 1,
              }}
            >
              {accepting ? "처리 중..." : "시작하기"}
            </button>
          </>
        )}

        {status === "error" && (
          <>
            <h1 style={{ fontSize: 18, color: FOUNDRY.danger, margin: "0 0 8px" }}>초대 오류</h1>
            <p style={{ fontSize: 14, color: FOUNDRY.muted, margin: "0 0 20px" }}>{error}</p>
            <button
              onClick={() => router.push("/")}
              style={{
                padding: "10px 24px", background: FOUNDRY.card, color: FOUNDRY.text,
                border: `1px solid ${FOUNDRY.border}`, borderRadius: 8, fontSize: 13, cursor: "pointer",
              }}
            >
              홈으로 돌아가기
            </button>
          </>
        )}
      </div>
    </div>
  );
}
