"""Event reminders: a "24h" and a "6h" notification for everyone going to an
event (RSVP) and for its host.

Windows, by time remaining until starts_at:
    "24h": more than 6h and at most 24h left
    "6h":  more than 0 and at most 6h left
Using windows (not exact moments) means a server restart or a missed tick
still delivers the reminder on the next run, and someone who RSVPs only 10h
before the start gets the 6h reminder later but not a misleading "24h" one.
Each (event, user, kind) is sent at most once - guaranteed by the unique row in
event_reminders, inserted before notifying.

A background loop (started from the app lifespan in app/main.py) calls
process_due_reminders every REMINDER_INTERVAL_SECONDS.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.core.notify import notify_user
from app.db.session import SessionLocal
from app.models.event import Event, event_rsvps
from app.models.event_reminder import EventReminder

logger = logging.getLogger(__name__)

REMINDER_INTERVAL_SECONDS = 60
SIX_HOURS = timedelta(hours=6)
TWENTY_FOUR_HOURS = timedelta(hours=24)


def _kind_for(remaining: timedelta) -> str | None:
    if timedelta(0) < remaining <= SIX_HOURS:
        return "6h"
    if SIX_HOURS < remaining <= TWENTY_FOUR_HOURS:
        return "24h"
    return None


def _when_phrase(remaining: timedelta) -> str:
    hours = remaining.total_seconds() / 3600
    if hours >= 1.5:
        return f"in about {round(hours)} hours"
    minutes = max(1, round(remaining.total_seconds() / 60))
    return f"in about {minutes} minutes" if minutes < 90 else "in about 1 hour"


async def process_due_reminders(db: Session, now: datetime | None = None) -> int:
    """Send every reminder that is due and not yet sent. Returns how many."""
    now = now or datetime.now(timezone.utc)
    events = db.scalars(
        select(Event).where(
            Event.kind == "event",
            Event.starts_at.is_not(None),
            Event.starts_at > now,
            Event.starts_at <= now + TWENTY_FOUR_HOURS,
        )
    ).all()
    sent = 0
    for event in events:
        remaining = event.starts_at - now
        kind = _kind_for(remaining)
        if kind is None:
            continue
        recipients = set(db.scalars(select(event_rsvps.c.user_id).where(event_rsvps.c.event_id == event.id)).all())
        recipients.add(event.creator_id)
        for user_id in recipients:
            inserted = db.execute(
                pg_insert(EventReminder)
                .values(event_id=event.id, user_id=user_id, kind=kind)
                .on_conflict_do_nothing(constraint="uq_event_reminders_event_user_kind")
                .returning(EventReminder.id)
            ).first()
            db.commit()
            if inserted is None:
                continue  # already sent
            where = f" at {event.location_label}" if event.location_label and not event.is_online else ""
            await notify_user(
                db,
                user_id=user_id,
                type="event_reminder",
                title="Starting soon" if kind == "6h" else "Coming up tomorrow",
                body=f"{event.title} starts {_when_phrase(remaining)}{where}.",
                data={"event_id": str(event.id), "reminder": kind},
            )
            sent += 1
    return sent


async def reminder_loop() -> None:
    """Runs forever; one bad tick must never kill it."""
    while True:
        try:
            db = SessionLocal()
            try:
                n = await process_due_reminders(db)
                if n:
                    logger.info("Sent %d event reminder(s)", n)
            finally:
                db.close()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Reminder tick failed")
        await asyncio.sleep(REMINDER_INTERVAL_SECONDS)
