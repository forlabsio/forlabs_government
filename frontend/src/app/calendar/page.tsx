"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import {
  fetchCalendarActivities, fetchClients, createClientActivity,
  completeActivity, type ClientActivityItem, type ClientSummary,
} from "@/lib/api";
import { FOUNDRY } from "@/lib/theme";
import {
  ChevronLeft, ChevronRight, Calendar, Phone, Mail,
  MapPin, Clock, FileText, Plus, Check, X, Target,
} from "lucide-react";

/* ── Design tokens ─────────────────────────────────────────── */

const TYPE = {
  meeting:  { color: "#3d8ef7", bg: "#3d8ef710", label: "미팅",    icon: Calendar },
  call:     { color: "#f59e42", bg: "#f59e4210", label: "전화",    icon: Phone },
  email:    { color: "#a78bfa", bg: "#a78bfa10", label: "이메일",  icon: Mail },
  visit:    { color: "#34d399", bg: "#34d39910", label: "방문",    icon: MapPin },
  note:     { color: "#7B919E", bg: "#7B919E10", label: "메모",    icon: FileText },
  other:    { color: "#7B919E", bg: "#7B919E10", label: "기타",    icon: Clock },
} as const;

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

/* ── Helpers ────────────────────────────────────────────────── */

function monthGrid(y: number, m: number) {
  const first = new Date(y, m, 1).getDay();
  const len = new Date(y, m + 1, 0).getDate();
  const cells: (number | null)[] = Array(first).fill(null);
  for (let i = 1; i <= len; i++) cells.push(i);
  while (cells.length % 7) cells.push(null);
  return cells;
}

function onDay(d: string, y: number, m: number, day: number) {
  const dt = new Date(d);
  return dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === day;
}

