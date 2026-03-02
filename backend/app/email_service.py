# backend/app/email_service.py
import logging
from datetime import date

import resend

from app.config import settings

logger = logging.getLogger(__name__)


def init_resend():
    if settings.resend_api_key:
        resend.api_key = settings.resend_api_key


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
            <p>이 메일은 GovGrants에서 발송되었습니다.</p>
        </div>
    </div>
    """

    try:
        result = resend.Emails.send({
            "from": "GovGrants <noreply@forlabs.io>",
            "to": [to_email],
            "subject": f"[GovGrants] 이메일 인증코드: {code}",
            "html": html,
        })
        logger.info(f"Verification email sent to {to_email}: {result}")
        return result.get("id")
    except Exception as e:
        logger.error(f"Failed to send verification email to {to_email}: {e}")
        return None


def send_curation_email(
    to_email: str,
    user_name: str | None,
    grants: list[dict],
    today: date | None = None,
    matched_count: int | None = None,
    total_count: int | None = None,
) -> str | None:
    """Send daily curation email with matched grants."""
    if not settings.resend_api_key:
        logger.warning("Resend API key not set, skipping email")
        return None

    init_resend()
    today = today or date.today()
    name = user_name or "회원"

    grants_html = ""
    for g in grants[:10]:  # Max 10 grants per email
        d_day = ""
        if g.get("end_date"):
            days = (g["end_date"] - today).days
            d_day = f"D-{days}" if days > 0 else "마감임박"

        amount = ""
        if g.get("amount_max"):
            if g["amount_max"] >= 100_000_000:
                amount = f"최대 {g['amount_max'] // 100_000_000}억원"
            elif g["amount_max"] >= 10_000:
                amount = f"최대 {g['amount_max'] // 10_000:,}만원"

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
            <p style="font-size:14px; color:#6b7280;">{"오늘 등록된 " + str(total_count) + "개 사업 중, <strong>" + name + "</strong>이 지원 가능한 사업은 <strong style='color:#2563EB'>" + str(matched_count) + "개</strong>입니다." if matched_count and total_count else "회원님의 기업 프로필에 맞는 새로운 지원사업을 찾았습니다."}</p>
            {grants_html}
            <div style="text-align:center; margin-top:24px;">
                <a href="https://govgrants.kr/grants" style="background:#2563EB; color:white; padding:12px 24px; border-radius:8px; text-decoration:none; font-size:14px;">더 많은 지원사업 보기</a>
            </div>
        </div>
        <div style="padding:16px; text-align:center; color:#9ca3af; font-size:12px;">
            <p>이 메일은 GovGrants에서 발송되었습니다.</p>
            <a href="https://govgrants.kr/mypage" style="color:#9ca3af;">수신 설정 변경</a>
        </div>
    </div>
    """

    try:
        result = resend.Emails.send({
            "from": "GovGrants <noreply@forlabs.io>",
            "to": [to_email],
            "subject": f"[GovGrants] {name}님을 위한 오늘의 맞춤 지원사업 ({len(grants)}건)",
            "html": html,
        })
        logger.info(f"Curation email sent to {to_email}: {result}")
        return result.get("id")
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        return None
