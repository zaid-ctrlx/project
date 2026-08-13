import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, String, Table, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.models.user import User

# M2M: which users have bookmarked which events. Queried/mutated directly via
# this Table in app/api/routes/events.py (insert/delete/select) rather than
# through an ORM relationship — "is this bookmarked by me" is computed
# per-request (see EventOut.is_bookmarked), not by loading a collection.
event_bookmarks = Table(
    "event_bookmarks",
    Base.metadata,
    Column("user_id", UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("event_id", UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), primary_key=True),
    Column("created_at", DateTime(timezone=True), server_default=func.now(), nullable=False),
)


class Event(Base):
    __tablename__ = "events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # "event" (one-time, has starts_at) or "community" (repeating, has
    # frequency instead) — two post kinds sharing this table rather than a
    # second near-identical one, since almost everything else here (title,
    # location, join_policy, the four category tags, bookmarks, creator)
    # applies to both. More kinds are meant to slot in the same way later
    # (see app/schemas/event.py's EVENT_KIND_OPTIONS). Plain String, not a
    # Postgres ENUM, validated at the Pydantic layer — same pattern as
    # join_policy below.
    kind: Mapped[str] = mapped_column(String(20), nullable=False, server_default="event")

    title: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Cover image for events ("flyer/poster" — optional but recommended) or
    # profile picture for communities. Same upload shape as ChatGroup's
    # avatar_url (see app/models/group.py) — set via POST
    # /events/{id}/cover, not part of EventCreate, since the event needs an
    # id first (see routes/events.py's upload_event_cover).
    cover_image_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Single start datetime, timezone-aware; no end time for this pass.
    # Required for kind="event", null for kind="community" (see
    # EventCreate's validator) — hence nullable here despite the index.
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    # How often a "community" repeats — daily/twice_a_week/once_a_week/
    # irregular, no specific day-of-week or time slot yet (see
    # FREQUENCY_OPTIONS). Null for kind="event".
    frequency: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Events only: physical location (below) or online — an online event
    # has no coordinates, and location_label is forced to "Online" by
    # EventCreate's validator so every display spot that already renders
    # location_label (EventCard, EventDetailScreen, ...) needs no special
    # case. Always False for kind="community" (communities are area-based,
    # not physical-vs-online).
    is_online: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    # Mirrors User's location fields (see app/models/user.py). Null when
    # is_online is True.
    location_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    location_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    location_label: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Communities only ("who can join"): "anyone" or "admin_approval".
    # Events are flyer/poster-style announcements with no join/attendance
    # mechanism, so this is meaningless for kind="event" and EventCreate's
    # validator forces it to "anyone" there. Plain String (not a Postgres
    # ENUM) to match the gender-field pattern in app/models/user.py,
    # validated at the Pydantic layer instead (see JOIN_POLICY_OPTIONS in
    # app/schemas/event.py).
    join_policy: Mapped[str] = mapped_column(String(30), nullable=False, server_default="anyone")

    # Events only: single fixed-vocabulary category. Used to have three
    # siblings (community_vibe/skill_level/event_style) for a fuller tag
    # taxonomy — dropped for now while the tag system gets redesigned (see
    # [[fyp-recommender-app-build]] memory); this is deliberately the
    # simplest possible version. Validated at the Pydantic layer, not the
    # DB (see ACTIVITY_TYPE_OPTIONS in app/schemas/event.py).
    activity_type: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Communities only: the ChatGroup that backs "joining" this community —
    # membership *is* GroupMember rows on this group, and the group's
    # existing messaging (GroupChatScreen etc., see app/models/group.py)
    # becomes the community's group chat for free. Created alongside the
    # Event in create_event (creator auto-added as admin); ON DELETE SET
    # NULL rather than CASCADE because deleting the group shouldn't delete
    # the community post itself. Always NULL for kind="event". String FK
    # target (not an import) to avoid a circular import with
    # app/models/group.py.
    group_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_groups.id", ondelete="SET NULL"), nullable=True
    )

    creator_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    creator: Mapped[User] = relationship()
