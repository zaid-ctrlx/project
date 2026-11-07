"""Plain data carriers so the recommender is independent of SQLAlchemy and can
run on live DB rows or on synthetic data identically."""
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class UserFeat:
    id: str
    tags: set[str] = field(default_factory=set)  # tag slugs
    lat: float | None = None
    lng: float | None = None


@dataclass
class EventFeat:
    id: str
    activity_type: str | None
    lat: float | None = None
    lng: float | None = None
    starts_at: datetime | None = None  # None for communities (always "current")
    is_online: bool = False


@dataclass
class Interact:
    user_id: str
    event_id: str
    kind: str
    at: datetime
