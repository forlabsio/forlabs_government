from __future__ import annotations
# backend/app/email_service.py
import logging
from datetime import date

import resend

from app.config import settings

logger = logging.getLogger(__name__)


def init_resend():
    if settings.resend_api_key:
        resend.api_key = settings.resend_api_key


def _fmt_krw(v: int) -> str:
    if v >= 1_000_000_000_000:
        return f"{v / 1_000_000_000_000:.1f}조원"
    if v >= 100_000_000:
        return f"{v / 100_000_000:.1f}억원"
    if v >= 10_000:
        return f"{round(v / 10_000):,}만원"
    return f"{v:,}원"


def send_verification_email(to_email: str, code: str) -> str | None:
    """Send 6-digit verification code to the given email."""
    if not settings.resend_api_key:
        logger.warning("Resend API key not set, skipping verification email")
        return None

    init_resend()

    html = f"""
    <div style="max-width:600px; margin:0 auto; font-family:-apple-system,BlinkMacSystemFont,sans-serif;">
        <div style="background:#2563EB; padding:24px; border-radius:12px 12px 0 0;">
            <h1 style="color:white; margin:0; font-size:20px;">이메일 인증</h1>
        </div>
        <div style="padding:32px 24px; background:#f9fafb; text-align:center;">
            <p style="font-size:16px; color:#374151; margin-bottom:24px;">
                아래 인증코드를 입력해주세요
            </p>
            <div style="background:white; border:2px solid #2563EB; border-radius:12px;
                        padding:20px; display:inline-block; letter-spacing:8px;
                        font-size:32px; font-weight:bold; color:#2563EB;">
                {code}
            </div>
            <p style="font-size:14px; color:#6b7280; margin-top:24px;">
                이 코드는 10분간 유효합니다.
            </p>
        </div>
        <div style="padding:16px; text-align:center; color:#9ca3af; font-size:12px;">
            <p>이 메일은 Danbi에서 발송되었습니다.</p>
        </div>
    </div>
    """

    try:
        result = resend.Emails.send({
            "from": "Danbi <noreply@forlabs.io>",
            "to": [to_email],
            "subject": f"[단비] 이메일 인증코드: {code}",
            "html": html,
        })
        logger.info(f"Verification email sent to {to_email}: {result}")
        return result.get("id")
    except Exception as e:
        logger.error(f"Failed to send verification email to {to_email}: {e}")
        return None


def send_invite_email(to_email: str, consultant_name: str, token: str) -> str | None:
    if not settings.resend_api_key:
        logger.warning("Resend API key not set, skipping invite email")
        return None

    init_resend()
    invite_url = f"https://danbi.forlabs.io/invite/{token}"

    html = f"""
    <div style="max-width:600px; margin:0 auto; font-family:-apple-system,BlinkMacSystemFont,sans-serif;">
        <div style="background:#1e40af; padding:24px; border-radius:12px 12px 0 0;">
            <h1 style="color:white; margin:0; font-size:20px;">단비에 초대되었습니다</h1>
        </div>
        <div style="padding:32px 24px; background:#f9fafb;">
            <p style="font-size:16px; color:#374151; margin-bottom:8px;">
                <strong>{consultant_name}</strong>님이 단비를 통해 맞춤 지원사업을 찾아드립니다.
            </p>
            <p style="font-size:14px; color:#6b7280; margin-bottom:24px;">
                아래 버튼을 클릭하면 귀사에 맞는 정부지원사업을 바로 탐색할 수 있습니다.
            </p>
            <div style="text-align:center; margin:24px 0;">
                <a href="{invite_url}" style="display:inline-block; background:#2563EB; color:white; font-size:14px; font-weight:600; padding:13px 32px; border-radius:8px; text-decoration:none;">
                    단비 시작하기
                </a>
            </div>
            <p style="font-size:12px; color:#9ca3af; text-align:center;">이 초대는 7일 후 만료됩니다.</p>
        </div>
        <div style="padding:16px; text-align:center; color:#9ca3af; font-size:12px;">
            <p>이 메일은 Danbi에서 발송되었습니다.</p>
        </div>
    </div>
    """

    try:
        result = resend.Emails.send({
            "from": "Danbi <noreply@forlabs.io>",
            "to": [to_email],
            "subject": f"[단비] {consultant_name}님이 맞춤 지원사업을 찾아드립니다",
            "html": html,
        })
        logger.info("Invite email sent to %s: %s", to_email, result)
        return result.get("id")
    except Exception as e:
        logger.error("Failed to send invite email to %s: %s", to_email, e)
        return None


