"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import {
  fetchClientDetail, fetchClientInterests, fetchClientNotes,
  fetchClientActivities, createNote, createClientActivity,
  completeActivity, transitionPipeline, updateClient,
  type ClientDetail, type ClientInterest, type ConsultingNote,
  type ClientActivityItem,
} from "@/lib/api";
import { FOUNDRY } from "@/lib/theme";
import {
  FileText, ArrowRight, Plus, Calendar, Phone,
  Mail, MapPin, Building2, Check, Clock, Edit3, Save, X,
  Target, CheckCircle2, Circle, ChevronRight, AlertCircle, User,
} from "lucide-react";

/* ── Constants ─────────────────────────────────────────────── */

const STATUS_COLORS: Record<string, string> = {
  "관심": "#00d4ff", "상담": FOUNDRY.primary, "신청": "#f97316", "결과": FOUNDRY.success,
};
const ELIG_COLORS: Record<string, string> = {
  "가능": FOUNDRY.success, "조건부": "#f97316", "불가능": FOUNDRY.muted,
};
const NEXT_STATUS: Record<string, string> = {
  "관심": "상담", "상담": "신청", "신청": "결과",
};

const ACT = {
  meeting: { icon: Calendar, color: "#3d8ef7", label: "미팅" },
  call:    { icon: Phone,    color: "#f59e42", label: "전화" },
  email:   { icon: Mail,     color: "#a78bfa", label: "이메일" },
  visit:   { icon: MapPin,   color: "#34d399", label: "방문" },
  note:    { icon: FileText, color: "#7B919E", label: "메모" },
  other:   { icon: Clock,    color: "#7B919E", label: "기타" },
} as const;

type Tab = "timeline" | "interests" | "info";

/* ── Helpers ───────────────────────────────────────────────── */

function RelativeTime({ date }: { date: string }) {
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return <span>방금</span>;
  if (mins < 60) return <span>{mins}분 전</span>;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return <span>{hrs}시간 전</span>;
  return <span>{d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}</span>;
}

