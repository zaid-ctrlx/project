import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User

_INVALID_CHARS = re.compile(r"[^a-z0-9_]")


def generate_unique_username(db: Session, email: str) -> str:
    """Placeholder username at registration time, derived from the email
    local-part. Purely a NOT NULL/unique-column filler — the user is
    expected to set a real one later via PUT /users/me/profile."""
    base = _INVALID_CHARS.sub("_", email.split("@", 1)[0].lower()).strip("_") or "user"
    base = base[:24]

    candidate = base
    suffix = 0
    while db.scalar(select(User.id).where(User.username == candidate)) is not None:
        suffix += 1
        candidate = f"{base}{suffix}"
    return candidate