def _render_grant_card(item: tuple, today: date, is_urgent: bool = False) -> str:
    """Render a single grant card for the email."""
    grant, score, checklist, confidence = item

    # D-day badge
    dday_html = ""
    if grant.end_date:
        days = (grant.end_date - today).days
        if days <= 0:
            dday_color = "#dc2626"
            dday_text = "마감임박"
        elif days <= 7:
            dday_color = "#dc2626"
            dday_text = f"D-{days}"
        elif days <= 30:
            dday_color = "#d97706"
            dday_text = f"D-{days}"
        else:
            dday_color = "#6b7280"
            dday_text = f"D-{days}"
        dday_html = f'<span style="background:{dday_color}15; color:{dday_color}; font-size:11px; font-weight:700; padding:2px 8px; border-radius:4px; margin-right:6px;">{dday_text}</span>'

    # Amount
    amount_html = ""
    if grant.amount_max:
        amount_html = f'<span style="color:#2563EB; font-weight:700; font-size:13px;">{_fmt_krw(grant.amount_max)}</span>'

    # Eligibility score badge
    score_color = "#16a34a" if score >= 80 else "#d97706" if score >= 60 else "#6b7280"
    score_html = f'<span style="background:{score_color}15; color:{score_color}; font-size:11px; font-weight:700; padding:2px 8px; border-radius:4px;">적격성 {int(score)}%</span>'

    # Checklist — show top 4 items (pass first, then fail)
    checklist_items = sorted(checklist, key=lambda c: (0 if c.status == "pass" else 1 if c.status == "fail" else 2))[:4]
    checklist_html = ""
    for c in checklist_items:
        if c.status == "pass":
            icon, color = "✓", "#16a34a"
        elif c.status == "fail":
            icon, color = "✗", "#dc2626"
        else:
            icon, color = "·", "#9ca3af"
        checklist_html += f'<span style="color:{color}; font-size:11px; margin-right:12px;">{icon} {c.message}</span>'

    border_color = "#fee2e2" if is_urgent else "#e5e7eb"
    left_border = f"border-left:3px solid {('#dc2626' if is_urgent else '#2563EB')};"

    return f"""
    <div style="border:1px solid {border_color}; {left_border} border-radius:8px; padding:16px; margin-bottom:12px; background:white;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:4px;">
            <div>{dday_html}{score_html}</div>
            {amount_html}
        </div>
        <h3 style="margin:0 0 4px; font-size:15px; color:#111827; line-height:1.4;">{grant.title or ''}</h3>
        <p style="margin:0 0 10px; font-size:13px; color:#6b7280;">{grant.organization or ''}{' · ' + (grant.category or '') if grant.category else ''}</p>
        <div style="border-top:1px solid #f3f4f6; padding-top:8px; flex-wrap:wrap;">
            {checklist_html}
        </div>
        <div style="margin-top:8px;">
            <a href="https://danbi.forlabs.io/grants/{grant.id}" style="color:#2563EB; font-size:12px; text-decoration:none;">상세보기 →</a>
        </div>
    </div>
    """


