"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import {
  fetchClients, createInvitation, fetchCalendarActivities,
  type ClientSummary, type ClientActivityItem,
} from "@/lib/api";
import { FOUNDRY } from "@/lib/theme";
import {
  Users, UserPlus, Building2, ChevronRight, Search,
  Phone, Mail, Calendar, MapPin, Filter, X, Clock,
} from "lucide-react";

/* ── Helpers ───────────────────────────────────────────────── */

function relTime(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "방금";
  if (mins < 60) return `${mins}분 전`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}시간 전`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}일 전`;
  return new Date(d).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

type StatusFilter = "all" | "active" | "pending";

/* ── Component ─────────────────────────────────────────────── */

export default function ClientsPage() {
  const { user } = useAuth();
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [activities, setActivities] = useState<ClientActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");
  const [showInvite, setShowInvite] = useState(false);

  const token = typeof window !== "undefined" ? localStorage.getItem("govgrants_token") : null;

  useEffect(() => {
    if (!token) return;
    Promise.all([fetchClients(token), fetchCalendarActivities(token)])
      .then(([c, a]) => { setClients(c); setActivities(a); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  // Last activity per client
  const lastActivity = useMemo(() => {
    const map: Record<string, ClientActivityItem> = {};
    activities.forEach(a => {
      const date = a.scheduled_at || a.created_at || "";
      if (!map[a.client_user_id] || date > (map[a.client_user_id].scheduled_at || map[a.client_user_id].created_at || "")) {
        map[a.client_user_id] = a;
      }
    });
    return map;
  }, [activities]);

  // Next upcoming per client
  const nextAction = useMemo(() => {
    const map: Record<string, ClientActivityItem> = {};
    const now = new Date();
    activities
      .filter(a => a.scheduled_at && !a.completed_at && new Date(a.scheduled_at) >= now)
      .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())
      .forEach(a => {
        if (!map[a.client_user_id]) map[a.client_user_id] = a;
      });
    return map;
  }, [activities]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !inviteEmail.trim()) return;
    setInviting(true); setInviteMsg("");
    try {
      await createInvitation(token, inviteEmail.trim());
      setInviteMsg("초대 이메일이 발송되었습니다!");
      setInviteEmail("");
      const updated = await fetchClients(token);
      setClients(updated);
      setTimeout(() => setInviteMsg(""), 3000);
    } catch (err: any) {
      setInviteMsg(err.message || "초대에 실패했습니다.");
    } finally {
      setInviting(false);
    }
  }

  if (user?.role !== "consultant" && !user?.is_admin) {
    return <div style={{ padding: 40, textAlign: "center", color: FOUNDRY.muted }}>컨설턴트만 접근할 수 있는 페이지입니다.</div>;
  }

  const filtered = clients.filter(c => {
    // Status filter
    if (statusFilter === "active" && !c.onboarding_completed) return false;
    if (statusFilter === "pending" && c.onboarding_completed) return false;

    // Search
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.name?.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) ||
      c.company_name?.toLowerCase().includes(q) || c.industry?.toLowerCase().includes(q));
  });

  const activeCount = clients.filter(c => c.onboarding_completed).length;
  const pendingCount = clients.filter(c => !c.onboarding_completed).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* ── 44px Header ────────────────────────────────────── */}
      <div style={{
        height: 44, padding: "0 16px", display: "flex", alignItems: "center", gap: 8,
        borderBottom: `1px solid ${FOUNDRY.border}`, background: FOUNDRY.sidebar, flexShrink: 0,
      }}>
        <Users className="w-4 h-4" style={{ color: FOUNDRY.primary }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: FOUNDRY.text }}>내 고객</span>
        <span style={{ fontSize: 11, color: FOUNDRY.muted }}>{clients.length}명</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button onClick={() => setShowInvite(!showInvite)} style={{
            display: "flex", alignItems: "center", gap: 4, padding: "5px 12px",
            background: showInvite ? FOUNDRY.card : FOUNDRY.primary,
            color: showInvite ? FOUNDRY.muted : "white",
            border: "none", borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: "pointer",
          }}>
            {showInvite ? <X size={12} /> : <UserPlus size={12} />}
            {showInvite ? "닫기" : "고객 초대"}
          </button>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        {/* Invite form */}
        {showInvite && (
          <form onSubmit={handleInvite} style={{
            display: "flex", gap: 8, marginBottom: 16, padding: 14,
            background: FOUNDRY.card, border: `1px solid ${FOUNDRY.primary}30`, borderRadius: 10,
            alignItems: "center",
          }}>
            <Mail size={14} color={FOUNDRY.muted} />
            <input
              type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
              placeholder="고객 이메일 주소를 입력하세요"
              autoFocus
              style={{
                flex: 1, padding: "8px 12px", background: FOUNDRY.bg, color: FOUNDRY.text,
                border: `1px solid ${FOUNDRY.border}`, borderRadius: 6, fontSize: 13, outline: "none",
              }}
            />
            <button type="submit" disabled={inviting} style={{
              padding: "8px 18px", background: FOUNDRY.primary, color: "white",
              border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
              opacity: inviting ? 0.6 : 1,
            }}>
              {inviting ? "발송 중..." : "초대 보내기"}
            </button>
          </form>
        )}

        {inviteMsg && (
          <div style={{
            padding: "8px 14px", marginBottom: 14, borderRadius: 6, fontSize: 12,
            background: inviteMsg.includes("실패") ? FOUNDRY.danger + "15" : FOUNDRY.success + "15",
            color: inviteMsg.includes("실패") ? FOUNDRY.danger : FOUNDRY.success,
          }}>
            {inviteMsg}
          </div>
        )}

        {/* Search + Filters */}
        {clients.length > 0 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
            <div style={{
              flex: 1, display: "flex", alignItems: "center", gap: 8,
              padding: "8px 12px", background: FOUNDRY.card,
              border: `1px solid ${FOUNDRY.border}`, borderRadius: 7,
            }}>
              <Search size={14} color={FOUNDRY.muted} />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="이름, 이메일, 회사명으로 검색..."
                style={{
                  flex: 1, background: "transparent", color: FOUNDRY.text,
                  border: "none", fontSize: 13, outline: "none",
                }}
              />
              {search && (
                <button onClick={() => setSearch("")} style={{
                  background: "transparent", border: "none", color: FOUNDRY.muted, cursor: "pointer", padding: 2,
                }}>
                  <X size={12} />
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: 2 }}>
              {([
                { key: "all" as StatusFilter, label: "전체", count: clients.length },
                { key: "active" as StatusFilter, label: "활성", count: activeCount },
                { key: "pending" as StatusFilter, label: "대기", count: pendingCount },
              ]).map(f => (
                <button key={f.key} onClick={() => setStatusFilter(f.key)} style={{
                  padding: "6px 10px", fontSize: 11, cursor: "pointer",
                  background: statusFilter === f.key ? FOUNDRY.primary + "18" : "transparent",
                  color: statusFilter === f.key ? FOUNDRY.primary : FOUNDRY.muted,
                  border: `1px solid ${statusFilter === f.key ? FOUNDRY.primary + "30" : FOUNDRY.border}`,
                  borderRadius: 5, fontWeight: statusFilter === f.key ? 600 : 400,
                }}>
                  {f.label} {f.count}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Client list */}
        {loading ? (
          <div style={{ color: FOUNDRY.muted, fontSize: 13, padding: 40, textAlign: "center" }}>불러오는 중...</div>
        ) : clients.length === 0 ? (
          <div style={{
            padding: "60px 24px", textAlign: "center",
            background: FOUNDRY.card, border: `1px solid ${FOUNDRY.border}`, borderRadius: 10,
          }}>
            <Users size={32} color={FOUNDRY.muted} style={{ marginBottom: 12 }} />
            <p style={{ color: FOUNDRY.text, fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>아직 고객이 없습니다</p>
            <p style={{ color: FOUNDRY.muted, fontSize: 13, margin: "0 0 16px" }}>이메일로 첫 고객을 초대해보세요.</p>
            <button onClick={() => setShowInvite(true)} style={{
              display: "inline-flex", alignItems: "center", gap: 5, padding: "9px 18px",
              background: FOUNDRY.primary, color: "white", border: "none",
              borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}>
              <UserPlus size={13} /> 고객 초대
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {filtered.map(c => {
              const next = nextAction[c.id];
              const last = lastActivity[c.id];
              return (
                <Link key={c.id} href={`/clients/${c.id}`} style={{ textDecoration: "none" }}>
                  <div style={{
                    padding: "14px 16px", background: FOUNDRY.card,
                    border: `1px solid ${FOUNDRY.border}`, borderRadius: 10,
                    display: "flex", alignItems: "center", gap: 14,
                    cursor: "pointer", transition: "border-color 0.15s",
                  }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = FOUNDRY.primary + "40"}
                    onMouseLeave={e => e.currentTarget.style.borderColor = FOUNDRY.border}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                      background: FOUNDRY.primary + "18", color: FOUNDRY.primary,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 15, fontWeight: 700,
                    }}>
                      {(c.name || c.email)[0].toUpperCase()}
                    </div>

                    {/* Main info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: FOUNDRY.text }}>
                          {c.name || c.email.split("@")[0]}
                        </span>
                        <span style={{
                          fontSize: 10, padding: "2px 7px", borderRadius: 4,
                          background: c.onboarding_completed ? FOUNDRY.success + "18" : FOUNDRY.warning + "18",
                          color: c.onboarding_completed ? FOUNDRY.success : FOUNDRY.warning,
                        }}>
                          {c.onboarding_completed ? "활성" : "대기"}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: FOUNDRY.muted }}>
                        {c.company_name && (
                          <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                            <Building2 size={11} />{c.company_name}
                          </span>
                        )}
                        {c.industry && <span>{c.industry}</span>}
                        {c.region && <span>{c.region}</span>}
                      </div>
                    </div>

                    {/* Next action / Last activity */}
                    <div style={{ flexShrink: 0, textAlign: "right", minWidth: 140 }}>
                      {next ? (
                        <div>
                          <p style={{ margin: 0, fontSize: 11, color: FOUNDRY.primary, fontWeight: 500 }}>
                            다음: {next.title}
                          </p>
                          <p style={{ margin: 0, fontSize: 10, color: FOUNDRY.muted }}>
                            {next.scheduled_at && new Date(next.scheduled_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                          </p>
                        </div>
                      ) : last ? (
                        <div>
                          <p style={{ margin: 0, fontSize: 11, color: FOUNDRY.muted }}>
                            마지막: {last.title}
                          </p>
                          <p style={{ margin: 0, fontSize: 10, color: FOUNDRY.muted }}>
                            {(last.scheduled_at || last.created_at) && relTime(last.scheduled_at || last.created_at!)}
                          </p>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: FOUNDRY.muted }}>활동 없음</span>
                      )}
                    </div>

                    {/* Stats */}
                    <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
                      <div style={{ textAlign: "center" }}>
                        <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: c.interest_count > 0 ? FOUNDRY.text : FOUNDRY.muted, fontFamily: "monospace" }}>
                          {c.interest_count}
                        </p>
                        <p style={{ margin: 0, fontSize: 9, color: FOUNDRY.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>관심</p>
                      </div>
                    </div>

                    <ChevronRight size={14} color={FOUNDRY.muted} />
                  </div>
                </Link>
              );
            })}

            {filtered.length === 0 && search && (
              <div style={{ padding: 30, textAlign: "center", color: FOUNDRY.muted, fontSize: 13 }}>
                &ldquo;{search}&rdquo; 검색 결과가 없습니다.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
