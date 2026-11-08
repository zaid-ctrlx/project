"""Seed a larger, realistic DEV dataset so the feed, Discover, search and the
recommender can be tried without real users: ~60 fake people across interest
clusters and five Karnataka cities, ~55 events/communities, and a history of
views, bookmarks, RSVPs and joins.

Every seeded account uses an @seed.huddle.example email and the shared dev
password below, so you can log in as any of them (e.g. seed.user001@seed.huddle.example)
to see how the recommendations differ per person. Seeded data never touches
real accounts, and --remove deletes exactly the seeded accounts and everything
they own (posts, groups, interactions) via the FK cascades.

Run from backend/ with the venv active:

    python -m scripts.seed_dataset            # create (refuses if already seeded)
    python -m scripts.seed_dataset --remove   # delete the seeded data
    python -m scripts.seed_dataset --seed 3   # different random draw
"""
import argparse
import random
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select

import app.db.base  # noqa: F401  (registers every model)
from app.api.routes.events import _create_community_group
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.event import Event, event_bookmarks, event_rsvps
from app.models.group import GroupMember
from app.models.interaction import Interaction
from app.models.user import Tag, User, user_tags
from app.recsys.synthetic import CLUSTERS
from app.recsys.taxonomy import ACTIVITY_TAGS

SEED_DOMAIN = "seed.huddle.example"
SEED_PASSWORD = "SeedPass123"  # dev only - shared by every seeded account

CITIES = {
    "Mangaluru": (12.9141, 74.8560),
    "Bengaluru": (12.9716, 77.5946),
    "Udupi": (13.3409, 74.7421),
    "Mysuru": (12.2958, 76.6394),
    "Hubballi": (15.3647, 75.1240),
}

FIRST = ["Aarav", "Riya", "Kiran", "Meera", "Rohan", "Sneha", "Arjun", "Divya", "Imran", "Neha",
         "Vikram", "Pooja", "Sahil", "Ananya", "Farhan", "Kavya", "Dev", "Isha", "Nikhil", "Tara",
         "Rahul", "Zoya", "Manoj", "Lakshmi", "Yash", "Sana", "Varun", "Asha", "Karthik", "Fatima"]

TITLES = {
    "fitness_running": ["Sunrise 5K Run", "Weekend Long Run"],
    "gym_workout": ["Beginner Strength Session", "Open Gym Meetup"],
    "cycling": ["Sunday Morning Ride", "Hill Climb Challenge"],
    "trekking": ["Sunrise Trek", "Western Ghats Day Hike"],
    "camping": ["Overnight Camp", "Lakeside Camping Weekend"],
    "travel": ["Backpackers Meetup", "Weekend Getaway Planning"],
    "photography": ["Street Photo Walk", "Golden Hour Shoot"],
    "art_creative": ["Sketching Social", "Open Studio Evening"],
    "gaming": ["Gaming Night", "Esports Watch Party"],
    "board_games": ["Board Game Evening", "Strategy Games Meetup"],
    "tech_coding": ["Code & Chai Meetup", "Hack Night"],
    "study_learning": ["Study Circle", "Exam Prep Group"],
    "music": ["Open Mic Night", "Jam Session"],
    "cooking": ["Cook-Along Workshop", "Street Food Crawl"],
    "books_reading": ["Book Club Meetup", "Silent Reading Hour"],
    "sports": ["Pickup Sports Day", "Inter-Club Friendly"],
    "badminton": ["Badminton Doubles Night", "Beginner Badminton Clinic"],
    "cricket": ["Weekend Cricket Match", "Nets Practice Session"],
    "public_speaking": ["Toastmasters-Style Practice", "Speak Up Evening"],
    "volunteering": ["Beach Clean-Up Drive", "Teach & Give Back Day"],
}
COMMUNITY_SUFFIX = ["Club", "Community", "Collective", "Crew"]
FREQUENCIES = ["daily", "twice_a_week", "once_a_week", "irregular"]
LOCALITIES = ["Central Park", "Lakeside Grounds", "City Library Hall", "Community Centre", "Riverside Ground"]


def _primary_tag(activity: str) -> str:
    return max(ACTIVITY_TAGS[activity].items(), key=lambda kv: kv[1])[0]


def _jitter(rng: random.Random, city: str) -> tuple[float, float]:
    lat, lng = CITIES[city]
    return lat + rng.uniform(-0.05, 0.05), lng + rng.uniform(-0.05, 0.05)


def remove() -> None:
    db = SessionLocal()
    try:
        ids = db.scalars(select(User.id).where(User.email.like(f"%@{SEED_DOMAIN}"))).all()
        if not ids:
            print("No seeded data found - nothing to remove.")
            return
        db.execute(delete(User).where(User.id.in_(ids)))  # cascades to posts, groups, interactions...
        db.commit()
        print(f"Removed {len(ids)} seeded account(s) and everything they owned.")
    finally:
        db.close()


