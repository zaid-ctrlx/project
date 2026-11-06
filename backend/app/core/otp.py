import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.email_otp import EmailOtp
from app.models.user import User

Purpose = Literal["verify", "reset"]

OTP_TTL = timedelta(minutes=10)
RESEND_COOLDOWN = timedelta(seconds=60)
MAX_ATTEMPTS = 5

_SUBJECTS = {"verify": "Verify your Huddle email", "reset": "Reset your Huddle password"}
_INTROS = {
    "verify": "Use this code to verify your email and finish creating your account:",
    "reset": "Use this code to reset your password:",
}


def _hash(user_id, purpose: str, code: str) -> str:
    msg = f"{user_id}:{purpose}:{code}".encode()
    return hmac.new(settings.SECRET_KEY.encode(), msg, hashlib.sha256).hexdigest()


def issue_otp(db: Session, user: User, purpose: Purpose) -> tuple[str, str, str]:
    """Create (replacing any previous) a code for the user and return
    (to, subject, body) for the caller to email. Raises 429 inside the
    resend cooldown."""
    now = datetime.now(timezone.utc)
    existing = db.query(EmailOtp).filter_by(user_id=user.id, purpose=purpose).first()
    if existing is not None:
        wait = existing.created_at + RESEND_COOLDOWN - now
        if wait.total_seconds() > 0:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Please wait {int(wait.total_seconds()) + 1}s before requesting another code",
            )
        db.delete(existing)
        db.flush()

    code = f"{secrets.randbelow(1_000_000):06d}"
    db.add(
        EmailOtp(
            user_id=user.id,
            purpose=purpose,
            code_hash=_hash(user.id, purpose, code),
            expires_at=now + OTP_TTL,
        )
    )
    db.commit()

    minutes = int(OTP_TTL.total_seconds() // 60)
    body = (
        f"{_INTROS[purpose]}\n\n    {code}\n\n"
        f"It expires in {minutes} minutes. If you didn't request this, ignore this email."
    )
    return user.email, _SUBJECTS[purpose], body


def consume_otp(db: Session, user: User, purpose: Purpose, code: str) -> None:
    """Validate the code and delete it, or raise 400. Wrong guesses are
    counted; after MAX_ATTEMPTS the code is burned and a new one is needed.
    The caller commits."""
    invalid = HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired code")
    row = db.query(EmailOtp).filter_by(user_id=user.id, purpose=purpose).first()
    if row is None:
        raise invalid

    if row.expires_at < datetime.now(timezone.utc) or row.attempts >= MAX_ATTEMPTS:
        db.delete(row)
        db.commit()
        raise invalid

    if not hmac.compare_digest(row.code_hash, _hash(user.id, purpose, code)):
        row.attempts += 1
        if row.attempts >= MAX_ATTEMPTS:
            db.delete(row)
        db.commit()
        raise invalid

    db.delete(row)
    db.flush()
