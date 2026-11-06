import hashlib
from datetime import datetime, timedelta, timezone
from typing import Literal

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings


# --- Password hashing ---
# Using bcrypt directly rather than passlib: passlib's bcrypt backend detection
# is flaky against recent bcrypt releases (4.1+), so we skip that layer entirely.

def hash_password(plain_password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(plain_password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        plain_password.encode("utf-8"), hashed_password.encode("utf-8")
    )


# bcrypt-check against this when the account doesn't exist, so "no such user"
# takes as long as "wrong password" and response time doesn't leak which
# emails are registered.
DUMMY_PASSWORD_HASH = hash_password("not-a-real-password")


# --- JWT tokens ---
# Every token carries a fingerprint of the user's current password hash ("pf").
# Changing the password changes the hash, so all tokens issued before a reset
# stop validating - no token-version column or revocation list needed.

def password_fingerprint(hashed_password: str) -> str:
    return hashlib.sha256(hashed_password.encode("utf-8")).hexdigest()[:16]


def token_is_current(payload: dict, hashed_password: str) -> bool:
    return payload.get("pf") == password_fingerprint(hashed_password)


def _create_token(
    subject: str, fingerprint: str, expires_delta: timedelta, token_type: Literal["access", "refresh"]
) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "type": token_type,
        "pf": fingerprint,
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_access_token(subject: str, hashed_password: str) -> str:
    return _create_token(
        subject,
        password_fingerprint(hashed_password),
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        "access",
    )


def create_refresh_token(subject: str, hashed_password: str) -> str:
    return _create_token(
        subject,
        password_fingerprint(hashed_password),
        timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        "refresh",
    )


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None
