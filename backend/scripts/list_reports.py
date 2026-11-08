"""Moderator view of user reports (the app has one too: Settings > Reports, for admins).

    python -m scripts.list_reports                 # open reports, newest first
    python -m scripts.list_reports --resolve <id>  # mark one handled
"""
import argparse
import uuid

from sqlalchemy import select

import app.db.base  # noqa: F401
from app.db.session import SessionLocal
from app.models.event import Event
from app.models.report import Report
from app.models.user import User


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--resolve", help="report id to mark as resolved")
    a = ap.parse_args()
    db = SessionLocal()
    try:
        if a.resolve:
            r = db.get(Report, uuid.UUID(a.resolve))
            if r is None:
                raise SystemExit("No such report")
            r.status = "resolved"
            db.commit()
            print("Resolved", r.id)
            return
        rows = db.scalars(select(Report).where(Report.status == "open").order_by(Report.created_at.desc())).all()
        print(f"{len(rows)} open report(s)\n")
        for r in rows:
            who = db.get(User, r.reporter_id)
            if r.target_type == "user":
                t = db.get(User, r.target_id)
                target = f"user @{t.username}" if t else "user (deleted)"
            else:
                t = db.get(Event, r.target_id)
                target = f"post '{t.title}'" if t else "post (deleted)"
            print(f"{r.id}  {r.created_at:%Y-%m-%d %H:%M}  {r.reason:<13} {target}  by @{who.username if who else '?'}")
            if r.details:
                print(f"    \"{r.details}\"")
    finally:
        db.close()


if __name__ == "__main__":
    main()
