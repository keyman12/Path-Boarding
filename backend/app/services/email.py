"""Send emails (verification code, completion) via SMTP. From Path2ai.tech when configured."""

import logging
import os
import smtplib
from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

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
    <img src="{logo_url}" alt="Path" width="140" height="48" style="display: block;" />
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


def send_save_for_later_email(to_email: str, user_name: str) -> bool:
    """
    Send 'save for later' email with link to login page.
    Returns True if sent, False if SMTP not configured or send failed.
    """
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        logger.warning("SMTP not configured (SMTP_HOST/SMTP_USER). Skipping send.")
        return False

    logo_url = _logo_url()
    login_url = f"{settings.FRONTEND_BASE_URL.rstrip('/')}/board"
    
    subject = "Continue your Path Boarding application"
    html = f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
  <p style="margin-bottom: 24px;">
    <img src="{logo_url}" alt="Path" width="140" height="48" style="display: block;" />
  </p>
  <p style="font-size: 16px; color: #1a1a1a; line-height: 1.5;">
    Dear {user_name},
  </p>
  <p style="font-size: 16px; color: #1a1a1a; line-height: 1.5; margin-top: 16px;">
    Your progress has been saved. You can return at any time within the next 14 days to complete your Path financial services application.
  </p>
  <p style="margin: 24px 0;">
    <a href="{login_url}" style="display: inline-block; padding: 12px 24px; background-color: #297D2D; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
      Continue Boarding
    </a>
  </p>
  <p style="font-size: 14px; color: #737373; margin-top: 24px;">
    If you have any questions, please don't hesitate to reach out.
  </p>
  <p style="font-size: 14px; color: #1a1a1a; margin-top: 24px;">
    Sincerely,<br/>
    The Path Team
  </p>
  <p style="font-size: 12px; color: #a3a3a3; margin-top: 32px;">
    Path2ai.tech
  </p>
</body>
</html>
"""
    text = f"""
Dear {user_name},

Your progress has been saved. You can return at any time within the next 14 days to complete your Path financial services application.

Please use the link below to continue your boarding:
{login_url}

If you have any questions, please don't hesitate to reach out.

Sincerely,
The Path Team

Path2ai.tech
"""

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
        logger.info("Save for later email sent to %s", to_email)
        return True
    except smtplib.SMTPAuthenticationError as e:
        logger.exception("SMTP login failed for %s: %s", to_email, e)
        return False
    except (OSError, TimeoutError) as e:
        logger.exception("SMTP connection error (timeout or network) for %s: %s", to_email, e)
        return False
    except Exception as e:
        logger.exception("Failed to send save for later email to %s: %s", to_email, e)
        return False


def send_completion_email(
    to_email: str,
    merchant_name: str,
    portal_url: str,
    pdf_path: str,
) -> bool:
    """
    Send completion email with Merchant Agreement PDF and Services Agreement attached.
    Thanks merchant by name, advises attachments for reference, link to portal, support email.
    Returns True if sent, False if SMTP not configured or send failed.
    """
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        logger.warning("SMTP not configured (SMTP_HOST/SMTP_USER). Skipping completion email.")
        return False

    logo_url = _logo_url()
    support_email = "support@path2ai.tech"
    display_name = (merchant_name or "Merchant").strip() or "Merchant"

    subject = "Your Path application is complete"
    html = f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
  <p style="margin-bottom: 24px;">
    <img src="{logo_url}" alt="Path" width="140" height="48" style="display: block;" />
  </p>
  <p style="font-size: 16px; color: #1a1a1a; line-height: 1.5;">
    Dear {display_name},
  </p>
  <p style="font-size: 16px; color: #1a1a1a; line-height: 1.5; margin-top: 16px;">
    Thank you for completing your Path application. Your agreement documents are attached to this email for your reference.
  </p>
  <p style="font-size: 16px; color: #1a1a1a; line-height: 1.5; margin-top: 16px;">
    If you would like to access your documents online, you can do so by clicking the link below:
  </p>
  <p style="margin: 24px 0;">
    <a href="{portal_url}" style="display: inline-block; padding: 12px 24px; background-color: #297D2D; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
      Access Your Portal
    </a>
  </p>
  <p style="font-size: 14px; color: #737373; margin-top: 24px;">
    If you have any questions or issues, please contact us at <a href="mailto:{support_email}">{support_email}</a>.
  </p>
  <p style="font-size: 14px; color: #1a1a1a; margin-top: 24px;">
    Sincerely,<br/>
    The Path Team
  </p>
  <p style="font-size: 12px; color: #a3a3a3; margin-top: 32px;">
    Path2ai.tech
  </p>
</body>
</html>
"""
    text = f"""
Dear {display_name},

Thank you for completing your Path application. Your agreement documents are attached to this email for your reference.

If you would like to access your documents online, you can do so by visiting:
{portal_url}

If you have any questions or issues, please contact us at {support_email}.

Sincerely,
The Path Team

Path2ai.tech
"""

    # Use multipart/mixed with multipart/alternative for body so client shows one body (not duplicated)
    msg = MIMEMultipart("mixed")
    msg["Subject"] = subject
    msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
    msg["To"] = to_email

    body_part = MIMEMultipart("alternative")
    body_part.attach(MIMEText(text, "plain"))
    body_part.attach(MIMEText(html, "html"))
    msg.attach(body_part)

    # Attach Merchant Agreement PDF
    if os.path.isfile(pdf_path):
        with open(pdf_path, "rb") as f:
            part = MIMEBase("application", "pdf")
            part.set_payload(f.read())
            encoders.encode_base64(part)
            part.add_header("Content-Disposition", "attachment", filename="Path-Merchant-Agreement.pdf")
            msg.attach(part)

    # Attach Services Agreement (same path as /boarding/services-agreement endpoint)
    backend_root = Path(__file__).resolve().parent.parent.parent
    services_path = backend_root / settings.SERVICES_AGREEMENT_PATH
    if services_path.exists():
        with open(services_path, "rb") as f:
            part = MIMEBase("application", "pdf")
            part.set_payload(f.read())
            encoders.encode_base64(part)
            part.add_header("Content-Disposition", "attachment", filename="Services-Agreement.pdf")
            msg.attach(part)
    else:
        logger.warning("Services Agreement not found at %s, skipping attachment", services_path)

    try:
        with smtplib.SMTP(
            settings.SMTP_HOST, settings.SMTP_PORT, timeout=SMTP_TIMEOUT_SECONDS
        ) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM_EMAIL, [to_email], msg.as_string())
        logger.info("Completion email sent to %s", to_email)
        return True
    except smtplib.SMTPAuthenticationError as e:
        logger.exception("SMTP login failed for %s: %s", to_email, e)
        return False
    except (OSError, TimeoutError) as e:
        logger.exception("SMTP connection error for %s: %s", to_email, e)
        return False
    except Exception as e:
        logger.exception("Failed to send completion email to %s: %s", to_email, e)
        return False
