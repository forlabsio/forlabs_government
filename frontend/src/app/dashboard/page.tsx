"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import {
  fetchDashboardFeed, fetchClients, fetchCalendarActivities,
  type DashboardActivity, type ClientSummary, type ClientActivityItem,
} from "@/lib/api";
import { FOUNDRY } from "@/lib/theme";
import { Users, Activity, Calendar, UserPlus, ArrowRight, Phone, Mail, MapPin, Clock, FileText } from "lucide-react";

const ACTIVITY_ICONS: Record<string, typeof Phone> = {
  meeting: Calendar, call: Phone, email: Mail, visit: MapPin, note: FileText, other: Clock,
};

const EVENT_DOT: Record<string, string> = {
  client_interest: FOUNDRY.success,
  pipeline_moved: FOUNDRY.primary,
  invite_accepted: "#f97316",
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [feed, setFeed] = useState<DashboardActivity[]>([]);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [upcoming, setUpcoming] = useState<ClientActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("govgrants_token");
    if (!token) return;
    Promise.all([fetchDashboardFeed(token), fetchClients(token), fetchCalendarActivities(token)])
      .then(([f, c, a]) => {
        setFeed(f);
        setClients(c);
        // upcoming: scheduled, not completed, future
        const now = new Date();
        setUpcoming(a.filter((x) => x.scheduled_at && !x.completed_at && new Date(x.scheduled_at) >= now).slice(0, 5));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (user?.role !== "consultant" && !user?.is_admin) {
    return <div style={{ padding: 40, textAlign: "center", color: FOUNDRY.muted }}>컨설턴트만 접근할 수 있는 페이지입니다.</div>;
  }

  const activeClients = clients.filter((c) => c.interest_count > 0).length;
  const pendingOnboard = clients.filter((c) => !c.onboarding_completed).length;

  return (
    <div style={{ padding: "24px 32px" }}>
      {/* ── Stats ──────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
        {[
          { label: "전체 고객", value: clients.length, color: FOUNDRY.text },
          { label: "활성 고객", value: activeClients, color: FOUNDRY.primary },
          { label: "온보딩 대기", value: pendingOnboard, color: FOUNDRY.warning },
          { label: "최근 활동", value: feed.length, color: FOUNDRY.success },
        ].map((s) => (
          <div key={s.label} style={{
            padding: "16px 18px", background: FOUNDRY.card,
            border: `1px solid ${FOUNDRY.border}`, borderRadius: 8,
          }}>
            <p style={{ fontSize: 11, color: FOUNDRY.muted, margin: "0 0 6px", letterSpacing: "0.05em", textTransform: "uppercase" }}>{s.label}</p>
            <p style={{ fontSize: 26, fontWeight: 700, color: s.color, margin: 0, fontFamily: "monospace" }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 }}>
        {/* ── Left: Activity feed ───────────────────────────── */}
        <div>
          <p style={{ fontSize: 10, color: FOUNDRY.muted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>
            고객 활동
          </p>

          {loading ? (
            <div style={{ color: FOUNDRY.muted, fontSize: 13, padding: 20 }}>불러오는 중...</div>
          ) : feed.length === 0 ? (
            <div style={{
              padding: "52px 24px", textAlign: "center",
              background: FOUNDRY.card, border: `1px solid ${FOUNDRY.border}`, borderRadius: 10,
            }}>
              <UserPlus size={28} color={FOUNDRY.muted} style={{ marginBottom: 10 }} />
              <p style={{ color: FOUNDRY.text, fontSize: 14, fontWeight: 600, margin: "0 0 4px" }}>아직 고객 활동이 없습니다</p>
              <p style={{ color: FOUNDRY.muted, fontSize: 12, margin: "0 0 16px" }}>고객을 초대하면 활동이 여기에 표시됩니다.</p>
              <Link href="/clients" style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "9px 18px", background: FOUNDRY.primary, color: "white",
                borderRadius: 7, fontSize: 13, fontWeight: 600, textDecoration: "none",
              }}>
                <UserPlus size={13} /> 고객 초대
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {feed.map((item) => (
                <div key={item.id} style={{
                  padding: "11px 14px", background: FOUNDRY.card,
                  borderBottom: `1px solid ${FOUNDRY.border}`,
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <div style={{
                    width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                    background: EVENT_DOT[item.type] || FOUNDRY.muted,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, color: FOUNDRY.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.title}
                    </p>
                    {item.body && <p style={{ margin: "1px 0 0", fontSize: 11, color: FOUNDRY.muted }}>{item.body}</p>}
                  </div>
                  <span style={{ fontSize: 10, color: FOUNDRY.muted, flexShrink: 0 }}>
                    {item.created_at ? new Date(item.created_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric" }) : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: Upcoming + Quick links ──────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Upcoming schedule */}
          <div style={{ background: FOUNDRY.card, border: `1px solid ${FOUNDRY.border}`, borderRadius: 10, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <p style={{ fontSize: 10, color: FOUNDRY.muted, letterSpacing: "0.12em", textTransform: "uppercase", margin: 0 }}>다가오는 일정</p>
              <Link href="/calendar" style={{ fontSize: 11, color: FOUNDRY.primary, textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}>
                전체 <ArrowRight size={11} />
              </Link>
            </div>
            {upcoming.length === 0 ? (
              <p style={{ color: FOUNDRY.muted, fontSize: 12, margin: 0 }}>예정된 일정이 없습니다.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {upcoming.map((a) => {
                  const Icon = ACTIVITY_ICONS[a.activity_type] || Clock;
                  return (
                    <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Icon size={13} color={FOUNDRY.primary} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 12, color: FOUNDRY.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</p>
                      </div>
                      <span style={{ fontSize: 10, color: FOUNDRY.muted, flexShrink: 0 }}>
                        {a.scheduled_at ? new Date(a.scheduled_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric" }) : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick nav */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              { href: "/clients", icon: Users, label: "내 고객", desc: `${clients.length}명 관리 중` },
              { href: "/calendar", icon: Calendar, label: "일정", desc: `${upcoming.length}건 예정` },
              { href: "/matching", icon: Activity, label: "자동 매칭", desc: "지원사업 탐색" },
            ].map((nav) => (
              <Link key={nav.href} href={nav.href} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                background: FOUNDRY.card, border: `1px solid ${FOUNDRY.border}`, borderRadius: 8,
                textDecoration: "none", transition: "border-color 0.15s",
              }}>
                <nav.icon size={16} color={FOUNDRY.primary} />
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: FOUNDRY.text }}>{nav.label}</p>
                  <p style={{ margin: 0, fontSize: 11, color: FOUNDRY.muted }}>{nav.desc}</p>
                </div>
                <ArrowRight size={14} color={FOUNDRY.muted} />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
