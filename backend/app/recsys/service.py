"""Glue between the database and the pure recommender: loads rows into the
plain feature types, fits the SVD (cached - proposal section 7: scheduled batch
retraining, not online learning), and ranks candidates for one user."""
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.event import Event, event_bookmarks, event_rsvps
from app.models.group import GroupMember
from app.models.interaction import Interaction
from app.models.user import Tag, User, user_tags
from app.recsys import cf as cfmod
from app.recsys.config import MAX_CF_WEIGHT
from app.recsys.content import content_scores, tag_similarity
from app.recsys.hybrid import blend, cf_weight, minmax
from app.recsys.taxonomy import ACTIVITY_TAGS, TAG_NAMES
from app.recsys.types import EventFeat, Interact, UserFeat

MODEL_TTL_SECONDS = 600  # refit at most every 10 minutes


@dataclass
class _Fitted:
    at: float
    user_idx: dict[str, int]
    event_idx: dict[str, int]
    model: cfmod.SVDModel
    popularity: dict[str, float]  # event id -> [0,1]
    counts: dict[str, int]  # user id -> number of interactions


_cache: _Fitted | None = None


def _all_interactions(db: Session) -> list[Interact]:
    """Logged interactions plus the pre-logging history already in the
    existing bookmark/RSVP/membership tables (deduplicated against the log so
    nothing is double counted)."""
    out: list[Interact] = []
    logged: set[tuple[str, str, str]] = set()
    for i in db.scalars(select(Interaction)).all():
        out.append(Interact(str(i.user_id), str(i.event_id), i.kind, i.created_at))
        logged.add((str(i.user_id), str(i.event_id), i.kind))

    def backfill(rows, kind):
        for user_id, event_id, created in rows:
            key = (str(user_id), str(event_id), kind)
            if key not in logged:
                out.append(Interact(key[0], key[1], kind, created))

    backfill(
        db.execute(select(event_bookmarks.c.user_id, event_bookmarks.c.event_id, event_bookmarks.c.created_at)),
        "bookmark",
    )
    backfill(db.execute(select(event_rsvps.c.user_id, event_rsvps.c.event_id, event_rsvps.c.created_at)), "rsvp")
    backfill(
        db.execute(
            select(GroupMember.user_id, Event.id, GroupMember.joined_at)
            .join(Event, Event.group_id == GroupMember.group_id)
            .where(Event.creator_id != GroupMember.user_id)
        ),
        "join",
    )
    return out


def _fit(db: Session) -> _Fitted:
    global _cache
    if _cache and time.time() - _cache.at < MODEL_TTL_SECONDS:
        return _cache
    user_ids = [str(x) for x in db.scalars(select(User.id)).all()]
    event_ids = [str(x) for x in db.scalars(select(Event.id)).all()]
    user_idx = {u: i for i, u in enumerate(user_ids)}
    event_idx = {e: i for i, e in enumerate(event_ids)}
    inter = _all_interactions(db)
    R = cfmod.strength_matrix(inter, user_idx, event_idx)
    model = cfmod.SVDModel().fit(R)
    pop = minmax(np.asarray(R.sum(axis=0)).ravel()) if event_ids else np.array([])
    counts = np.asarray((R > 0).sum(axis=1)).ravel() if user_ids else np.array([])
    _cache = _Fitted(
        at=time.time(),
        user_idx=user_idx,
        event_idx=event_idx,
        model=model,
        popularity={e: float(pop[i]) for e, i in event_idx.items()},
        counts={u: int(counts[i]) for u, i in user_idx.items()},
    )
    return _cache


def invalidate() -> None:
    """Drop the cached model (used by tests / after bulk data changes)."""
    global _cache
    _cache = None


def _reason(user: UserFeat, event: EventFeat, cf_part: float, tag_sim: float) -> str:
    if tag_sim > 0:
        weights = ACTIVITY_TAGS.get(event.activity_type or "", {})
        matched = [s for s in user.tags if s in weights]
        if matched:
            best = max(matched, key=lambda s: weights[s])
            return f"Matches your interest in {TAG_NAMES.get(best, best)}"
    if cf_part > 0.6:
        return "Popular with people who like similar things"
    return "Happening near you"


def recommend(db: Session, user: User, limit: int = 20) -> list[tuple[uuid.UUID, str]]:
    """Ranked (event_id, reason) for `user`, best first."""
    fitted = _fit(db)
    uid = str(user.id)
    now = datetime.now(timezone.utc)

    slugs = set(db.scalars(select(Tag.slug).join(user_tags, user_tags.c.tag_id == Tag.id).where(user_tags.c.user_id == user.id)))
    ufeat = UserFeat(uid, slugs, user.location_lat, user.location_lng)

    skip: set[str] = {
        str(x) for x in db.scalars(select(event_bookmarks.c.event_id).where(event_bookmarks.c.user_id == user.id))
    } | {str(x) for x in db.scalars(select(event_rsvps.c.event_id).where(event_rsvps.c.user_id == user.id))}
    skip |= {
        str(x)
        for x in db.scalars(
            select(Event.id).join(GroupMember, GroupMember.group_id == Event.group_id).where(GroupMember.user_id == user.id)
        )
    }

    rows = db.scalars(select(Event).where(Event.creator_id != user.id)).all()
    cands = [
        e for e in rows if str(e.id) not in skip and (e.kind == "community" or (e.starts_at and e.starts_at >= now))
    ]
    if not cands:
        return []
    feats = [
        EventFeat(str(e.id), e.activity_type, e.location_lat, e.location_lng, e.starts_at, e.is_online) for e in cands
    ]
    pop = np.array([fitted.popularity.get(f.id, 0.0) for f in feats])
    content = content_scores(ufeat, feats, pop, now=now)

    ui = fitted.user_idx.get(uid)
    n = fitted.counts.get(uid, 0)
    if ui is not None and cf_weight(n) > 0:
        cf_all = fitted.model.scores(ui)
        cf = np.array([cf_all[fitted.event_idx[f.id]] if f.id in fitted.event_idx else 0.0 for f in feats])
    else:
        cf = np.zeros(len(feats))
    final = blend(content, cf, n)
    sim = tag_similarity(ufeat, feats)
    cf_norm = minmax(cf)
    order = np.argsort(-final)[:limit]
    return [(cands[j].id, _reason(ufeat, feats[j], float(cf_norm[j]) if cf_weight(n) > 0 else 0.0, float(sim[j]))) for j in order]
