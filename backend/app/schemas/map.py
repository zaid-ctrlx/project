from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

from app.schemas.event import ACTIVITY_TYPE_OPTIONS, EVENT_KIND_OPTIONS

# Map-ready shape for the Discover map (GET /events/map) — deliberately a
# separate, slimmer schema from EventOut rather than reusing it: the map
# never needs creator info, bookmark/RSVP/join flags for the *current* user,
# cover images, etc., and must never leak anything user-location-related.
# Field names follow the shapes/names suggested for this feature rather than
# EventOut's (e.g. "type"/"name"/"latitude" instead of "kind"/"title"/
# "location_lat") since this is a purpose-built map API, not a view of Event.


class MapItemOut(BaseModel):
    id: UUID
    type: EVENT_KIND_OPTIONS
    name: str
    latitude: float
    longitude: float
    location_name: str | None
    description: str | None

    # Events only — null for type="community".
    start_date: datetime | None = None
    category: ACTIVITY_TYPE_OPTIONS | None = None
    attendee_count: int | None = None

    # Communities only — null for type="event".
    member_count: int | None = None
