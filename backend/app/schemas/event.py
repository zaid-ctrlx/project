import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# Who can join the event. "invite_only" and "closed" aren't enforced by any
# join/attendance endpoint yet — see the comment on Event.join_policy.
JOIN_POLICY_OPTIONS = Literal["open", "invite_only", "closed"]

# Four fixed-vocabulary, single-select category fields (replacing the
# earlier free-form multi-tag system — see app/models/event.py). Values are
# slugs; the mobile app owns the emoji/display labels for each
# (mobile/src/constants/eventTags.ts) so the two must be kept in sync by hand.
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
COMMUNITY_VIBE_OPTIONS = Literal[
    "friendly",
    "beginner_friendly",
    "competitive",
    "chill_relaxed",
    "social",
    "skill_focused",
    "goal_oriented",
    "team_based",
    "meet_new_people",
    "small_group",
    "open_to_everyone",
]
SKILL_LEVEL_OPTIONS = Literal[
    "beginners",
    "intermediate",
    "advanced",
    "all_skill_levels",
    "learning_together",
    "skill_sharing",
]
EVENT_STYLE_OPTIONS = Literal[
    "quick_meetup",
    "regular_meetup",
    "competition",
    "workshop",
    "discussion",
    "challenge",
    "adventure",
    "social_gathering",
    "networking",
    "group_activity",
    "talk_session",
    "hands_on",
]


class EventCreatorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    full_name: str | None
    avatar_url: str | None


class EventCreate(BaseModel):
    title: str = Field(min_length=1, max_length=150)
    description: str | None = Field(default=None, max_length=2000)
    starts_at: datetime
    location_lat: float = Field(ge=-90, le=90)
    location_lng: float = Field(ge=-180, le=180)
    location_label: str = Field(min_length=1, max_length=255)
    join_policy: JOIN_POLICY_OPTIONS = "open"
    activity_type: ACTIVITY_TYPE_OPTIONS | None = None
    community_vibe: COMMUNITY_VIBE_OPTIONS | None = None
    skill_level: SKILL_LEVEL_OPTIONS | None = None
    event_style: EVENT_STYLE_OPTIONS | None = None


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: str | None
    starts_at: datetime
    location_lat: float | None
    location_lng: float | None
    location_label: str | None
    creator: EventCreatorOut
    join_policy: JOIN_POLICY_OPTIONS
    activity_type: ACTIVITY_TYPE_OPTIONS | None
    community_vibe: COMMUNITY_VIBE_OPTIONS | None
    skill_level: SKILL_LEVEL_OPTIONS | None
    event_style: EVENT_STYLE_OPTIONS | None
    # Computed per-request (not a DB column) — see events.list_events /
    # get_current_user usage in app/api/routes/events.py.
    is_bookmarked: bool
    created_at: datetime
