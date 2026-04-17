"use client";

import { useEffect, useState } from "react";
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
  FileText, ArrowRight, ArrowLeft, Plus, Calendar, Phone,
  Mail, MapPin, Building2, Check, Clock, Edit3, Save, X,
} from "lucide-react";

/* ── Constants ─────────────────────────────────────────────────── */

const STATUS_COLORS: Record<string, string> = {
  "관심": "#00d4ff", "상담": FOUNDRY.primary, "신청": "#f97316", "결과": FOUNDRY.success,
};
const ELIG_COLORS: Record<string, string> = {
  "가능": FOUNDRY.success, "조건부": "#f97316", "불가능": FOUNDRY.muted,
};
const NEXT_STATUS: Record<string, string> = {
  "관심": "상담", "상담": "신청", "신청": "결과",
};
const ACT_ICONS: Record<string, typeof Phone> = {
  meeting: Calendar, call: Phone, email: Mail, visit: MapPin, note: FileText, other: Clock,
};
const ACT_LABELS: Record<string, string> = {
  meeting: "미팅", call: "전화", email: "이메일", visit: "방문", note: "메모", other: "기타",
};
const ACT_COLORS: Record<string, string> = {
  meeting: FOUNDRY.primary, call: "#f97316", email: "#8b5cf6",
  visit: FOUNDRY.success, note: FOUNDRY.muted, other: FOUNDRY.muted,
};

type Tab = "timeline" | "interests" | "info";

/* ── Helpers ───────────────────────────────────────────────────── */

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

