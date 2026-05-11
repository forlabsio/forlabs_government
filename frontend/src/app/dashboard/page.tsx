"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import {
  fetchDashboardFeed, fetchClients, fetchCalendarActivities,
  createClientActivity, completeActivity,
  type DashboardActivity, type ClientSummary, type ClientActivityItem,
} from "@/lib/api";
import { FOUNDRY } from "@/lib/theme";
import {
  Users, Calendar, Phone, Mail, MapPin, Clock, FileText,
  CheckCircle2, Circle, Plus, ChevronRight, ArrowRight,
  Zap, Target, AlertCircle, X,
} from "lucide-react";

/* ── Constants ─────────────────────────────────────────────── */

const ACT = {
  meeting: { icon: Calendar, color: "#3d8ef7", label: "미팅" },
  call:    { icon: Phone,    color: "#f59e42", label: "전화" },
  email:   { icon: Mail,     color: "#a78bfa", label: "이메일" },
  visit:   { icon: MapPin,   color: "#34d399", label: "방문" },
  note:    { icon: FileText, color: "#7B919E", label: "메모" },
  other:   { icon: Clock,    color: "#7B919E", label: "기타" },
} as const;

const EVENT_DOT: Record<string, string> = {
  client_interest: FOUNDRY.success,
  pipeline_moved: FOUNDRY.primary,
  invite_accepted: "#f97316",
};

/* ── Helpers ───────────────────────────────────────────────── */

