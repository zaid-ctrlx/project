"""Content-based scoring: cosine similarity between the user's interest-tag
vector and the event's activity vector, blended with distance, time and
popularity signals (weights in config.CONTENT_WEIGHTS)."""
import math
from datetime import datetime

import numpy as np

from app.recsys.config import CONTENT_WEIGHTS, DISTANCE_SCALE_KM
from app.recsys.taxonomy import ACTIVITY_TAGS, TAG_INDEX, TAG_SLUGS
from app.recsys.types import EventFeat, UserFeat


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle (straight-line) distance in km - not road distance."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * 6371.0 * math.asin(math.sqrt(a))


def event_matrix(events: list[EventFeat]) -> np.ndarray:
    m = np.zeros((len(events), len(TAG_SLUGS)))
    for i, e in enumerate(events):
        for slug, w in ACTIVITY_TAGS.get(e.activity_type or "", {}).items():
            m[i, TAG_INDEX[slug]] = w
    return m


def user_vector(user: UserFeat) -> np.ndarray:
    v = np.zeros(len(TAG_SLUGS))
    for slug in user.tags:
        if slug in TAG_INDEX:
            v[TAG_INDEX[slug]] = 1.0
    return v


def cosine(user_vec: np.ndarray, ev_mat: np.ndarray) -> np.ndarray:
    denom = np.linalg.norm(user_vec) * np.linalg.norm(ev_mat, axis=1)
    out = np.zeros(ev_mat.shape[0])
    ok = denom > 0
    out[ok] = (ev_mat[ok] @ user_vec) / denom[ok]
    return out


def tag_similarity(user: UserFeat, events: list[EventFeat]) -> np.ndarray:
    return cosine(user_vector(user), event_matrix(events))


def content_scores(
    user: UserFeat,
    events: list[EventFeat],
    popularity: np.ndarray,
    now: datetime | None = None,
    weights: dict[str, float] | None = None,
) -> np.ndarray:
    """Score per event. `popularity` is a pre-normalised [0,1] array.
    Pass now=None to ignore the time component (offline evaluation)."""
    w = weights or CONTENT_WEIGHTS
    tag = tag_similarity(user, events)

    dist = np.full(len(events), 0.5)  # neutral when location unknown / online
    if user.lat is not None and user.lng is not None:
        for i, e in enumerate(events):
            if not e.is_online and e.lat is not None and e.lng is not None:
                dist[i] = math.exp(-haversine_km(user.lat, user.lng, e.lat, e.lng) / DISTANCE_SCALE_KM)

    time = np.full(len(events), 0.7)  # communities: always "current"
    if now is not None:
        for i, e in enumerate(events):
            if e.starts_at is not None:
                days = (e.starts_at - now).total_seconds() / 86400
                # Soonest-upcoming scores highest; fades over ~30 days; past = 0.
                time[i] = 0.0 if days < 0 else math.exp(-days / 30.0)

    return w["tags"] * tag + w["distance"] * dist + w["time"] * time + w["popularity"] * popularity
