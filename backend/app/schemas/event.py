import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.geo import enabled_region_labels, is_within_enabled_region

# "event" (one-time, needs starts_at) or "community" (repeating, needs
# frequency instead) — see the comment on app/models/event.py's Event.kind.
EVENT_KIND_OPTIONS = Literal["event", "community"]

# How often a "community" repeats. No specific day-of-week/time-slot yet —
# just the label, matching mobile's "only two [create] options for now,
# we'll add more later" scope.
FREQUENCY_OPTIONS = Literal["daily", "twice_a_week", "once_a_week", "irregular"]

# Who can join a community: "anyone" (open) or "admin_approval" (a member's
# join request needs an admin to approve it — not enforced by any
# join/attendance endpoint yet, see the comment on Event.join_policy).
# Communities only — events are flyer/poster-style with no joining, and
# EventCreate's validator forces this to "anyone" for kind="event".
JOIN_POLICY_OPTIONS = Literal["anyone", "admin_approval"]

# Events only: single fixed-vocabulary category. Values are slugs; the
# mobile app owns the emoji/display labels (mobile/src/constants/eventTags.ts)
# so the two must be kept in sync by hand.
ACTIVITY_TYPE_OPTIONS = Literal[
    "fitness_running",
    "gym_workout",
    "cycling",
    "trekking",
    "camping",
    "travel",
    "photography",
    "art_creative",
    "gaming",
    "board_games",
    "tech_coding",
    "study_learning",
    "music",
    "cooking",
    "books_reading",
    "sports",
    "badminton",
    "cricket",
    "public_speaking",
    "volunteering",
]


class EventCreatorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    full_name: str | None
    avatar_url: str | None


class EventCreate(BaseModel):
    kind: EVENT_KIND_OPTIONS = "event"
    title: str = Field(min_length=1, max_length=150)
    description: str | None = Field(default=None, max_length=2000)
    # Exactly one of these two is required, enforced below by kind —
    # starts_at for "event", frequency for "community".
    starts_at: datetime | None = None
    frequency: FREQUENCY_OPTIONS | None = None
    # Events only — whether this is an online event (no physical location).
    # Must be False for kind="community" (see _validate_kind_fields).
    is_online: bool = False
    # Required unless kind="event" and is_online=True, in which case these
    # are ignored on input and forced to (None, None, "Online") below.
    location_lat: float | None = Field(default=None, ge=-90, le=90)
    location_lng: float | None = Field(default=None, ge=-180, le=180)
    location_label: str | None = Field(default=None, min_length=1, max_length=255)
    # Communities only — forced to "anyone" for kind="event".
    join_policy: JOIN_POLICY_OPTIONS = "anyone"
    # Events only — forced to None for kind="community".
    activity_type: ACTIVITY_TYPE_OPTIONS | None = None

    @model_validator(mode="after")
    def _validate_kind_fields(self) -> "EventCreate":
        if self.kind == "event":
            if self.starts_at is None:
                raise ValueError("starts_at is required for events")
            if self.frequency is not None:
                raise ValueError("frequency does not apply to events")
            # Flyer/poster-style — no join/attendance mechanism, so this
            # field is meaningless here regardless of what was submitted.
            self.join_policy = "anyone"

            if self.is_online:
                self.location_lat = None
                self.location_lng = None
                self.location_label = "Online"
            elif self.location_lat is None or self.location_lng is None or not self.location_label:
                raise ValueError("location is required for in-person events")
        else:  # community
            if self.frequency is None:
                raise ValueError("frequency is required for communities")
            if self.starts_at is not None:
                raise ValueError("starts_at does not apply to communities")
            if self.is_online:
                raise ValueError("is_online does not apply to communities")
            if self.activity_type is not None:
                raise ValueError("activity_type does not apply to communities")
            if self.location_lat is None or self.location_lng is None or not self.location_label:
                raise ValueError("location is required for communities")

        # Geographic scope check — applies to any physical (non-online)
        # location on either kind. Initial rollout is Karnataka-only (see
        # app/core/geo.py); enabling more states later needs no change here,
        # only to ENABLED_REGIONS itself. Skipped when location_lat/lng are
        # None (online events), already validated above.
        if self.location_lat is not None and self.location_lng is not None:
            if not is_within_enabled_region(self.location_lat, self.location_lng):
                allowed = ", ".join(enabled_region_labels())
                raise ValueError(f"Location must be within a supported region ({allowed}). Please choose a closer match.")
        return self


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    kind: EVENT_KIND_OPTIONS
    title: str
    description: str | None
    cover_image_url: str | None
    starts_at: datetime | None
    frequency: FREQUENCY_OPTIONS | None
    is_online: bool
    location_lat: float | None
    location_lng: float | None
    location_label: str | None
    creator: EventCreatorOut
    join_policy: JOIN_POLICY_OPTIONS
    activity_type: ACTIVITY_TYPE_OPTIONS | None
    # Communities only — the linked ChatGroup id (see Event.group_id). Null
    # for kind="event". Mobile uses this to open GroupChat once is_joined.
    group_id: uuid.UUID | None
    # Computed per-request (not DB columns) — see events.list_events /
    # get_current_user usage in app/api/routes/events.py.
    is_bookmarked: bool
    # Communities only — always False/0 for kind="event" (no group_id).
    is_joined: bool
    member_count: int
    # Events only — RSVP ("I'm going"), the events analogue of is_joined/
    # member_count above. Always False/0 for kind="community" (see
    # app/models/event.py's event_rsvps comment).
    is_rsvped: bool
    attendee_count: int
    created_at: datetime
