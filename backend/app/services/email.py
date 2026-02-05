"""Send emails (verification code) via SMTP. From Path2ai.tech when configured."""

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger(__name__)

# Avoid blocking the request forever if SMTP is slow or unreachable
SMTP_TIMEOUT_SECONDS = 15


def _logo_url() -> str:
    if settings.EMAIL_LOGO_URL:
        return settings.EMAIL_LOGO_URL
    base = settings.FRONTEND_BASE_URL.rstrip("/")
    return f"{base}/logo-path.png"


def send_verification_code_email(to_email: str, code: str, expire_minutes: int = 15) -> bool:
    """
    Send 6-digit verification code email. From SMTP_FROM_EMAIL (e.g. noreply@path2ai.tech).
    Returns True if sent, False if SMTP not configured or send failed.
    """
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        logger.warning("SMTP not configured (SMTP_HOST/SMTP_USER). Skipping send.")
        return False

    logo_url = _logo_url()
    subject = "Your verification code - Path Boarding"
    html = f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
  <p style="margin-bottom: 24px;">
    <img src="{logo_url}" alt="Path" width="140" height="40" style="display: block;" />
  </p>
  <p style="font-size: 16px; color: #1a1a1a; line-height: 1.5;">
    You started signing up for Path Boarding. Use the code below to verify your email address.
  </p>
  <p style="margin: 24px 0; font-size: 28px; font-weight: 600; letter-spacing: 0.2em; color: #297D2D;">
    {code}
  </p>
  <p style="font-size: 14px; color: #737373;">
    Enter this code on the verification screen. It expires in {expire_minutes} minutes.
  </p>
  <p style="font-size: 14px; color: #737373;">
    If you didn't request this, you can ignore this email.
  </p>
  <p style="font-size: 12px; color: #a3a3a3; margin-top: 32px;">
    Path2ai.tech
  </p>
</body>
</html>
"""
    text = (
        "You started signing up for Path Boarding.\n\n"
        f"Your verification code is: {code}\n\n"
        f"Enter it on the verification screen. The code expires in {expire_minutes} minutes.\n\n"
        "If you didn't request this, you can ignore this email.\n\n"
        "Path2ai.tech"
    )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
    msg["To"] = to_email
    msg.attach(MIMEText(text, "plain"))
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(
            settings.SMTP_HOST, settings.SMTP_PORT, timeout=SMTP_TIMEOUT_SECONDS
        ) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM_EMAIL, [to_email], msg.as_string())
        logger.info("Verification code email sent to %s", to_email)
        return True
    except smtplib.SMTPAuthenticationError as e:
        logger.exception("SMTP login failed for %s: %s", to_email, e)
        return False
    except (OSError, TimeoutError) as e:
        logger.exception("SMTP connection error (timeout or network) for %s: %s", to_email, e)
        return False
    except Exception as e:
        logger.exception("Failed to send verification email to %s: %s", to_email, e)
        return False
