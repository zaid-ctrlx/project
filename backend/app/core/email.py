"""Outbound email over SMTP. Sync and best-effort: callers schedule it as a
background task, and a failure is logged rather than raised so it can't break
the request that triggered it. With SMTP_HOST unset (local dev) the message is
printed to the server console instead, so the OTP flow works without a mail
account."""

import logging
import smtplib
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger("uvicorn.error")


def send_email(to: str, subject: str, body: str) -> None:
    if not settings.SMTP_HOST:
        logger.warning("[DEV EMAIL - SMTP not configured]\nTo: %s\nSubject: %s\n%s", to, subject, body)
        return

    # A user without a password (e.g. halfway through setting up Gmail) would
    # only fail at login. Fall back to the console, but say loudly why - this
    # must not look like a normal dev setup if it happens in production.
    if settings.SMTP_USER and not settings.SMTP_PASSWORD:
        logger.error(
            "SMTP_USER is set but SMTP_PASSWORD is empty - email NOT sent, printing instead.\n"
            "To: %s\nSubject: %s\n%s", to, subject, body,
        )
        return

    msg = EmailMessage()
    msg["From"] = settings.SMTP_FROM or settings.SMTP_USER
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)

    try:
        if settings.SMTP_PORT == 465:
            server: smtplib.SMTP = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15)
        else:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15)
            server.starttls()
        with server:
            if settings.SMTP_USER:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
    except Exception:
        logger.exception("Failed to send email to %s", to)