def send_briefing_email(
    to_email: str,
    company_label: str,
    available_count: int,
    urgent_grants: list,
    new_grants: list,
    top_grants: list,
    total_opportunity_krw: int,
    missing_fields: list[str],
) -> str | None:
    """Send personalized daily briefing email using eligibility-scored grants."""
    if not settings.resend_api_key:
        logger.warning("Resend API key not set, skipping briefing email")
        return None

    init_resend()
    today = date.today()
    date_label = today.strftime("%Y년 %m월 %d일 (%a)").replace(
        "Mon", "월").replace("Tue", "화").replace("Wed", "수").replace(
        "Thu", "목").replace("Fri", "금").replace("Sat", "토").replace("Sun", "일")

    urgent_count = len(urgent_grants)

    # ── Stats row ──
    stats_html = f"""
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
        <tr>
            <td style="text-align:center; padding:16px; background:#f0f9ff; border-radius:8px; width:33%;">
                <div style="font-size:28px; font-weight:800; color:#2563EB;">{available_count}</div>
                <div style="font-size:12px; color:#6b7280; margin-top:2px;">신청 가능 과제</div>
            </td>
            <td style="width:12px;"></td>
            <td style="text-align:center; padding:16px; background:#fff5f5; border-radius:8px; width:33%;">
                <div style="font-size:28px; font-weight:800; color:#dc2626;">{urgent_count}</div>
                <div style="font-size:12px; color:#6b7280; margin-top:2px;">7일 이내 마감</div>
            </td>
            <td style="width:12px;"></td>
            <td style="text-align:center; padding:16px; background:#f0fdf4; border-radius:8px; width:33%;">
                <div style="font-size:22px; font-weight:800; color:#16a34a;">{_fmt_krw(total_opportunity_krw) if total_opportunity_krw else '-'}</div>
                <div style="font-size:12px; color:#6b7280; margin-top:2px;">총 지원 기회액</div>
            </td>
        </tr>
    </table>
    """

    # ── Urgent section ──
    urgent_section = ""
    if urgent_grants:
        cards = "".join(_render_grant_card(item, today, is_urgent=True) for item in urgent_grants)
        urgent_section = f"""
        <div style="margin-bottom:24px;">
            <h2 style="font-size:15px; font-weight:700; color:#dc2626; margin:0 0 12px; display:flex; align-items:center; gap:6px;">
                🔴 마감임박 — 지금 바로 확인하세요
            </h2>
            {cards}
        </div>
        """

    # ── New / Top grants section ──
    display_grants = new_grants if new_grants else top_grants
    section_title = "📬 이번 주 신규 등록 과제" if new_grants else "⭐ 귀사 적합도 상위 과제"
    grant_cards = "".join(_render_grant_card(item, today) for item in display_grants)
    grants_section = f"""
    <div style="margin-bottom:24px;">
        <h2 style="font-size:15px; font-weight:700; color:#111827; margin:0 0 12px;">{section_title}</h2>
        {grant_cards}
    </div>
    """

    # ── Profile nudge ──
    profile_nudge = ""
    if missing_fields:
        fields_str = ", ".join(missing_fields)
        profile_nudge = f"""
        <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:14px; margin-bottom:24px;">
            <p style="margin:0; font-size:13px; color:#92400e;">
                💡 <strong>프로필 완성도를 높이면 더 정확한 매칭이 가능합니다.</strong><br>
                미입력 항목: {fields_str}
                &nbsp;<a href="https://danbi.forlabs.io/mypage" style="color:#2563EB; text-decoration:none; font-weight:600;">지금 입력하기 →</a>
            </p>
        </div>
        """

    html = f"""
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0; padding:0; background:#f3f4f6; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6; padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%;">

    <!-- Header -->
    <tr><td style="background:#1e40af; border-radius:12px 12px 0 0; padding:24px 28px;">
        <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
                <td>
                    <div style="font-size:20px; font-weight:800; color:white; letter-spacing:-0.5px;">Danbi</div>
                    <div style="font-size:12px; color:#93c5fd; margin-top:2px;">정부 R&D 데이터 인텔리전스</div>
                </td>
                <td align="right">
                    <div style="font-size:12px; color:#93c5fd;">{date_label}</div>
                </td>
            </tr>
        </table>
        <div style="margin-top:16px; padding-top:16px; border-top:1px solid rgba(255,255,255,0.15);">
            <div style="font-size:18px; font-weight:700; color:white;">{company_label}</div>
            <div style="font-size:13px; color:#bfdbfe; margin-top:4px;">맞춤 과제 브리핑 — 귀사 프로필 기준 적격성 {60}% 이상 과제</div>
        </div>
    </td></tr>

    <!-- Body -->
    <tr><td style="background:white; padding:24px 28px; border-radius:0 0 12px 12px;">

        {stats_html}
        {urgent_section}
        {grants_section}
        {profile_nudge}

        <!-- CTA -->
        <div style="text-align:center; padding:8px 0 16px;">
            <a href="https://danbi.forlabs.io" style="display:inline-block; background:#2563EB; color:white; font-size:14px; font-weight:600; padding:13px 32px; border-radius:8px; text-decoration:none;">
                Danbi에서 전체 과제 보기
            </a>
        </div>

    </td></tr>

    <!-- Footer -->
    <tr><td style="padding:16px 28px; text-align:center;">
        <p style="font-size:11px; color:#9ca3af; margin:0;">이 메일은 Danbi에서 발송되었습니다.</p>
        <p style="font-size:11px; color:#9ca3af; margin:4px 0 0;">
            <a href="https://danbi.forlabs.io/mypage" style="color:#9ca3af;">수신 설정 변경</a>
        </p>
    </td></tr>

</table>
</td></tr>
</table>
</body>
</html>
    """

    try:
        result = resend.Emails.send({
            "from": "Danbi <noreply@forlabs.io>",
            "to": [to_email],
            "subject": f"[단비] {company_label} — 오늘의 맞춤 과제 {available_count}건 ({_fmt_krw(total_opportunity_krw) if total_opportunity_krw else ''})",
            "html": html,
        })
        logger.info(f"Briefing email sent to {to_email}: {result}")
        return result.get("id")
    except Exception as e:
        logger.error(f"Failed to send briefing email to {to_email}: {e}")
        return None