def seed(n_users: int, seed_value: int) -> None:
    rng = random.Random(seed_value)
    db = SessionLocal()
    try:
        if db.scalar(select(User.id).where(User.email.like(f"%@{SEED_DOMAIN}")).limit(1)):
            print("Seeded data already exists. Run with --remove first to start over.")
            return
        tag_ids = {slug: tid for tid, slug in db.execute(select(Tag.id, Tag.slug)).all()}
        if not tag_ids:
            print("No tags in the database. Run `python -m scripts.seed_tags` first.")
            return

        now = datetime.now(timezone.utc)
        pw = hash_password(SEED_PASSWORD)  # hash once - bcrypt is slow

        # People
        users: list[User] = []
        u_cluster: list[int] = []
        for i in range(n_users):
            c = rng.randrange(len(CLUSTERS))
            city = rng.choice(list(CITIES))
            lat, lng = _jitter(rng, city)
            name = rng.choice(FIRST)
            u = User(
                id=uuid.uuid4(),
                email=f"seed.user{i + 1:03d}@{SEED_DOMAIN}",
                hashed_password=pw,
                full_name=f"{name} {chr(65 + rng.randrange(26))}.",
                username=f"{name.lower()}_{i + 1:03d}",
                bio=f"Into {rng.choice(CLUSTERS[c]).replace('_', ' ')}.",
                location_lat=lat,
                location_lng=lng,
                location_label=f"{city}, Karnataka, India",
                onboarding_completed=True,
                is_verified=True,
            )
            users.append(u)
            u_cluster.append(c)
        db.add_all(users)
        db.flush()
        for u, c in zip(users, u_cluster):
            acts = rng.sample(CLUSTERS[c], k=min(rng.choice([1, 2, 3]), len(CLUSTERS[c])))
            slugs = {_primary_tag(a) for a in acts}
            if rng.random() < 0.15:  # a stray interest outside their cluster
                slugs.add(_primary_tag(rng.choice(rng.choice(CLUSTERS))))
            for slug in slugs:
                if slug in tag_ids:
                    db.execute(user_tags.insert().values(user_id=u.id, tag_id=tag_ids[slug]))

        # Posts
        events: list[Event] = []
        e_cluster: list[int] = []
        n_events, n_comms = 40, 15
        for k in range(n_events + n_comms):
            is_comm = k >= n_events
            c = rng.randrange(len(CLUSTERS))
            act = rng.choice(CLUSTERS[c])
            city = rng.choice(list(CITIES))
            lat, lng = _jitter(rng, city)
            creator = rng.choice(users)
            base = rng.choice(TITLES[act])
            label = f"{rng.choice(LOCALITIES)}, {city}, Karnataka"
            ev = Event(
                id=uuid.uuid4(),
                kind="community" if is_comm else "event",
                title=f"{city} {act.replace('_', ' ').title()} {rng.choice(COMMUNITY_SUFFIX)}" if is_comm else f"{base} - {city}",
                description=f"{base} for people who love {act.replace('_', ' ')}. Everyone welcome; newcomers especially.",
                is_online=False,
                location_lat=lat,
                location_lng=lng,
                location_label=label,
                join_policy="anyone",
                activity_type=None if is_comm else act,
                creator_id=creator.id,
                created_at=now - timedelta(days=rng.uniform(0, 30)),
            )
            if is_comm:
                ev.frequency = rng.choice(FREQUENCIES)
                ev.group_id = _create_community_group(db, ev.title, creator.id)
            else:
                # Mostly upcoming (1-45 days), a few already past.
                days = rng.uniform(-10, -1) if rng.random() < 0.12 else rng.uniform(1, 45)
                ev.starts_at = now + timedelta(days=days)
            events.append(ev)
            # Communities have no activity_type column value; cluster comes from the title's activity.
            e_cluster.append(c)
        db.add_all(events)
        db.flush()

        # Behaviour: mostly in-cluster, a little noise, popularity-skewed.
        pop = [rng.paretovariate(2.0) for _ in events]
        n_inter = 0
        for ui, u in enumerate(users):
            weights = [pop[j] * (1.0 if e_cluster[j] == u_cluster[ui] else 0.12) for j in range(len(events))]
            picks = set(rng.choices(range(len(events)), weights=weights, k=max(4, int(rng.gauss(14, 6)))))
            for j in picks:
                ev = events[j]
                if ev.creator_id == u.id:
                    continue
                at = now - timedelta(days=rng.uniform(0, 60))
                kind = rng.choices(["view", "bookmark", "rsvp"], weights=[0.5, 0.25, 0.25])[0]
                if ev.kind == "community" and kind == "rsvp":
                    kind = "join"
                db.add(Interaction(user_id=u.id, event_id=ev.id, kind="view", created_at=at - timedelta(minutes=3)))
                n_inter += 1
                if kind == "view":
                    continue
                db.add(Interaction(user_id=u.id, event_id=ev.id, kind=kind, created_at=at))
                n_inter += 1
                if kind == "bookmark":
                    db.execute(event_bookmarks.insert().values(user_id=u.id, event_id=ev.id, created_at=at))
                elif kind == "rsvp":
                    db.execute(event_rsvps.insert().values(user_id=u.id, event_id=ev.id, created_at=at))
                else:
                    db.add(GroupMember(group_id=ev.group_id, user_id=u.id, role="member"))
        db.commit()
        print(
            f"Seeded {len(users)} people, {n_events} events, {n_comms} communities, {n_inter} interactions.\n"
            f"Log in as e.g. seed.user001@{SEED_DOMAIN} / {SEED_PASSWORD}  (any seed.userNNN works).\n"
            f"Undo with: python -m scripts.seed_dataset --remove"
        )
    finally:
        db.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--remove", action="store_true")
    ap.add_argument("--users", type=int, default=60)
    ap.add_argument("--seed", type=int, default=11)
    a = ap.parse_args()
    remove() if a.remove else seed(a.users, a.seed)