function futureRel(d: string) {
  const dt = new Date(d);
  const now = new Date();
  const diff = dt.getTime() - now.getTime();
  const days = Math.ceil(diff / 86400000);
  if (days === 0) return "오늘";
  if (days === 1) return "내일";
  if (days <= 7) return `${days}일 후`;
  return dt.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

/* ── Component ─────────────────────────────────────────────── */

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [interests, setInterests] = useState<ClientInterest[]>([]);
  const [notes, setNotes] = useState<ConsultingNote[]>([]);
  const [activities, setActivities] = useState<ClientActivityItem[]>([]);
  const [tab, setTab] = useState<Tab>("timeline");
  const [loading, setLoading] = useState(true);

  // Forms
  const [newNote, setNewNote] = useState("");
  const [actForm, setActForm] = useState({ type: "meeting", title: "", desc: "", date: "" });
  const [showActForm, setShowActForm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, any>>({});

  const token = typeof window !== "undefined" ? localStorage.getItem("govgrants_token") : null;

  useEffect(() => {
    if (!token || !id) return;
    Promise.all([
      fetchClientDetail(token, id),
      fetchClientInterests(token, id),
      fetchClientNotes(token, id),
      fetchClientActivities(token, id),
    ])
      .then(([c, i, n, a]) => { setClient(c); setInterests(i); setNotes(n); setActivities(a); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, id]);

  // Next actions (upcoming, not completed)
  const nextActions = useMemo(() => {
    const now = new Date();
    return activities
      .filter(a => a.scheduled_at && !a.completed_at && new Date(a.scheduled_at) >= now)
      .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime());
  }, [activities]);

  // Overdue
  const overdue = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return activities
      .filter(a => a.scheduled_at && !a.completed_at && new Date(a.scheduled_at) < now);
  }, [activities]);

  // Timeline: merge activities + notes
  const timeline = useMemo(() => [
    ...activities.map(a => ({ ...a, _kind: "activity" as const, _date: a.scheduled_at || a.created_at || "" })),
    ...notes.map(n => ({ ...n, _kind: "note" as const, _date: n.created_at || "" })),
  ].sort((a, b) => new Date(b._date).getTime() - new Date(a._date).getTime()), [activities, notes]);

  async function handleTransition(interestId: string, target: string) {
    if (!token) return;
    try {
      const updated = await transitionPipeline(token, interestId, target);
      setInterests(prev => prev.map(i => i.id === interestId ? updated : i));
    } catch (err: any) { alert(err.message); }
  }

  async function handleAddNote() {
    if (!token || !id || !newNote.trim()) return;
    const note = await createNote(token, id, newNote.trim()).catch(() => null);
    if (note) { setNotes(prev => [note, ...prev]); setNewNote(""); }
  }

  async function handleAddActivity() {
    if (!token || !id || !actForm.title.trim()) return;
    const a = await createClientActivity(token, id, {
      activity_type: actForm.type, title: actForm.title,
      description: actForm.desc || undefined, scheduled_at: actForm.date || undefined,
    }).catch(() => null);
    if (a) {
      setActivities(prev => [a, ...prev]);
      setActForm({ type: "meeting", title: "", desc: "", date: "" });
      setShowActForm(false);
    }
  }

  async function handleComplete(actId: string) {
    if (!token || !id) return;
    const updated = await completeActivity(token, id, actId).catch(() => null);
    if (updated) setActivities(prev => prev.map(a => a.id === actId ? updated : a));
  }

  async function handleSaveClient() {
    if (!token || !id) return;
    const updated = await updateClient(token, id, editForm).catch(() => null);
    if (updated) { setClient(updated); setEditing(false); }
  }

  if (loading) return <div style={{ padding: 40, color: FOUNDRY.muted }}>불러오는 중...</div>;
  if (!client) return <div style={{ padding: 40, color: FOUNDRY.muted }}>고객을 찾을 수 없습니다.</div>;

  const inputStyle = {
    width: "100%", padding: "8px 12px", background: FOUNDRY.bg, color: FOUNDRY.text,
    border: `1px solid ${FOUNDRY.border}`, borderRadius: 6, fontSize: 13, outline: "none",
  } as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* ── 44px Header ────────────────────────────────────── */}
      <div style={{
        height: 44, padding: "0 16px", display: "flex", alignItems: "center", gap: 8,
        borderBottom: `1px solid ${FOUNDRY.border}`, background: FOUNDRY.sidebar, flexShrink: 0,
      }}>
        <Link href="/clients" style={{ fontSize: 12, color: FOUNDRY.muted, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
          내 고객
        </Link>
        <ChevronRight size={11} color={FOUNDRY.muted} />
        <span style={{ fontSize: 13, fontWeight: 600, color: FOUNDRY.text }}>
          {client.name || client.email.split("@")[0]}
        </span>
        <span style={{
          fontSize: 10, padding: "2px 7px", borderRadius: 4, marginLeft: 4,
          background: client.onboarding_completed ? FOUNDRY.success + "18" : FOUNDRY.warning + "18",
          color: client.onboarding_completed ? FOUNDRY.success : FOUNDRY.warning,
        }}>
          {client.onboarding_completed ? "활성" : "온보딩 대기"}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button onClick={() => setShowActForm(!showActForm)} style={{
            display: "flex", alignItems: "center", gap: 4, padding: "5px 12px",
            background: showActForm ? FOUNDRY.card : FOUNDRY.primary,
            color: showActForm ? FOUNDRY.muted : "white",
            border: "none", borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: "pointer",
          }}>
            {showActForm ? <X size={12} /> : <Plus size={12} />}
            {showActForm ? "닫기" : "활동 추가"}
          </button>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        {/* ── Activity Form (collapsible) ──────────────── */}
        {showActForm && (
          <div style={{
            padding: 16, marginBottom: 16, background: FOUNDRY.card,
            border: `1px solid ${FOUNDRY.primary}30`, borderRadius: 10,
          }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              {(["meeting", "call", "email", "visit"] as const).map(t => {
                const a = ACT[t];
                const Icon = a.icon;
                const active = actForm.type === t;
                return (
                  <button key={t} onClick={() => setActForm({ ...actForm, type: t })} style={{
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
              <input style={{ ...inputStyle, flex: 2 }} placeholder="제목" value={actForm.title}
                onChange={e => setActForm({ ...actForm, title: e.target.value })}
                onKeyDown={e => e.key === "Enter" && handleAddActivity()}
                autoFocus />
              <input type="datetime-local" style={{ ...inputStyle, flex: 1 }} value={actForm.date}
                onChange={e => setActForm({ ...actForm, date: e.target.value })} />
              <button onClick={handleAddActivity} disabled={!actForm.title.trim()} style={{
                padding: "8px 20px", background: FOUNDRY.primary, color: "white",
                border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
                opacity: actForm.title.trim() ? 1 : 0.4,
              }}>
                저장
              </button>
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20 }}>
          {/* ══ LEFT: Main content ═════════════════════ */}
          <div>
            {/* ── Next Actions (THE focus) ──────────── */}
            {(nextActions.length > 0 || overdue.length > 0) && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 10, color: FOUNDRY.primary, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 8px", fontWeight: 600 }}>
                  다음 할 일 · {nextActions.length + overdue.length}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {/* Overdue first */}
                  {overdue.map(a => {
                    const t = ACT[a.activity_type as keyof typeof ACT] || ACT.other;
                    const Icon = t.icon;
                    return (
                      <div key={a.id} style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                        background: FOUNDRY.card, borderRadius: 8,
                        borderLeft: `3px solid ${FOUNDRY.danger}`,
                      }}>
                        <button onClick={() => handleComplete(a.id)} style={{
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
                          {a.description && <p style={{ margin: 0, fontSize: 11, color: FOUNDRY.muted }}>{a.description}</p>}
                        </div>
                        <span style={{ fontSize: 10, color: FOUNDRY.danger, flexShrink: 0, fontWeight: 500 }}>
                          지연
                        </span>
                      </div>
                    );
                  })}

                  {/* Upcoming */}
                  {nextActions.map(a => {
                    const t = ACT[a.activity_type as keyof typeof ACT] || ACT.other;
                    const Icon = t.icon;
                    return (
                      <div key={a.id} style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                        background: FOUNDRY.card, borderRadius: 8,
                        borderLeft: `3px solid ${t.color}`,
                      }}>
                        <button onClick={() => handleComplete(a.id)} title="완료" style={{
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
                          {a.description && <p style={{ margin: 0, fontSize: 11, color: FOUNDRY.muted }}>{a.description}</p>}
                        </div>
                        <span style={{ fontSize: 10, color: FOUNDRY.primary, flexShrink: 0, fontWeight: 500 }}>
                          {a.scheduled_at && futureRel(a.scheduled_at)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Quick Note Input ─────────────────────── */}
            <div style={{
              display: "flex", gap: 8, marginBottom: 20, padding: "10px 14px",
              background: FOUNDRY.card, border: `1px solid ${FOUNDRY.border}`, borderRadius: 8,
            }}>
              <FileText size={14} color={FOUNDRY.muted} style={{ marginTop: 2, flexShrink: 0 }} />
              <input value={newNote} onChange={e => setNewNote(e.target.value)}
                placeholder="빠른 메모 추가... (Enter로 저장)"
                onKeyDown={e => e.key === "Enter" && handleAddNote()}
                style={{
                  flex: 1, background: "transparent", color: FOUNDRY.text,
                  border: "none", fontSize: 13, outline: "none",
                }}
              />
              {newNote && (
                <button onClick={handleAddNote} style={{
                  padding: "4px 12px", background: FOUNDRY.primary, color: "white",
                  border: "none", borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: "pointer",
                }}>
                  저장
                </button>
              )}
            </div>

            {/* ── Tabs ─────────────────────────────────── */}
            <div style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: `1px solid ${FOUNDRY.border}` }}>
              {([
                { key: "timeline" as Tab, label: "타임라인", count: timeline.length },
                { key: "interests" as Tab, label: "파이프라인", count: interests.length },
                { key: "info" as Tab, label: "고객 정보" },
              ]).map(t => (
                <button key={t.key} onClick={() => setTab(t.key)} style={{
                  padding: "9px 16px", fontSize: 12, fontWeight: tab === t.key ? 600 : 400,
                  color: tab === t.key ? FOUNDRY.text : FOUNDRY.muted,
                  background: "transparent", border: "none", cursor: "pointer",
                  borderBottom: tab === t.key ? `2px solid ${FOUNDRY.primary}` : "2px solid transparent",
                  marginBottom: -1,
                }}>
                  {t.label}{"count" in t ? ` ${t.count}` : ""}
                </button>
              ))}
            </div>

            {/* ── Timeline tab ─────────────────────────── */}
            {tab === "timeline" && (
              <div>
                {timeline.length === 0 ? (
                  <div style={{ padding: 40, textAlign: "center", color: FOUNDRY.muted, fontSize: 13 }}>
                    활동이나 메모를 추가하면 타임라인에 표시됩니다.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {timeline.map(item => {
                      if (item._kind === "activity") {
                        const a = item as ClientActivityItem & { _kind: "activity"; _date: string };
                        const t = ACT[a.activity_type as keyof typeof ACT] || ACT.other;
                        const Icon = t.icon;
                        const done = !!a.completed_at;
                        return (
                          <div key={`a-${a.id}`} style={{
                            display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px",
                            borderRadius: 7, opacity: done ? 0.5 : 1,
                            background: done ? "transparent" : FOUNDRY.card,
                          }}>
                            {done ? (
                              <CheckCircle2 size={14} color={FOUNDRY.success} style={{ flexShrink: 0, marginTop: 1 }} />
                            ) : (
                              <button onClick={() => handleComplete(a.id)} style={{
                                width: 18, height: 18, borderRadius: "50%", cursor: "pointer",
                                background: "transparent", border: `2px solid ${FOUNDRY.border}`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                color: FOUNDRY.muted, flexShrink: 0, marginTop: 1,
                              }}>
                                <Circle size={8} />
                              </button>
                            )}
                            <Icon size={12} color={t.color} style={{ flexShrink: 0, marginTop: 2 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{
                                  fontSize: 13, color: FOUNDRY.text, fontWeight: 500,
                                  textDecoration: done ? "line-through" : "none",
                                }}>
                                  {a.title}
                                </span>
                                <span style={{ fontSize: 10, color: t.color, fontWeight: 500 }}>{t.label}</span>
                              </div>
                              {a.description && <p style={{ margin: "2px 0 0", fontSize: 12, color: FOUNDRY.muted }}>{a.description}</p>}
                            </div>
                            <span style={{ fontSize: 10, color: FOUNDRY.muted, flexShrink: 0, marginTop: 2 }}>
                              {a._date && <RelativeTime date={a._date} />}
                            </span>
                          </div>
                        );
                      } else {
                        const n = item as ConsultingNote & { _kind: "note"; _date: string };
                        return (
                          <div key={`n-${n.id}`} style={{
                            display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px",
                            borderRadius: 7,
                          }}>
                            <FileText size={14} color={FOUNDRY.muted} style={{ flexShrink: 0, marginTop: 1 }} />
                            <div style={{ flex: 1 }}>
                              <p style={{ margin: 0, fontSize: 13, color: FOUNDRY.text, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{n.content}</p>
                            </div>
                            <span style={{ fontSize: 10, color: FOUNDRY.muted, flexShrink: 0, marginTop: 2 }}>
                              {n._date && <RelativeTime date={n._date} />}
                            </span>
                          </div>
                        );
                      }
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Interests/Pipeline tab ───────────────── */}
            {tab === "interests" && (
              <div>
                {interests.length === 0 ? (
                  <div style={{ padding: 40, textAlign: "center", color: FOUNDRY.muted, fontSize: 13 }}>
                    아직 관심 사업이 없습니다.
                  </div>
                ) : (
                  <>
                    {/* Pipeline summary bar */}
                    <div style={{
                      display: "flex", gap: 0, marginBottom: 16, borderRadius: 6, overflow: "hidden",
                      height: 6, background: FOUNDRY.bg,
                    }}>
                      {["관심", "상담", "신청", "결과"].map(status => {
                        const count = interests.filter(i => i.pipeline_status === status).length;
                        if (count === 0) return null;
                        return (
                          <div key={status} style={{
                            flex: count, background: STATUS_COLORS[status],
                            transition: "flex 0.3s",
                          }} />
                        );
                      })}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {interests.map(i => (
                        <div key={i.id} style={{
                          padding: "12px 14px", background: FOUNDRY.card, borderRadius: 8,
                          border: `1px solid ${FOUNDRY.border}`,
                          borderLeft: `3px solid ${STATUS_COLORS[i.pipeline_status] || FOUNDRY.muted}`,
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{
                              padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600,
                              background: (STATUS_COLORS[i.pipeline_status] || FOUNDRY.muted) + "18",
                              color: STATUS_COLORS[i.pipeline_status] || FOUNDRY.muted,
                            }}>
                              {i.pipeline_status}{i.result_type ? ` · ${i.result_type}` : ""}
                            </span>
                            {i.eligibility_status && (
                              <span style={{
                                padding: "2px 6px", borderRadius: 4, fontSize: 10,
                                background: (ELIG_COLORS[i.eligibility_status] || FOUNDRY.muted) + "18",
                                color: ELIG_COLORS[i.eligibility_status] || FOUNDRY.muted,
                              }}>
                                {i.eligibility_status}
                              </span>
                            )}
                            <span style={{ flex: 1, fontSize: 12, color: FOUNDRY.muted }}>{i.grant_id.slice(0, 8)}...</span>
                            {NEXT_STATUS[i.pipeline_status] && (
                              <button onClick={() => handleTransition(i.id, NEXT_STATUS[i.pipeline_status])} style={{
                                display: "flex", alignItems: "center", gap: 3,
                                padding: "4px 10px", fontSize: 11, fontWeight: 600,
                                background: "transparent", color: FOUNDRY.primary,
                                border: `1px solid ${FOUNDRY.primary}30`, borderRadius: 5, cursor: "pointer",
                              }}>
                                {NEXT_STATUS[i.pipeline_status]} <ArrowRight size={10} />
                              </button>
                            )}
                          </div>
                          {i.notes && (
                            <p style={{ margin: "6px 0 0", fontSize: 12, color: FOUNDRY.muted }}>{i.notes}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Info tab ─────────────────────────────── */}
            {tab === "info" && (
              <div style={{ background: FOUNDRY.card, border: `1px solid ${FOUNDRY.border}`, borderRadius: 8, padding: 18 }}>
                {!editing ? (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                      <p style={{ margin: 0, fontSize: 10, color: FOUNDRY.muted, letterSpacing: "0.1em", textTransform: "uppercase" }}>고객 상세 정보</p>
                      <button onClick={() => { setEditing(true); setEditForm({
                        company_name: client.company_name || "", industry: client.industry || "",
                        region: client.region || "", employee_count: client.employee_count || 0,
                        revenue_krw: client.revenue_krw || 0, company_age: client.company_age || 0,
                      }); }} style={{
                        display: "flex", alignItems: "center", gap: 4, padding: "5px 10px",
                        fontSize: 11, color: FOUNDRY.primary, background: "transparent",
                        border: `1px solid ${FOUNDRY.primary}30`, borderRadius: 5, cursor: "pointer",
                      }}>
                        <Edit3 size={11} /> 수정
                      </button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px" }}>
                      {[
                        { label: "회사명", value: client.company_name },
                        { label: "이메일", value: client.email },
                        { label: "업종", value: client.industry },
                        { label: "소재지", value: client.region },
                        { label: "직원수", value: client.employee_count ? `${client.employee_count}명` : null },
                        { label: "업력", value: client.company_age ? `${client.company_age}년` : null },
                        { label: "매출", value: client.revenue_krw ? `${(client.revenue_krw / 100000000).toFixed(1)}억원` : null },
                        { label: "법인", value: client.is_corporate ? "예" : "아니오" },
                        { label: "벤처", value: client.is_venture ? "예" : "아니오" },
                        { label: "인증", value: client.certifications?.length ? client.certifications.join(", ") : "없음" },
                      ].map(item => (
                        <div key={item.label}>
                          <p style={{ margin: "0 0 2px", fontSize: 10, color: FOUNDRY.muted }}>{item.label}</p>
                          <p style={{ margin: 0, fontSize: 13, color: item.value ? FOUNDRY.text : FOUNDRY.muted }}>{item.value || "미입력"}</p>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <p style={{ margin: "0 0 12px", fontSize: 10, color: FOUNDRY.muted, letterSpacing: "0.1em", textTransform: "uppercase" }}>정보 수정</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px" }}>
                      {[
                        { key: "company_name", label: "회사명", type: "text" },
                        { key: "industry", label: "업종", type: "text" },
                        { key: "region", label: "소재지", type: "text" },
                        { key: "employee_count", label: "직원수", type: "number" },
                        { key: "revenue_krw", label: "매출 (원)", type: "number" },
                        { key: "company_age", label: "업력 (년)", type: "number" },
                      ].map(f => (
                        <div key={f.key}>
                          <p style={{ margin: "0 0 3px", fontSize: 10, color: FOUNDRY.muted }}>{f.label}</p>
                          <input style={inputStyle} type={f.type} value={editForm[f.key] || ""}
                            onChange={e => setEditForm({ ...editForm, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value })} />
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 6, marginTop: 14, justifyContent: "flex-end" }}>
                      <button onClick={() => setEditing(false)} style={{
                        padding: "7px 14px", background: "transparent", color: FOUNDRY.muted,
                        border: `1px solid ${FOUNDRY.border}`, borderRadius: 6, fontSize: 12, cursor: "pointer",
                      }}>
                        취소
                      </button>
                      <button onClick={handleSaveClient} style={{
                        padding: "7px 18px", background: FOUNDRY.primary, color: "white",
                        border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 4,
                      }}>
                        <Save size={12} /> 저장
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ══ RIGHT: Sidebar ═════════════════════════ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Client card */}
            <div style={{ background: FOUNDRY.card, border: `1px solid ${FOUNDRY.border}`, borderRadius: 10, padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                  background: FOUNDRY.primary + "18", color: FOUNDRY.primary,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, fontWeight: 700,
                }}>
                  {(client.name || client.email)[0].toUpperCase()}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: FOUNDRY.text }}>
                    {client.name || client.email.split("@")[0]}
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: FOUNDRY.muted }}>{client.email}</p>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {[
                  { icon: Building2, value: client.company_name },
                  { icon: MapPin, value: client.region },
                ].map((item, idx) => item.value ? (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <item.icon size={12} color={FOUNDRY.muted} />
                    <span style={{ fontSize: 12, color: FOUNDRY.text }}>{item.value}</span>
                  </div>
                ) : null)}
                {client.industry && <span style={{ fontSize: 11, color: FOUNDRY.muted }}>업종: {client.industry}</span>}
              </div>
            </div>

            {/* Stats */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6,
            }}>
              {[
                { label: "관심", value: client.interest_count, color: "#00d4ff" },
                { label: "활동", value: client.activity_count, color: FOUNDRY.primary },
                { label: "메모", value: client.note_count, color: FOUNDRY.success },
              ].map(s => (
                <div key={s.label} style={{
                  padding: "10px 12px", background: FOUNDRY.card,
                  border: `1px solid ${FOUNDRY.border}`, borderRadius: 8, textAlign: "center",
                }}>
                  <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: s.color, fontFamily: "monospace" }}>{s.value}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 9, color: FOUNDRY.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* Pipeline status */}
            {interests.length > 0 && (
              <div style={{ background: FOUNDRY.card, border: `1px solid ${FOUNDRY.border}`, borderRadius: 8, padding: 16 }}>
                <p style={{ margin: "0 0 10px", fontSize: 10, color: FOUNDRY.muted, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>파이프라인</p>
                {["관심", "상담", "신청", "결과"].map(status => {
                  const count = interests.filter(i => i.pipeline_status === status).length;
                  return (
                    <div key={status} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: STATUS_COLORS[status], flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: FOUNDRY.muted, flex: 1 }}>{status}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: count > 0 ? FOUNDRY.text : FOUNDRY.muted, fontFamily: "monospace" }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Quick actions */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <p style={{ margin: "0 0 6px", fontSize: 10, color: FOUNDRY.muted, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>빠른 액션</p>
              {(["meeting", "call", "email", "visit"] as const).map(type => {
                const t = ACT[type];
                const Icon = t.icon;
                return (
                  <button key={type} onClick={() => { setShowActForm(true); setActForm({ ...actForm, type }); }} style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
                    background: "transparent", border: `1px solid ${FOUNDRY.border}`, borderRadius: 6,
                    color: FOUNDRY.text, cursor: "pointer", fontSize: 12, textAlign: "left",
                    transition: "border-color 0.15s",
                    width: "100%",
                  }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = t.color + "60"}
                    onMouseLeave={e => e.currentTarget.style.borderColor = FOUNDRY.border}
                  >
                    <Icon size={13} color={t.color} />
                    <span>{t.label} 추가</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
