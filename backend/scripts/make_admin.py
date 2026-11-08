"""Grant or revoke moderator (admin) access. The only way to set it - there is
no API for this on purpose.

    python -m scripts.make_admin you@example.com
    python -m scripts.make_admin you@example.com --revoke
"""
import argparse

from sqlalchemy import select

import app.db.base  # noqa: F401
from app.db.session import SessionLocal
from app.models.user import User


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("email")
    ap.add_argument("--revoke", action="store_true")
    a = ap.parse_args()
    db = SessionLocal()
    try:
        user = db.scalar(select(User).where(User.email == a.email.lower()))
        if user is None:
            raise SystemExit(f"No account with email {a.email}")
        user.is_admin = not a.revoke
        db.commit()
        print(f"@{user.username} is {'now an admin' if user.is_admin else 'no longer an admin'}.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
