"""
Outbound email (invitations, password recovery).

If SMTP is not configured nothing is sent and the caller is told so. The
service never pretends a message was delivered: an administrator can then
hand the one-time link to the user through another channel.
"""

from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from .config import get_settings

log = logging.getLogger("cxt.mail")


def send(to: str, subject: str, body: str) -> bool:
    s = get_settings()
    if not s.email_configured:
        log.warning("email not configured; message to %s not sent (%s)", to, subject)
        return False
    msg = EmailMessage()
    msg["From"], msg["To"], msg["Subject"] = s.smtp_from, to, subject
    msg.set_content(body)
    try:
        with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=20) as smtp:
            smtp.starttls()
            if s.smtp_user:
                smtp.login(s.smtp_user, s.smtp_password)
            smtp.send_message(msg)
        return True
    except Exception:
        log.exception("email delivery to %s failed", to)
        return False