function fmtTime(d: string) {
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

/* ── Page ───────────────────────────────────────────────────── */

export default function CalendarPage() {
  const { user } = useAuth();
  const [acts, setActs] = useState<ClientActivityItem[]>([]);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selDay, setSelDay] = useState<number>(now.getDate());

  // form
  const [adding, setAdding] = useState(false);
  const [fClient, setFClient] = useState("");
  const [fType, setFType] = useState<keyof typeof TYPE>("meeting");
  const [fTitle, setFTitle] = useState("");
  const [fTime, setFTime] = useState("");

  const token = typeof window !== "undefined" ? localStorage.getItem("govgrants_token") : null;

  useEffect(() => {
    if (!token) return;
    Promise.all([fetchCalendarActivities(token), fetchClients(token)])
      .then(([a, c]) => { setActs(a); setClients(c); if (c.length) setFClient(c[0].id); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const cMap = useMemo(() => Object.fromEntries(clients.map(c => [c.id, c])), [clients]);

  const cells = monthGrid(year, month);
  const isToday = (d: number) => now.getFullYear() === year && now.getMonth() === month && now.getDate() === d;
  const dayActs = (d: number) => acts.filter(a => a.scheduled_at && onDay(a.scheduled_at, year, month, d));
  const selActs = dayActs(selDay);

  const upcoming = useMemo(() => {
    const t = Date.now();
    return acts
      .filter(a => a.scheduled_at && !a.completed_at && new Date(a.scheduled_at).getTime() >= t)
      .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())
      .slice(0, 6);
  }, [acts]);

  // Stats for header
  const todayCount = useMemo(() => {
    return acts.filter(a => a.scheduled_at && onDay(a.scheduled_at, now.getFullYear(), now.getMonth(), now.getDate()) && !a.completed_at).length;
  }, [acts]);

  function prev() { month === 0 ? (setYear(year - 1), setMonth(11)) : setMonth(month - 1); }
  function next() { month === 11 ? (setYear(year + 1), setMonth(0)) : setMonth(month + 1); }
  function goToday() { setYear(now.getFullYear()); setMonth(now.getMonth()); setSelDay(now.getDate()); }

  async function onComplete(cid: string, aid: string) {
    if (!token) return;
    const u = await completeActivity(token, cid, aid).catch(() => null);
    if (u) setActs(p => p.map(a => a.id === aid ? u : a));
  }

  async function onAdd() {
    if (!token || !fClient || !fTitle.trim()) return;
    const dt = new Date(year, month, selDay);
    if (fTime) { const [h, m] = fTime.split(":").map(Number); dt.setHours(h, m); }
    const a = await createClientActivity(token, fClient, {
      activity_type: fType, title: fTitle,
      scheduled_at: dt.toISOString(),
    }).catch(() => null);
    if (a) { setActs(p => [a, ...p]); setFTitle(""); setFTime(""); setAdding(false); }
  }

  if (user?.role !== "consultant" && !user?.is_admin) {
    return <div style={{ padding: 60, textAlign: "center", color: FOUNDRY.muted }}>컨설턴트만 접근할 수 있습니다.</div>;
  }

  const selLabel = `${month + 1}월 ${selDay}일 ${DAYS[new Date(year, month, selDay).getDay()]}요일`;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* ── 44px Header ────────────────────────────────────── */}
      <div style={{
        height: 44, padding: "0 16px", display: "flex", alignItems: "center", gap: 8,
        borderBottom: `1px solid ${FOUNDRY.border}`, background: FOUNDRY.sidebar, flexShrink: 0,
      }}>
        <Calendar className="w-4 h-4" style={{ color: FOUNDRY.primary }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: FOUNDRY.text }}>캘린더</span>
        {todayCount > 0 && (
          <span style={{
            fontSize: 10, padding: "2px 7px", borderRadius: 4,
            background: FOUNDRY.primary + "18", color: FOUNDRY.primary, fontWeight: 600,
          }}>
            오늘 {todayCount}건
          </span>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button onClick={goToday} style={{
            padding: "5px 12px", fontSize: 11, fontWeight: 500,
            color: FOUNDRY.text, background: FOUNDRY.card,
            border: `1px solid ${FOUNDRY.border}`, borderRadius: 5, cursor: "pointer",
          }}>
            오늘
          </button>
          <div style={{ display: "flex", gap: 2 }}>
            <button onClick={prev} style={{ background: "transparent", border: `1px solid ${FOUNDRY.border}`, borderRadius: 5, color: FOUNDRY.muted, cursor: "pointer", padding: "4px 8px" }}>
              <ChevronLeft size={14} />
            </button>
            <button onClick={next} style={{ background: "transparent", border: `1px solid ${FOUNDRY.border}`, borderRadius: 5, color: FOUNDRY.muted, cursor: "pointer", padding: "4px 8px" }}>
              <ChevronRight size={14} />
            </button>
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: FOUNDRY.text, display: "flex", alignItems: "center", minWidth: 100 }}>
            {year}년 {month + 1}월
          </span>
        </div>
      </div>

      {/* ── Content: Calendar + Detail ─────────────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* ════════════ LEFT: Calendar Grid ════════════ */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", borderRight: `1px solid ${FOUNDRY.border}` }}>
          {/* Day headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: `1px solid ${FOUNDRY.border}` }}>
            {DAYS.map((d, i) => (
              <div key={d} style={{
                textAlign: "center", padding: "8px 0", fontSize: 11, fontWeight: 600,
                color: i === 0 ? "#ef4444" : i === 6 ? "#3b82f6" : FOUNDRY.muted,
                letterSpacing: "0.06em",
              }}>
                {d}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gridAutoRows: "1fr" }}>
            {cells.map((day, idx) => {
              if (day === null) return (
                <div key={`e${idx}`} style={{ borderBottom: `1px solid ${FOUNDRY.border}`, borderRight: `1px solid ${FOUNDRY.border}` }} />
              );
              const da = dayActs(day);
              const sel = selDay === day;
              const td = isToday(day);
              const dow = new Date(year, month, day).getDay();

              return (
                <div
                  key={day}
                  onClick={() => setSelDay(day)}
                  style={{
                    padding: "4px 6px", cursor: "pointer",
                    borderBottom: `1px solid ${FOUNDRY.border}`,
                    borderRight: `1px solid ${FOUNDRY.border}`,
                    background: sel ? "#2D72D20c" : "transparent",
                    transition: "background 0.1s",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <div style={{ marginBottom: 2, display: "flex", alignItems: "center", gap: 2 }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      width: td ? 24 : "auto", height: td ? 24 : "auto",
                      borderRadius: td ? "50%" : 0, fontSize: 12,
                      fontWeight: td || sel ? 700 : 400,
                      background: td ? FOUNDRY.primary : "transparent",
                      color: td ? "#fff"
                        : sel ? FOUNDRY.primary
                        : dow === 0 ? "#ef4444"
                        : dow === 6 ? "#3b82f6"
                        : FOUNDRY.text,
                    }}>
                      {day}
                    </span>
                    {da.length > 0 && !td && (
                      <span style={{
                        width: 5, height: 5, borderRadius: "50%",
                        background: da.some(a => !a.completed_at) ? FOUNDRY.primary : FOUNDRY.success,
                      }} />
                    )}
                  </div>

                  {da.slice(0, 3).map(a => {
                    const t = TYPE[a.activity_type as keyof typeof TYPE] || TYPE.other;
                    return (
                      <div key={a.id} style={{
                        fontSize: 10, lineHeight: "16px", padding: "0 4px",
                        marginBottom: 1, borderRadius: 3,
                        background: t.bg, color: a.completed_at ? FOUNDRY.muted : t.color,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        textDecoration: a.completed_at ? "line-through" : "none",
                      }}>
                        {a.title}
                      </div>
                    );
                  })}
                  {da.length > 3 && (
                    <span style={{ fontSize: 9, color: FOUNDRY.muted, paddingLeft: 4 }}>+{da.length - 3}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ════════════ RIGHT: Detail panel ════════════ */}
        <div style={{ width: 340, display: "flex", flexDirection: "column", overflow: "auto" }}>
          {/* Selected day header */}
          <div style={{
            padding: "14px 20px",
            borderBottom: `1px solid ${FOUNDRY.border}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: FOUNDRY.text }}>{selLabel}</p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: FOUNDRY.muted }}>
                {selActs.length > 0 ? `${selActs.length}건의 일정` : "일정 없음"}
              </p>
            </div>
            {clients.length > 0 && (
              <button onClick={() => setAdding(!adding)} style={{
                width: 30, height: 30, borderRadius: "50%", display: "flex",
                alignItems: "center", justifyContent: "center", cursor: "pointer",
                background: adding ? FOUNDRY.muted + "20" : FOUNDRY.primary,
                color: adding ? FOUNDRY.muted : "white",
                border: "none",
              }}>
                {adding ? <X size={13} /> : <Plus size={13} />}
              </button>
            )}
          </div>

          {/* Add form */}
          {adding && (
            <div style={{
              padding: "14px 20px", borderBottom: `1px solid ${FOUNDRY.border}`,
              display: "flex", flexDirection: "column", gap: 8,
              background: FOUNDRY.card,
            }}>
              <div style={{ display: "flex", gap: 4 }}>
                {(Object.keys(TYPE) as (keyof typeof TYPE)[]).filter(k => k !== "note" && k !== "other").map(k => {
                  const t = TYPE[k];
                  const Icon = t.icon;
                  const active = fType === k;
                  return (
                    <button key={k} onClick={() => setFType(k)} style={{
                      flex: 1, padding: "6px 0", borderRadius: 5, fontSize: 11, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
                      background: active ? t.color + "15" : "transparent",
                      color: active ? t.color : FOUNDRY.muted,
                      border: `1px solid ${active ? t.color + "40" : FOUNDRY.border}`,
                      fontWeight: active ? 600 : 400,
                    }}>
                      <Icon size={12} />{t.label}
                    </button>
                  );
                })}
              </div>
              <select value={fClient} onChange={e => setFClient(e.target.value)} style={{
                width: "100%", padding: "8px 10px", fontSize: 12,
                background: FOUNDRY.bg, color: FOUNDRY.text,
                border: `1px solid ${FOUNDRY.border}`, borderRadius: 5, outline: "none",
              }}>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.email.split("@")[0]}{c.company_name ? ` — ${c.company_name}` : ""}
                  </option>
                ))}
              </select>
              <input placeholder="일정 제목" value={fTitle} onChange={e => setFTitle(e.target.value)}
                onKeyDown={e => e.key === "Enter" && onAdd()}
                style={{
                  width: "100%", padding: "8px 10px", fontSize: 13,
                  background: FOUNDRY.bg, color: FOUNDRY.text,
                  border: `1px solid ${FOUNDRY.border}`, borderRadius: 5, outline: "none",
                }}
                autoFocus
              />
              <div style={{ display: "flex", gap: 8 }}>
                <input type="time" value={fTime} onChange={e => setFTime(e.target.value)} style={{
                  flex: 1, padding: "8px 10px", fontSize: 12,
                  background: FOUNDRY.bg, color: FOUNDRY.text,
                  border: `1px solid ${FOUNDRY.border}`, borderRadius: 5, outline: "none",
                }} />
                <button onClick={onAdd} disabled={!fTitle.trim()} style={{
                  padding: "8px 20px", fontSize: 12, fontWeight: 600,
                  background: FOUNDRY.primary, color: "white",
                  border: "none", borderRadius: 5, cursor: "pointer",
                  opacity: fTitle.trim() ? 1 : 0.4,
                }}>
                  추가
                </button>
              </div>
            </div>
          )}

          {/* Day events */}
          <div style={{ flex: 1, overflow: "auto" }}>
            {selActs.length === 0 && !adding ? (
              <div style={{ padding: "60px 20px", textAlign: "center" }}>
                <Calendar size={28} color={FOUNDRY.muted} style={{ marginBottom: 8, opacity: 0.4 }} />
                <p style={{ color: FOUNDRY.muted, fontSize: 13, margin: "0 0 4px" }}>일정이 없습니다</p>
                {clients.length > 0 ? (
                  <button onClick={() => setAdding(true)} style={{
                    marginTop: 8, padding: "7px 16px", fontSize: 12, fontWeight: 500,
                    color: FOUNDRY.primary, background: "transparent",
                    border: `1px solid ${FOUNDRY.primary}30`, borderRadius: 5, cursor: "pointer",
                  }}>
                    + 일정 추가
                  </button>
                ) : (
                  <p style={{ color: FOUNDRY.muted, fontSize: 11, margin: "4px 0 0" }}>
                    먼저 <Link href="/clients" style={{ color: FOUNDRY.primary, textDecoration: "none" }}>고객을 추가</Link>하세요
                  </p>
                )}
              </div>
            ) : (
              <div style={{ padding: "8px 0" }}>
                {selActs
                  .sort((a, b) => {
                    if (!a.scheduled_at) return 1;
                    if (!b.scheduled_at) return -1;
                    return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
                  })
                  .map(a => {
                    const t = TYPE[a.activity_type as keyof typeof TYPE] || TYPE.other;
                    const Icon = t.icon;
                    const c = cMap[a.client_user_id];
                    const done = !!a.completed_at;

                    return (
                      <div key={a.id} style={{
                        padding: "12px 20px", display: "flex", gap: 12,
                        borderBottom: `1px solid ${FOUNDRY.border}`,
                        opacity: done ? 0.45 : 1,
                      }}>
                        <div style={{ width: 44, flexShrink: 0, textAlign: "right", paddingTop: 1 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: done ? FOUNDRY.muted : FOUNDRY.text, fontFamily: "monospace" }}>
                            {a.scheduled_at ? fmtTime(a.scheduled_at) : "—"}
                          </span>
                        </div>
                        <div style={{ width: 3, borderRadius: 2, background: t.color, flexShrink: 0, alignSelf: "stretch" }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{
                            margin: 0, fontSize: 13, fontWeight: 500, color: FOUNDRY.text,
                            textDecoration: done ? "line-through" : "none",
                          }}>
                            {a.title}
                          </p>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                            <Icon size={10} color={t.color} />
                            <span style={{ fontSize: 10, color: t.color }}>{t.label}</span>
                            {c && (
                              <Link href={`/clients/${c.id}`} style={{ fontSize: 10, color: FOUNDRY.muted, textDecoration: "none" }}>
                                · {c.name || c.email.split("@")[0]}
                              </Link>
                            )}
                          </div>
                        </div>
                        {!done && c && (
                          <button onClick={() => onComplete(c.id, a.id)} title="완료" style={{
                            width: 24, height: 24, borderRadius: 4, flexShrink: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            background: "transparent", border: `1px solid ${FOUNDRY.border}`,
                            color: FOUNDRY.muted, cursor: "pointer", alignSelf: "center",
                          }}>
                            <Check size={12} />
                          </button>
                        )}
                        {done && (
                          <span style={{ fontSize: 10, color: FOUNDRY.success, alignSelf: "center", flexShrink: 0 }}>
                            <Check size={14} />
                          </span>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Upcoming section */}
          {upcoming.length > 0 && (
            <div style={{
              padding: "14px 20px", borderTop: `1px solid ${FOUNDRY.border}`,
              background: FOUNDRY.card,
            }}>
              <p style={{ margin: "0 0 10px", fontSize: 10, fontWeight: 600, color: FOUNDRY.muted, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                다가오는 일정
              </p>
              {upcoming.map(a => {
                const t = TYPE[a.activity_type as keyof typeof TYPE] || TYPE.other;
                const c = cMap[a.client_user_id];
                return (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: t.color, flexShrink: 0 }} />
                    <p style={{ margin: 0, fontSize: 11, color: FOUNDRY.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {a.title}
                      {c && <span style={{ color: FOUNDRY.muted }}> · {c.name || c.email.split("@")[0]}</span>}
                    </p>
                    <span style={{ fontSize: 10, color: FOUNDRY.muted, flexShrink: 0 }}>
                      {a.scheduled_at && relDate(a.scheduled_at)}
                    </span>
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
