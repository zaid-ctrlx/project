"""Seed four demo posts for showcasing the Home filters: an event and a
community in Mangaluru, and an event and a community in Bengaluru, all owned
by a dedicated demo host account (random unusable password — it is never
meant to log in). Safe to re-run: posts that already exist (same creator +
title) are skipped. Event dates are relative to "now" so they are always in
the future.

Run from backend/ with the venv active:

    python -m scripts.seed_demo            # create
    python -m scripts.seed_demo --remove   # delete the demo account + its posts
"""
import sys
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

import app.db.base  # noqa: F401  (registers every model)
from app.api.routes.events import _create_community_group
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.event import Event
from app.models.user import User

IST = timezone(timedelta(hours=5, minutes=30))
DEMO_EMAIL = "demo-host@huddle.example"
DEMO_USERNAME = "huddle_demo"


def _local(days: int, hour: int, minute: int = 0) -> datetime:
    """A future IST wall-clock time `days` from today, as an aware datetime."""
    base = datetime.now(IST) + timedelta(days=days)
    return base.replace(hour=hour, minute=minute, second=0, microsecond=0)


def _posts() -> list[dict]:
    return [
        {
            "kind": "event",
            "title": "Panambur Beach Sunrise Run & Chai",
            "description": (
                "An easy 5 km run along Panambur Beach at sunrise, followed by filter coffee and chai "
                "at the beach shacks. All paces welcome - we regroup at every kilometre so nobody runs alone. "
                "Meet at the main entrance near the lifeguard tower."
            ),
            "starts_at": _local(4, 6, 0),
            "location_label": "Panambur Beach, Mangaluru, Karnataka",
            "location_lat": 12.9420,
            "location_lng": 74.8113,
            "activity_type": "fitness_running",
            "join_policy": "anyone",
            "age_hours": 3,
        },
        {
            "kind": "community",
            "title": "Mangaluru Coastal Cyclists",
            "description": (
                "A friendly cycling club riding the coastal roads around Mangaluru - Tannirbhavi, Panambur and "
                "Ullal. Weekly weekend rides of 25 to 40 km, beginners and hybrid bikes welcome. Share route "
                "ideas, repair tips and ride photos in the group chat."
            ),
            "frequency": "once_a_week",
            "location_label": "Tannirbhavi, Mangaluru, Karnataka",
            "location_lat": 12.8833,
            "location_lng": 74.8167,
            "join_policy": "admin_approval",
            "age_hours": 2,
        },
        {
            "kind": "event",
            "title": "Lalbagh Sunday Photo Walk",
            "description": (
                "A relaxed two-hour photo walk through Lalbagh Botanical Garden - the glass house, the lake and "
                "the old trees at golden light. Bring any camera, phone cameras are perfectly fine. We finish with "
                "a quick photo critique over breakfast nearby."
            ),
            "starts_at": _local(9, 7, 30),
            "location_label": "Lalbagh Botanical Garden, Bengaluru, Karnataka",
            "location_lat": 12.9507,
            "location_lng": 77.5848,
            "activity_type": "photography",
            "join_policy": "anyone",
            "age_hours": 1,
        },
        {
            "kind": "community",
            "title": "Bengaluru Board Game Nights",
            "description": (
                "Two game nights a week in Indiranagar for people who love board games - strategy, party games and "
                "co-op classics. We keep a shared library, teach new games every session and welcome total "
                "beginners. Join the chat to vote on the next game."
            ),
            "frequency": "twice_a_week",
            "location_label": "Indiranagar, Bengaluru, Karnataka",
            "location_lat": 12.9784,
            "location_lng": 77.6408,
            "join_policy": "anyone",
            "age_hours": 0,
        },
    ]


def _get_or_create_host(db) -> User:
    host = db.execute(select(User).where(User.email == DEMO_EMAIL)).scalar_one_or_none()
    if host:
        return host
    host = User(
        email=DEMO_EMAIL,
        hashed_password=hash_password(uuid.uuid4().hex),  # random, nobody knows it
        full_name="Huddle Demo Host",
        username=DEMO_USERNAME,
        bio="Demo organiser showcasing events and communities.",
        location_lat=12.9716,
        location_lng=77.5946,
        location_label="Bengaluru, Karnataka, India",
        onboarding_completed=True,
        is_verified=True,
    )
    db.add(host)
    db.flush()
    return host


def seed() -> None:
    db = SessionLocal()
    try:
        host = _get_or_create_host(db)
        now = datetime.now(timezone.utc)
        created = 0
        for post in _posts():
            exists = db.execute(
                select(Event.id).where(Event.creator_id == host.id, Event.title == post["title"])
            ).first()
            if exists:
                continue
            event = Event(
                kind=post["kind"],
                title=post["title"],
                description=post["description"],
                starts_at=post.get("starts_at"),
                frequency=post.get("frequency"),
                is_online=False,
                location_lat=post["location_lat"],
                location_lng=post["location_lng"],
                location_label=post["location_label"],
                join_policy=post["join_policy"],
                activity_type=post.get("activity_type"),
                creator_id=host.id,
                # Staggered so "Recently added" has a visible order.
                created_at=now - timedelta(hours=post["age_hours"]),
            )
            if post["kind"] == "community":
                event.group_id = _create_community_group(db, post["title"], host.id)
            db.add(event)
            created += 1
        db.commit()
        print(f"Demo host: @{DEMO_USERNAME}. Created {created} new post(s), {len(_posts()) - created} already existed.")
    finally:
        db.close()


def remove() -> None:
    db = SessionLocal()
    try:
        host = db.execute(select(User).where(User.email == DEMO_EMAIL)).scalar_one_or_none()
        if not host:
            print("No demo account found - nothing to remove.")
            return
        db.delete(host)  # posts, groups and memberships cascade via FKs
        db.commit()
        print("Removed the demo account and its posts.")
    finally:
        db.close()


if __name__ == "__main__":
    remove() if "--remove" in sys.argv else seed()