/* ── Component ─────────────────────────────────────────────────── */

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

  // Timeline: merge activities + notes, sorted by date desc
  const timeline = [
    ...activities.map((a) => ({ ...a, _kind: "activity" as const, _date: a.scheduled_at || a.created_at || "" })),
    ...notes.map((n) => ({ ...n, _kind: "note" as const, _date: n.created_at || "" })),
  ].sort((a, b) => new Date(b._date).getTime() - new Date(a._date).getTime());

  async function handleTransition(interestId: string, target: string) {
    if (!token) return;
    try {
      const updated = await transitionPipeline(token, interestId, target);
      setInterests((prev) => prev.map((i) => (i.id === interestId ? updated : i)));
    } catch (err: any) { alert(err.message); }
  }

  async function handleAddNote() {
    if (!token || !id || !newNote.trim()) return;
    const note = await createNote(token, id, newNote.trim()).catch(() => null);
    if (note) { setNotes((prev) => [note, ...prev]); setNewNote(""); }
  }

  async function handleAddActivity() {
    if (!token || !id || !actForm.title.trim()) return;
    const a = await createClientActivity(token, id, {
      activity_type: actForm.type, title: actForm.title,
      description: actForm.desc || undefined, scheduled_at: actForm.date || undefined,
    }).catch(() => null);
    if (a) {
      setActivities((prev) => [a, ...prev]);
      setActForm({ type: "meeting", title: "", desc: "", date: "" });
      setShowActForm(false);
    }
  }

  async function handleComplete(actId: string) {
    if (!token || !id) return;
    const updated = await completeActivity(token, id, actId).catch(() => null);
    if (updated) setActivities((prev) => prev.map((a) => (a.id === actId ? updated : a)));
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
    <div style={{ padding: "24px 32px" }}>
      {/* ── Back + Header ──────────────────────────────────── */}
      <Link href="/clients" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: FOUNDRY.muted, textDecoration: "none", marginBottom: 16 }}>
        <ArrowLeft size={13} /> 내 고객
      </Link>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20 }}>
        {/* ── Left: Main content ──────────────────────────── */}
        <div>
          {/* Client header */}
          <div style={{
            padding: "18px 20px", background: FOUNDRY.card,
            border: `1px solid ${FOUNDRY.border}`, borderRadius: 10, marginBottom: 20,
            display: "flex", alignItems: "center", gap: 14,
          }}>
            <div style={{
              width: 46, height: 46, borderRadius: "50%", flexShrink: 0,
              background: FOUNDRY.primary + "18", color: FOUNDRY.primary,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, fontWeight: 700,
            }}>
              {(client.name || client.email)[0].toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: FOUNDRY.text }}>
                {client.name || client.email.split("@")[0]}
              </h1>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: FOUNDRY.muted }}>
                {client.email}
                {client.company_name && ` · ${client.company_name}`}
              </p>
            </div>
            <span style={{
              fontSize: 10, padding: "3px 8px", borderRadius: 4,
              background: client.onboarding_completed ? FOUNDRY.success + "18" : FOUNDRY.warning + "18",
              color: client.onboarding_completed ? FOUNDRY.success : FOUNDRY.warning,
            }}>
              {client.onboarding_completed ? "활성" : "온보딩 대기"}
            </span>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 0, marginBottom: 18, borderBottom: `1px solid ${FOUNDRY.border}` }}>
            {([
              { key: "timeline" as Tab, label: "타임라인", count: timeline.length },
              { key: "interests" as Tab, label: "관심 사업", count: interests.length },
              { key: "info" as Tab, label: "고객 정보" },
            ]).map((t) => (
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

          {/* ── Timeline tab ──────────────────────────────── */}
          {tab === "timeline" && (
            <div>
              {/* Quick actions */}
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <button onClick={() => setShowActForm(!showActForm)} style={{
                  display: "flex", alignItems: "center", gap: 5, padding: "7px 14px",
                  background: FOUNDRY.primary, color: "white", border: "none", borderRadius: 6,
                  fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}>
                  <Plus size={13} /> 활동 추가
                </button>
                <div style={{ flex: 1, display: "flex", gap: 6 }}>
                  <input value={newNote} onChange={(e) => setNewNote(e.target.value)}
                    placeholder="빠른 메모..." onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
                    style={{ ...inputStyle, flex: 1 }} />
                  {newNote && (
                    <button onClick={handleAddNote} style={{
                      padding: "7px 12px", background: FOUNDRY.card, color: FOUNDRY.text,
                      border: `1px solid ${FOUNDRY.border}`, borderRadius: 6, fontSize: 12, cursor: "pointer",
                    }}>
                      저장
                    </button>
                  )}
                </div>
              </div>

              {/* Activity form */}
              {showActForm && (
                <div style={{
                  padding: 14, background: FOUNDRY.card, border: `1px solid ${FOUNDRY.border}`,
                  borderRadius: 8, marginBottom: 14, display: "flex", flexDirection: "column", gap: 8,
                }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    {(["meeting", "call", "email", "visit"] as const).map((t) => {
                      const Icon = ACT_ICONS[t];
                      return (
                        <button key={t} onClick={() => setActForm({ ...actForm, type: t })} style={{
                          padding: "5px 10px", borderRadius: 5, fontSize: 11, cursor: "pointer",
                          display: "flex", alignItems: "center", gap: 3,
                          background: actForm.type === t ? ACT_COLORS[t] + "18" : "transparent",
                          color: actForm.type === t ? ACT_COLORS[t] : FOUNDRY.muted,
                          border: `1px solid ${actForm.type === t ? ACT_COLORS[t] + "40" : FOUNDRY.border}`,
                        }}>
                          <Icon size={11} />{ACT_LABELS[t]}
                        </button>
                      );
                    })}
                  </div>
                  <input style={inputStyle} placeholder="제목" value={actForm.title}
                    onChange={(e) => setActForm({ ...actForm, title: e.target.value })} />
                  <div style={{ display: "flex", gap: 6 }}>
                    <input type="datetime-local" style={{ ...inputStyle, flex: 1 }} value={actForm.date}
                      onChange={(e) => setActForm({ ...actForm, date: e.target.value })} />
                    <button onClick={handleAddActivity} disabled={!actForm.title.trim()} style={{
                      padding: "7px 16px", background: FOUNDRY.primary, color: "white",
                      border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
                      opacity: actForm.title.trim() ? 1 : 0.4,
                    }}>
                      저장
                    </button>
                    <button onClick={() => setShowActForm(false)} style={{
                      padding: "7px 10px", background: "transparent", color: FOUNDRY.muted,
                      border: `1px solid ${FOUNDRY.border}`, borderRadius: 6, fontSize: 12, cursor: "pointer",
                    }}>
                      <X size={13} />
                    </button>
                  </div>
                </div>
              )}

              {/* Timeline items */}
              {timeline.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: FOUNDRY.muted, fontSize: 13 }}>
                  활동이나 메모를 추가하면 타임라인에 표시됩니다.
                </div>
              ) : (
                <div style={{ position: "relative", paddingLeft: 20 }}>
                  {/* Vertical line */}
                  <div style={{
                    position: "absolute", left: 7, top: 8, bottom: 8, width: 1,
                    background: FOUNDRY.border,
                  }} />

                  {timeline.map((item) => {
                    if (item._kind === "activity") {
                      const a = item as ClientActivityItem & { _kind: "activity"; _date: string };
                      const Icon = ACT_ICONS[a.activity_type] || Clock;
                      return (
                        <div key={`a-${a.id}`} style={{ position: "relative", marginBottom: 12, paddingLeft: 16 }}>
                          {/* Dot */}
                          <div style={{
                            position: "absolute", left: -16, top: 6,
                            width: 11, height: 11, borderRadius: "50%",
                            background: FOUNDRY.bg,
                            border: `2px solid ${a.completed_at ? FOUNDRY.muted : ACT_COLORS[a.activity_type] || FOUNDRY.primary}`,
                          }} />
                          <div style={{
                            padding: "10px 14px", background: FOUNDRY.card,
                            border: `1px solid ${FOUNDRY.border}`, borderRadius: 8,
                            opacity: a.completed_at ? 0.55 : 1,
                          }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                              <Icon size={12} color={ACT_COLORS[a.activity_type] || FOUNDRY.muted} />
                              <span style={{ fontSize: 10, color: ACT_COLORS[a.activity_type] || FOUNDRY.muted, fontWeight: 600 }}>
                                {ACT_LABELS[a.activity_type]}
                              </span>
                              <span style={{ flex: 1 }} />
                              <span style={{ fontSize: 10, color: FOUNDRY.muted }}>
                                {a._date && <RelativeTime date={a._date} />}
                              </span>
                              {!a.completed_at && (
                                <button onClick={() => handleComplete(a.id)} style={{
                                  padding: "2px 6px", background: "transparent",
                                  border: `1px solid ${FOUNDRY.border}`, borderRadius: 3,
                                  color: FOUNDRY.muted, cursor: "pointer", fontSize: 10,
                                }}>
                                  <Check size={10} />
                                </button>
                              )}
                            </div>
                            <p style={{
                              margin: 0, fontSize: 13, color: FOUNDRY.text, fontWeight: 500,
                              textDecoration: a.completed_at ? "line-through" : "none",
                            }}>
                              {a.title}
                            </p>
                            {a.description && <p style={{ margin: "3px 0 0", fontSize: 12, color: FOUNDRY.muted }}>{a.description}</p>}
                          </div>
                        </div>
                      );
                    } else {
                      const n = item as ConsultingNote & { _kind: "note"; _date: string };
                      return (
                        <div key={`n-${n.id}`} style={{ position: "relative", marginBottom: 12, paddingLeft: 16 }}>
                          <div style={{
                            position: "absolute", left: -16, top: 6,
                            width: 11, height: 11, borderRadius: "50%",
                            background: FOUNDRY.bg, border: `2px solid ${FOUNDRY.muted}`,
                          }} />
                          <div style={{
                            padding: "10px 14px", background: FOUNDRY.card,
                            border: `1px solid ${FOUNDRY.border}`, borderRadius: 8,
                          }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                              <FileText size={12} color={FOUNDRY.muted} />
                              <span style={{ fontSize: 10, color: FOUNDRY.muted, fontWeight: 600 }}>메모</span>
                              <span style={{ flex: 1 }} />
                              <span style={{ fontSize: 10, color: FOUNDRY.muted }}>
                                {n._date && <RelativeTime date={n._date} />}
                              </span>
                            </div>
                            <p style={{ margin: 0, fontSize: 13, color: FOUNDRY.text, whiteSpace: "pre-wrap" }}>{n.content}</p>
                          </div>
                        </div>
                      );
                    }
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Interests tab ─────────────────────────────── */}
          {tab === "interests" && (
            <div>
              {interests.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: FOUNDRY.muted, fontSize: 13 }}>
                  아직 관심 사업이 없습니다.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {interests.map((i) => (
                    <div key={i.id} style={{
                      padding: "10px 14px", background: FOUNDRY.card, borderRadius: 7,
                      border: `1px solid ${FOUNDRY.border}`,
                      display: "flex", alignItems: "center", gap: 10,
                    }}>
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
                          padding: "3px 8px", fontSize: 10, fontWeight: 600,
                          background: "transparent", color: FOUNDRY.primary,
                          border: `1px solid ${FOUNDRY.primary}30`, borderRadius: 4, cursor: "pointer",
                        }}>
                          {NEXT_STATUS[i.pipeline_status]} <ArrowRight size={10} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Info tab ──────────────────────────────────── */}
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
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px" }}>
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
                    ].map((item) => (
                      <div key={item.label}>
                        <p style={{ margin: "0 0 1px", fontSize: 10, color: FOUNDRY.muted }}>{item.label}</p>
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
                    ].map((f) => (
                      <div key={f.key}>
                        <p style={{ margin: "0 0 3px", fontSize: 10, color: FOUNDRY.muted }}>{f.label}</p>
                        <input style={inputStyle} type={f.type} value={editForm[f.key] || ""}
                          onChange={(e) => setEditForm({ ...editForm, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value })} />
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

        {/* ── Right sidebar ──────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Stats */}
          <div style={{ background: FOUNDRY.card, border: `1px solid ${FOUNDRY.border}`, borderRadius: 8, padding: 16 }}>
            <p style={{ margin: "0 0 10px", fontSize: 10, color: FOUNDRY.muted, letterSpacing: "0.1em", textTransform: "uppercase" }}>요약</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { label: "관심 사업", value: client.interest_count, color: "#00d4ff" },
                { label: "활동 기록", value: client.activity_count, color: FOUNDRY.primary },
                { label: "상담 메모", value: client.note_count, color: FOUNDRY.success },
              ].map((s) => (
                <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: FOUNDRY.muted }}>{s.label}</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: s.color, fontFamily: "monospace" }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Company info quick view */}
          <div style={{ background: FOUNDRY.card, border: `1px solid ${FOUNDRY.border}`, borderRadius: 8, padding: 16 }}>
            <p style={{ margin: "0 0 10px", fontSize: 10, color: FOUNDRY.muted, letterSpacing: "0.1em", textTransform: "uppercase" }}>기업 정보</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { icon: Building2, value: client.company_name },
                { icon: MapPin, value: client.region },
                { icon: Mail, value: client.email },
              ].map((item, idx) => item.value ? (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <item.icon size={12} color={FOUNDRY.muted} />
                  <span style={{ fontSize: 12, color: FOUNDRY.text }}>{item.value}</span>
                </div>
              ) : null)}
              {client.industry && <span style={{ fontSize: 11, color: FOUNDRY.muted }}>업종: {client.industry}</span>}
              {client.company_age && <span style={{ fontSize: 11, color: FOUNDRY.muted }}>업력: {client.company_age}년</span>}
            </div>
          </div>

          {/* Pipeline status breakdown */}
          {interests.length > 0 && (
            <div style={{ background: FOUNDRY.card, border: `1px solid ${FOUNDRY.border}`, borderRadius: 8, padding: 16 }}>
              <p style={{ margin: "0 0 10px", fontSize: 10, color: FOUNDRY.muted, letterSpacing: "0.1em", textTransform: "uppercase" }}>파이프라인</p>
              {["관심", "상담", "신청", "결과"].map((status) => {
                const count = interests.filter((i) => i.pipeline_status === status).length;
                return (
                  <div key={status} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: STATUS_COLORS[status], flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: FOUNDRY.muted, flex: 1 }}>{status}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: FOUNDRY.text, fontFamily: "monospace" }}>{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