# kept for backwards compatibility
def send_curation_email(
    to_email: str,
    user_name: str | None,
    grants: list[dict],
    today: date | None = None,
    matched_count: int | None = None,
    total_count: int | None = None,
) -> str | None:
    """Legacy: plain grant list email. Prefer send_briefing_email."""
    if not settings.resend_api_key:
        return None

    init_resend()
    today = today or date.today()
    name = user_name or "회원"

    grants_html = ""
    for g in grants[:10]:
        d_day = ""
        if g.get("end_date"):
            days = (g["end_date"] - today).days
            d_day = f"D-{days}" if days > 0 else "마감임박"
        amount = ""
        if g.get("amount_max"):
            amount = f"최대 {_fmt_krw(g['amount_max'])}"

        grants_html += f"""
        <div style="border:1px solid #e5e7eb; border-radius:12px; padding:16px; margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="background:#2563EB; color:white; padding:2px 8px; border-radius:6px; font-size:12px;">{g.get('category', '')}</span>
                <span style="color:#dc2626; font-weight:bold; font-size:14px;">{d_day}</span>
            </div>
            <h3 style="margin:8px 0 4px; font-size:16px;">{g['title']}</h3>
            <p style="color:#6b7280; font-size:14px; margin:0;">{g.get('organization', '')} {amount}</p>
            <a href="{g.get('detail_url', '#')}" style="color:#2563EB; font-size:14px; text-decoration:none;">자세히 보기 →</a>
        </div>
        """

    html = f"""
    <div style="max-width:600px; margin:0 auto; font-family:-apple-system,BlinkMacSystemFont,sans-serif;">
        <div style="background:#2563EB; padding:24px; border-radius:12px 12px 0 0;">
            <h1 style="color:white; margin:0; font-size:20px;">오늘의 맞춤 지원사업</h1>
            <p style="color:#93c5fd; margin:4px 0 0; font-size:14px;">{today.strftime('%Y년 %m월 %d일')}</p>
        </div>
        <div style="padding:24px; background:#f9fafb;">
            <p style="font-size:16px; color:#374151;">안녕하세요 {name}님,</p>
            {grants_html}
            <div style="text-align:center; margin-top:24px;">
                <a href="https://danbi.forlabs.io/grants" style="background:#2563EB; color:white; padding:12px 24px; border-radius:8px; text-decoration:none; font-size:14px;">더 많은 지원사업 보기</a>
            </div>
        </div>
        <div style="padding:16px; text-align:center; color:#9ca3af; font-size:12px;">
            <p>이 메일은 Danbi에서 발송되었습니다.</p>
            <a href="https://danbi.forlabs.io/mypage" style="color:#9ca3af;">수신 설정 변경</a>
        </div>
    </div>
    """

    try:
        result = resend.Emails.send({
            "from": "Danbi <noreply@forlabs.io>",
            "to": [to_email],
            "subject": f"[단비] {name}님을 위한 오늘의 맞춤 지원사업 ({len(grants)}건)",
            "html": html,
        })
        return result.get("id")
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        return None