function timeStr(d: string) {
  return new Date(d).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

function relDate(d: string) {
  const dt = new Date(d);
  const now = new Date();
  const diff = dt.getTime() - now.getTime();
  const days = Math.ceil(diff / 86400000);
  if (days === 0) return "오늘";
  if (days === 1) return "내일";
  if (days === 2) return "모레";
  if (days > 0 && days <= 7) return `${days}일 후`;
  return dt.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

function isToday(d: string) {
  const dt = new Date(d);
  const now = new Date();
  return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth() && dt.getDate() === now.getDate();
}

/* ── Component ─────────────────────────────────────────────── */

export default function DashboardPage() {
  const { user } = useAuth();
  const [feed, setFeed] = useState<DashboardActivity[]>([]);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [allActs, setAllActs] = useState<ClientActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick add form
  const [quickAdd, setQuickAdd] = useState(false);
  const [qaClient, setQaClient] = useState("");
  const [qaType, setQaType] = useState<keyof typeof ACT>("meeting");
  const [qaTitle, setQaTitle] = useState("");
  const [qaTime, setQaTime] = useState("");

  const token = typeof window !== "undefined" ? localStorage.getItem("govgrants_token") : null;

  useEffect(() => {
    if (!token) return;
    Promise.all([fetchDashboardFeed(token), fetchClients(token), fetchCalendarActivities(token)])
      .then(([f, c, a]) => {
        setFeed(f); setClients(c); setAllActs(a);
        if (c.length) setQaClient(c[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Today's tasks: scheduled today, not completed
  const todayTasks = useMemo(() => {
    return allActs
      .filter(a => a.scheduled_at && isToday(a.scheduled_at) && !a.completed_at)
      .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime());
  }, [allActs]);

  // Completed today
  const completedToday = useMemo(() => {
    return allActs.filter(a => a.completed_at && isToday(a.completed_at));
  }, [allActs]);

  // Overdue: past scheduled, not completed
  const overdue = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return allActs
      .filter(a => a.scheduled_at && !a.completed_at && new Date(a.scheduled_at) < now)
      .sort((a, b) => new Date(b.scheduled_at!).getTime() - new Date(a.scheduled_at!).getTime());
  }, [allActs]);

  // Upcoming (not today, future)
  const upcoming = useMemo(() => {
    const now = new Date();
    return allActs
      .filter(a => a.scheduled_at && !a.completed_at && new Date(a.scheduled_at) > now && !isToday(a.scheduled_at))
      .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())
      .slice(0, 5);
  }, [allActs]);

  // Client map for name lookup
  const cMap = useMemo(() => Object.fromEntries(clients.map(c => [c.id, c])), [clients]);

  async function handleComplete(act: ClientActivityItem) {
    if (!token) return;
    const updated = await completeActivity(token, act.client_user_id, act.id).catch(() => null);
    if (updated) setAllActs(prev => prev.map(a => a.id === act.id ? updated : a));
  }

  async function handleQuickAdd() {
    if (!token || !qaClient || !qaTitle.trim()) return;
    const now = new Date();
    let scheduled: string | undefined;
    if (qaTime) {
      const [h, m] = qaTime.split(":").map(Number);
      now.setHours(h, m, 0, 0);
      scheduled = now.toISOString();
    } else {
      scheduled = now.toISOString();
    }
    const a = await createClientActivity(token, qaClient, {
      activity_type: qaType, title: qaTitle, scheduled_at: scheduled,
    }).catch(() => null);
    if (a) {
      setAllActs(prev => [a, ...prev]);
      setQaTitle(""); setQaTime(""); setQuickAdd(false);
    }
  }

  if (user?.role !== "consultant" && !user?.is_admin) {
    return <div style={{ padding: 40, textAlign: "center", color: FOUNDRY.muted }}>컨설턴트만 접근할 수 있는 페이지입니다.</div>;
  }

  const activeClients = clients.filter(c => c.interest_count > 0).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* ── 44px Header ────────────────────────────────────── */}
      <div style={{
        height: 44, padding: "0 16px", display: "flex", alignItems: "center", gap: 8,
        borderBottom: `1px solid ${FOUNDRY.border}`, background: FOUNDRY.sidebar, flexShrink: 0,
      }}>
        <Target className="w-4 h-4" style={{ color: FOUNDRY.primary }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: FOUNDRY.text }}>오늘의 워크스테이션</span>
        <span style={{ fontSize: 11, color: FOUNDRY.muted, marginLeft: 4 }}>
          {new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button onClick={() => setQuickAdd(!quickAdd)} style={{
            display: "flex", alignItems: "center", gap: 4, padding: "5px 12px",
            background: quickAdd ? FOUNDRY.card : FOUNDRY.primary, color: quickAdd ? FOUNDRY.muted : "white",
            border: "none", borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: "pointer",
          }}>
            {quickAdd ? <X size={12} /> : <Plus size={12} />}
            {quickAdd ? "닫기" : "할 일 추가"}
          </button>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        {loading ? (
          <div style={{ color: FOUNDRY.muted, fontSize: 13, padding: 40, textAlign: "center" }}>불러오는 중...</div>
        ) : (
          <>
            {/* ── Quick Add Form ──────────────────────────── */}
            {quickAdd && (
              <div style={{
                padding: 16, marginBottom: 16, background: FOUNDRY.card,
                border: `1px solid ${FOUNDRY.primary}30`, borderRadius: 10,
              }}>
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  {(["meeting", "call", "email", "visit"] as const).map(t => {
                    const a = ACT[t];
                    const Icon = a.icon;
                    const active = qaType === t;
                    return (
                      <button key={t} onClick={() => setQaType(t)} style={{
                        padding: "5px 12px", borderRadius: 5, fontSize: 11, cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 4,
                        background: active ? a.color + "18" : "transparent",
                        color: active ? a.color : FOUNDRY.muted,
                        border: `1px solid ${active ? a.color + "40" : FOUNDRY.border}`,
                        fontWeight: active ? 600 : 400,
                      }}>
                        <Icon size={12} />{a.label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <select value={qaClient} onChange={e => setQaClient(e.target.value)} style={{
                    width: 160, padding: "8px 10px", fontSize: 12,
                    background: FOUNDRY.bg, color: FOUNDRY.text,
                    border: `1px solid ${FOUNDRY.border}`, borderRadius: 5, outline: "none",
                  }}>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name || c.email.split("@")[0]}
                      </option>
                    ))}
                  </select>
                  <input placeholder="할 일 제목" value={qaTitle}
                    onChange={e => setQaTitle(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleQuickAdd()}
                    autoFocus
                    style={{
                      flex: 1, padding: "8px 12px", fontSize: 13,
                      background: FOUNDRY.bg, color: FOUNDRY.text,
                      border: `1px solid ${FOUNDRY.border}`, borderRadius: 5, outline: "none",
                    }}
                  />
                  <input type="time" value={qaTime} onChange={e => setQaTime(e.target.value)} style={{
                    width: 100, padding: "8px 10px", fontSize: 12,
                    background: FOUNDRY.bg, color: FOUNDRY.text,
                    border: `1px solid ${FOUNDRY.border}`, borderRadius: 5, outline: "none",
                  }} />
                  <button onClick={handleQuickAdd} disabled={!qaTitle.trim()} style={{
                    padding: "8px 20px", background: FOUNDRY.primary, color: "white",
                    border: "none", borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: "pointer",
                    opacity: qaTitle.trim() ? 1 : 0.4,
                  }}>
                    추가
                  </button>
                </div>
              </div>
            )}

            {/* ── Overdue Warning ─────────────────────────── */}
            {overdue.length > 0 && (
              <div style={{
                padding: "10px 14px", marginBottom: 16, borderRadius: 8,
                background: FOUNDRY.danger + "10", border: `1px solid ${FOUNDRY.danger}25`,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <AlertCircle size={14} color={FOUNDRY.danger} />
                <span style={{ fontSize: 12, color: FOUNDRY.danger, fontWeight: 600 }}>
                  {overdue.length}건의 미완료 일정
                </span>
                <span style={{ fontSize: 11, color: FOUNDRY.muted }}>— 아래에서 완료 처리하거나 일정을 조정하세요</span>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
              {/* ══ LEFT: Today's tasks ════════════════════ */}
              <div>
                {/* Overdue tasks */}
                {overdue.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <p style={{ fontSize: 10, color: FOUNDRY.danger, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 8px", fontWeight: 600 }}>
                      지연된 할 일 · {overdue.length}
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {overdue.map(a => {
                        const t = ACT[a.activity_type as keyof typeof ACT] || ACT.other;
                        const Icon = t.icon;
                        const c = cMap[a.client_user_id];
                        return (
                          <div key={a.id} style={{
                            display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                            background: FOUNDRY.card, borderRadius: 8,
                            borderLeft: `3px solid ${FOUNDRY.danger}`,
                          }}>
                            <button onClick={() => handleComplete(a)} style={{
                              width: 20, height: 20, borderRadius: "50%", cursor: "pointer",
                              background: "transparent", border: `2px solid ${FOUNDRY.danger}40`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              color: FOUNDRY.danger, flexShrink: 0,
                            }}>
                              <Circle size={10} />
                            </button>
                            <Icon size={13} color={t.color} style={{ flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: 13, color: FOUNDRY.text, fontWeight: 500 }}>{a.title}</p>
                              <p style={{ margin: 0, fontSize: 11, color: FOUNDRY.muted }}>
                                {c ? (c.name || c.email.split("@")[0]) : ""} · {a.scheduled_at && new Date(a.scheduled_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Today's tasks */}
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 10, color: FOUNDRY.primary, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 8px", fontWeight: 600 }}>
                    오늘 할 일 · {todayTasks.length}
                  </p>

                  {todayTasks.length === 0 && completedToday.length === 0 ? (
                    <div style={{
                      padding: "40px 24px", textAlign: "center",
                      background: FOUNDRY.card, border: `1px solid ${FOUNDRY.border}`, borderRadius: 10,
                    }}>
                      {clients.length === 0 ? (
                        <>
                          <Users size={28} color={FOUNDRY.muted} style={{ marginBottom: 10 }} />
                          <p style={{ color: FOUNDRY.text, fontSize: 14, fontWeight: 600, margin: "0 0 4px" }}>아직 고객이 없습니다</p>
                          <p style={{ color: FOUNDRY.muted, fontSize: 12, margin: "0 0 14px" }}>고객을 초대해서 CRM을 시작하세요.</p>
                          <Link href="/clients" style={{
                            display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 16px",
                            background: FOUNDRY.primary, color: "white", borderRadius: 6,
                            fontSize: 12, fontWeight: 600, textDecoration: "none",
                          }}>
                            <Plus size={12} /> 고객 초대
                          </Link>
                        </>
                      ) : (
                        <>
                          <Zap size={28} color={FOUNDRY.primary} style={{ marginBottom: 10, opacity: 0.5 }} />
                          <p style={{ color: FOUNDRY.text, fontSize: 14, fontWeight: 600, margin: "0 0 4px" }}>오늘 예정된 일이 없습니다</p>
                          <p style={{ color: FOUNDRY.muted, fontSize: 12, margin: "0 0 14px" }}>새로운 할 일을 추가하거나, 다가오는 일정을 확인하세요.</p>
                          <button onClick={() => setQuickAdd(true)} style={{
                            display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 16px",
                            background: FOUNDRY.primary, color: "white", borderRadius: 6, border: "none",
                            fontSize: 12, fontWeight: 600, cursor: "pointer",
                          }}>
                            <Plus size={12} /> 할 일 추가
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {todayTasks.map(a => {
                        const t = ACT[a.activity_type as keyof typeof ACT] || ACT.other;
                        const Icon = t.icon;
                        const c = cMap[a.client_user_id];
                        return (
                          <div key={a.id} style={{
                            display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                            background: FOUNDRY.card, borderRadius: 8,
                            borderLeft: `3px solid ${t.color}`,
                          }}>
                            <button onClick={() => handleComplete(a)} title="완료" style={{
                              width: 20, height: 20, borderRadius: "50%", cursor: "pointer",
                              background: "transparent", border: `2px solid ${FOUNDRY.border}`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              color: FOUNDRY.muted, flexShrink: 0,
                              transition: "border-color 0.15s, color 0.15s",
                            }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = FOUNDRY.success; e.currentTarget.style.color = FOUNDRY.success; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = FOUNDRY.border; e.currentTarget.style.color = FOUNDRY.muted; }}
                            >
                              <Circle size={10} />
                            </button>
                            <Icon size={13} color={t.color} style={{ flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: 13, color: FOUNDRY.text, fontWeight: 500 }}>{a.title}</p>
                              {c && (
                                <Link href={`/clients/${c.id}`} style={{ fontSize: 11, color: FOUNDRY.muted, textDecoration: "none" }}>
                                  {c.name || c.email.split("@")[0]}{c.company_name ? ` · ${c.company_name}` : ""}
                                </Link>
                              )}
                            </div>
                            <span style={{ fontSize: 11, color: FOUNDRY.muted, fontFamily: "monospace", flexShrink: 0 }}>
                              {a.scheduled_at && timeStr(a.scheduled_at)}
                            </span>
                          </div>
                        );
                      })}

                      {/* Completed today */}
                      {completedToday.length > 0 && (
                        <>
                          <p style={{ fontSize: 10, color: FOUNDRY.success, letterSpacing: "0.1em", textTransform: "uppercase", margin: "16px 0 6px", fontWeight: 600, opacity: 0.7 }}>
                            완료 · {completedToday.length}
                          </p>
                          {completedToday.map(a => {
                            const t = ACT[a.activity_type as keyof typeof ACT] || ACT.other;
                            const Icon = t.icon;
                            const c = cMap[a.client_user_id];
                            return (
                              <div key={a.id} style={{
                                display: "flex", alignItems: "center", gap: 10, padding: "8px 14px",
                                borderRadius: 8, opacity: 0.45,
                              }}>
                                <CheckCircle2 size={16} color={FOUNDRY.success} style={{ flexShrink: 0 }} />
                                <Icon size={12} color={t.color} style={{ flexShrink: 0 }} />
                                <span style={{ fontSize: 12, color: FOUNDRY.text, textDecoration: "line-through", flex: 1 }}>{a.title}</span>
                                {c && <span style={{ fontSize: 10, color: FOUNDRY.muted }}>{c.name || c.email.split("@")[0]}</span>}
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* ── Recent Activity Feed ────────────────── */}
                <div>
                  <p style={{ fontSize: 10, color: FOUNDRY.muted, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 8px", fontWeight: 600 }}>
                    최근 활동
                  </p>
                  {feed.length === 0 ? (
                    <p style={{ color: FOUNDRY.muted, fontSize: 12, padding: "12px 0" }}>아직 활동이 없습니다.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      {feed.slice(0, 8).map(item => (
                        <div key={item.id} style={{
                          padding: "8px 12px", display: "flex", alignItems: "center", gap: 8,
                          borderRadius: 6,
                        }}>
                          <div style={{
                            width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                            background: EVENT_DOT[item.type] || FOUNDRY.muted,
                          }} />
                          <span style={{ flex: 1, fontSize: 12, color: FOUNDRY.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.title}
                          </span>
                          <span style={{ fontSize: 10, color: FOUNDRY.muted, flexShrink: 0 }}>
                            {item.created_at && new Date(item.created_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ══ RIGHT: Sidebar ═════════════════════════ */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Quick Stats - compact */}
                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
                }}>
                  {[
                    { label: "고객", value: clients.length, color: FOUNDRY.text, href: "/clients" },
                    { label: "활성", value: activeClients, color: FOUNDRY.primary, href: "/clients" },
                    { label: "오늘", value: todayTasks.length, color: FOUNDRY.success },
                    { label: "지연", value: overdue.length, color: overdue.length > 0 ? FOUNDRY.danger : FOUNDRY.muted },
                  ].map(s => (
                    <div key={s.label} style={{
                      padding: "12px 14px", background: FOUNDRY.card,
                      border: `1px solid ${FOUNDRY.border}`, borderRadius: 8,
                      cursor: s.href ? "pointer" : "default",
                    }}>
                      <p style={{ fontSize: 10, color: FOUNDRY.muted, margin: "0 0 4px", letterSpacing: "0.05em", textTransform: "uppercase" }}>{s.label}</p>
                      <p style={{ fontSize: 22, fontWeight: 700, color: s.color, margin: 0, fontFamily: "monospace" }}>{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Upcoming schedule */}
                <div style={{
                  background: FOUNDRY.card, border: `1px solid ${FOUNDRY.border}`, borderRadius: 10, padding: 16,
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <p style={{ margin: 0, fontSize: 10, color: FOUNDRY.muted, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>다가오는 일정</p>
                    <Link href="/calendar" style={{ fontSize: 11, color: FOUNDRY.primary, textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}>
                      전체 <ArrowRight size={11} />
                    </Link>
                  </div>
                  {upcoming.length === 0 ? (
                    <p style={{ color: FOUNDRY.muted, fontSize: 12, margin: 0 }}>예정된 일정이 없습니다.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {upcoming.map(a => {
                        const t = ACT[a.activity_type as keyof typeof ACT] || ACT.other;
                        const Icon = t.icon;
                        const c = cMap[a.client_user_id];
                        return (
                          <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <Icon size={12} color={t.color} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: 12, color: FOUNDRY.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</p>
                              {c && <p style={{ margin: 0, fontSize: 10, color: FOUNDRY.muted }}>{c.name || c.email.split("@")[0]}</p>}
                            </div>
                            <span style={{ fontSize: 10, color: FOUNDRY.primary, flexShrink: 0, fontWeight: 500 }}>
                              {a.scheduled_at && relDate(a.scheduled_at)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Quick Navigation */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {[
                    { href: "/clients", icon: Users, label: "내 고객", desc: `${clients.length}명 관리 중` },
                    { href: "/calendar", icon: Calendar, label: "캘린더", desc: "일정 관리" },
                    { href: "/matching", icon: Zap, label: "자동 매칭", desc: "지원사업 탐색" },
                  ].map(nav => (
                    <Link key={nav.href} href={nav.href} style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                      background: FOUNDRY.card, border: `1px solid ${FOUNDRY.border}`, borderRadius: 8,
                      textDecoration: "none", transition: "border-color 0.15s",
                    }}>
                      <nav.icon size={14} color={FOUNDRY.primary} />
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: FOUNDRY.text }}>{nav.label}</p>
                        <p style={{ margin: 0, fontSize: 10, color: FOUNDRY.muted }}>{nav.desc}</p>
                      </div>
                      <ChevronRight size={12} color={FOUNDRY.muted} />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
