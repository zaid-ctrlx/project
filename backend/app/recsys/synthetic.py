"""Synthetic data generator (proposal section 4: bootstrap before real users
exist). Users and events fall into interest clusters; users mostly interact
with events from their own cluster, with a popularity bias and some noise, over
a simulated timeline so a temporal split is meaningful."""
import random
from datetime import datetime, timedelta, timezone

from app.recsys.taxonomy import ACTIVITY_TAGS
from app.recsys.types import EventFeat, Interact, UserFeat

# Interest clusters over the real activity types.
CLUSTERS: list[list[str]] = [
    ["fitness_running", "gym_workout", "cycling", "sports", "badminton", "cricket"],
    ["trekking", "camping", "travel", "photography"],
    ["tech_coding", "study_learning", "books_reading", "public_speaking"],
    ["music", "art_creative", "cooking"],
    ["gaming", "board_games", "volunteering"],
]
# (lat, lng) city centres users/events are scattered around.
CITIES = [(12.9141, 74.8560), (12.9716, 77.5946)]  # Mangaluru, Bengaluru


def _primary_tag(activity: str) -> str:
    return max(ACTIVITY_TAGS[activity].items(), key=lambda kv: kv[1])[0]


def generate(
    n_users: int = 300,
    n_events: int = 150,
    days: int = 120,
    seed: int = 7,
    noise: float = 0.15,
    start: datetime | None = None,
) -> tuple[list[UserFeat], list[EventFeat], list[Interact]]:
    rng = random.Random(seed)
    start = start or datetime(2026, 1, 1, tzinfo=timezone.utc)

    events: list[EventFeat] = []
    ev_cluster: list[int] = []
    for i in range(n_events):
        c = rng.randrange(len(CLUSTERS))
        city = CITIES[rng.randrange(len(CITIES))]
        events.append(
            EventFeat(
                id=f"e{i}",
                activity_type=rng.choice(CLUSTERS[c]),
                lat=city[0] + rng.uniform(-0.08, 0.08),
                lng=city[1] + rng.uniform(-0.08, 0.08),
                starts_at=start + timedelta(days=rng.uniform(5, days + 10)),
            )
        )
        ev_cluster.append(c)

    # Skewed popularity so a popularity baseline is non-trivial.
    ev_pop = [rng.paretovariate(2.0) for _ in range(n_events)]

    users: list[UserFeat] = []
    u_cluster: list[int] = []
    for i in range(n_users):
        c = rng.randrange(len(CLUSTERS))
        city = CITIES[rng.randrange(len(CITIES))]
        acts = rng.sample(CLUSTERS[c], k=min(2, len(CLUSTERS[c])))
        tags = {_primary_tag(a) for a in acts}
        if rng.random() < noise:  # a stray interest outside the cluster
            tags.add(_primary_tag(rng.choice(rng.choice(CLUSTERS))))
        users.append(
            UserFeat(
                id=f"u{i}",
                tags=tags,
                lat=city[0] + rng.uniform(-0.08, 0.08),
                lng=city[1] + rng.uniform(-0.08, 0.08),
            )
        )
        u_cluster.append(c)

    interactions: list[Interact] = []
    for ui, u in enumerate(users):
        n = max(3, int(rng.gauss(14, 8)))  # activity level varies; some are near cold
        weights = [
            ev_pop[j] * (1.0 if ev_cluster[j] == u_cluster[ui] else noise) for j in range(n_events)
        ]
        for j in rng.choices(range(n_events), weights=weights, k=n):
            e = events[j]
            # Act before the event starts, at a random time in the timeline.
            at = start + timedelta(days=rng.uniform(0, days))
            kind = rng.choices(["view", "bookmark", "rsvp"], weights=[0.5, 0.25, 0.25])[0]
            interactions.append(Interact(u.id, e.id, kind, at))
            if kind != "view" and rng.random() < 0.5:  # people usually view first
                interactions.append(Interact(u.id, e.id, "view", at - timedelta(minutes=5)))
    interactions.sort(key=lambda x: x.at)
    return users, events, interactions
