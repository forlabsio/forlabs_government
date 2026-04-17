"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { fetchClients, createInvitation, type ClientSummary } from "@/lib/api";
import { FOUNDRY } from "@/lib/theme";
import { Users, UserPlus, Building2, MapPin, ChevronRight, Search } from "lucide-react";

export default function ClientsPage() {
  const { user } = useAuth();
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");

  const token = typeof window !== "undefined" ? localStorage.getItem("govgrants_token") : null;

  useEffect(() => {
    if (!token) return;
    fetchClients(token).then(setClients).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !inviteEmail.trim()) return;
    setInviting(true);
    setInviteMsg("");
    try {
      await createInvitation(token, inviteEmail.trim());
      setInviteMsg("초대 이메일이 발송되었습니다!");
      setInviteEmail("");
      const updated = await fetchClients(token);
      setClients(updated);
    } catch (err: any) {
      setInviteMsg(err.message || "초대에 실패했습니다.");
    } finally {
      setInviting(false);
    }
  }

  if (user?.role !== "consultant" && !user?.is_admin) {
    return <div style={{ padding: 40, textAlign: "center", color: FOUNDRY.muted }}>컨설턴트만 접근할 수 있는 페이지입니다.</div>;
  }

  const filtered = clients.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.name?.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) ||
      c.company_name?.toLowerCase().includes(q) || c.industry?.toLowerCase().includes(q));
  });

  return (
    <div style={{ padding: "24px 32px" }}>
      {/* ── Header + Invite ───────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: FOUNDRY.text, margin: 0 }}>
          내 고객 <span style={{ fontSize: 13, fontWeight: 400, color: FOUNDRY.muted }}>{clients.length}명</span>
        </h1>
        <div style={{ flex: 1 }} />
        <form onSubmit={handleInvite} style={{ display: "flex", gap: 8 }}>
          <input
            type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="이메일로 고객 초대..."
            style={{
              width: 240, padding: "8px 12px", background: FOUNDRY.card, color: FOUNDRY.text,
              border: `1px solid ${FOUNDRY.border}`, borderRadius: 6, fontSize: 13, outline: "none",
            }}
          />
          <button type="submit" disabled={inviting} style={{
            padding: "8px 14px", background: FOUNDRY.primary, color: "white",
            border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
            opacity: inviting ? 0.6 : 1, display: "flex", alignItems: "center", gap: 4,
          }}>
            <UserPlus size={13} /> {inviting ? "발송 중..." : "초대"}
          </button>
        </form>
      </div>

      {inviteMsg && (
        <div style={{
          padding: "8px 14px", marginBottom: 14, borderRadius: 6, fontSize: 12,
          background: inviteMsg.includes("실패") ? FOUNDRY.danger + "15" : FOUNDRY.success + "15",
          color: inviteMsg.includes("실패") ? FOUNDRY.danger : FOUNDRY.success,
        }}>
          {inviteMsg}
        </div>
      )}

      {/* ── Search ────────────────────────────────────────── */}
      {clients.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, marginBottom: 16,
          padding: "8px 12px", background: FOUNDRY.card,
          border: `1px solid ${FOUNDRY.border}`, borderRadius: 6,
        }}>
          <Search size={14} color={FOUNDRY.muted} />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="이름, 이메일, 회사명으로 검색..."
            style={{
              flex: 1, background: "transparent", color: FOUNDRY.text,
              border: "none", fontSize: 13, outline: "none",
            }}
          />
        </div>
      )}

      {/* ── Client table ──────────────────────────────────── */}
      {loading ? (
        <div style={{ color: FOUNDRY.muted, fontSize: 13, padding: 20 }}>불러오는 중...</div>
      ) : clients.length === 0 ? (
        <div style={{
          padding: "60px 24px", textAlign: "center",
          background: FOUNDRY.card, border: `1px solid ${FOUNDRY.border}`, borderRadius: 10,
        }}>
          <Users size={32} color={FOUNDRY.muted} style={{ marginBottom: 12 }} />
          <p style={{ color: FOUNDRY.text, fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>아직 고객이 없습니다</p>
          <p style={{ color: FOUNDRY.muted, fontSize: 13, margin: 0 }}>상단에서 이메일을 입력하여 첫 고객을 초대해보세요.</p>
        </div>
      ) : (
        <>
          {/* Table header */}
          <div style={{
            display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 80px 80px 30px",
            gap: 12, padding: "8px 16px",
            fontSize: 10, color: FOUNDRY.muted, letterSpacing: "0.08em", textTransform: "uppercase",
            borderBottom: `1px solid ${FOUNDRY.border}`,
          }}>
            <span>고객</span><span>회사</span><span>지역/업종</span><span>관심 사업</span><span>상태</span><span />
          </div>

          {filtered.map((c) => (
            <Link key={c.id} href={`/clients/${c.id}`} style={{ textDecoration: "none" }}>
              <div
                style={{
                  display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 80px 80px 30px",
                  gap: 12, padding: "12px 16px", alignItems: "center",
                  borderBottom: `1px solid ${FOUNDRY.border}`,
                  cursor: "pointer", transition: "background 0.1s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = FOUNDRY.card)}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {/* Name + email */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                    background: FOUNDRY.primary + "18", color: FOUNDRY.primary,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 700,
                  }}>
                    {(c.name || c.email)[0].toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: FOUNDRY.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.name || c.email.split("@")[0]}
                    </p>
                    <p style={{ margin: 0, fontSize: 11, color: FOUNDRY.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.email}
                    </p>
                  </div>
                </div>

                {/* Company */}
                <span style={{ fontSize: 13, color: c.company_name ? FOUNDRY.text : FOUNDRY.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.company_name || "—"}
                </span>

                {/* Region / Industry */}
                <span style={{ fontSize: 12, color: FOUNDRY.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {[c.region, c.industry].filter(Boolean).join(" · ") || "—"}
                </span>

                {/* Interest count */}
                <span style={{ fontSize: 14, fontWeight: 600, fontFamily: "monospace", color: c.interest_count > 0 ? FOUNDRY.text : FOUNDRY.muted }}>
                  {c.interest_count}
                </span>

                {/* Status */}
                <span style={{
                  fontSize: 10, padding: "3px 8px", borderRadius: 4, textAlign: "center",
                  background: c.onboarding_completed ? FOUNDRY.success + "18" : FOUNDRY.warning + "18",
                  color: c.onboarding_completed ? FOUNDRY.success : FOUNDRY.warning,
                }}>
                  {c.onboarding_completed ? "활성" : "대기"}
                </span>

                <ChevronRight size={14} color={FOUNDRY.muted} />
              </div>
            </Link>
          ))}

          {filtered.length === 0 && search && (
            <div style={{ padding: 30, textAlign: "center", color: FOUNDRY.muted, fontSize: 13 }}>
              "{search}" 검색 결과가 없습니다.
            </div>
          )}
        </>
      )}
    </div>
  );
}
