import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, String, Table, Text, func
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
    # Single start datetime, timezone-aware; no end time for this pass.
    # Required for kind="event", null for kind="community" (see
    # EventCreate's validator) — hence nullable here despite the index.
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    # How often a "community" repeats — daily/weekly/biweekly/monthly, no
    # specific day-of-week or time slot yet (see FREQUENCY_OPTIONS). Null
    # for kind="event".
    frequency: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Mirrors User's location fields (see app/models/user.py).
    location_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    location_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    location_label: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Who can join: "open" (anyone), "invite_only", or "closed" (temporarily
    # not accepting joins). Set at creation only for now — there's no
    # join/attendance mechanism yet for this to gate, and no edit endpoint
    # yet either; this just captures the setting so both can be built on
    # top of it later. Plain String (not a Postgres ENUM) to match the
    # gender-field pattern in app/models/user.py, validated at the Pydantic
    # layer instead (see JOIN_POLICY_OPTIONS in app/schemas/event.py).
    join_policy: Mapped[str] = mapped_column(String(30), nullable=False, server_default="open")

    # Four fixed-vocabulary, single-select category fields — replaces the
    # earlier free-form multi-tag system (the shared `tags` table is still
    # used for user profile interests, see app/models/user.py, but events no
    # longer draw from it). Each is optional and independently nullable;
    # allowed values are validated at the Pydantic layer, not the DB, same
    # approach as join_policy above (see app/schemas/event.py).
    activity_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    community_vibe: Mapped[str | None] = mapped_column(String(50), nullable=True)
    skill_level: Mapped[str | None] = mapped_column(String(50), nullable=True)
    event_style: Mapped[str | None] = mapped_column(String(50), nullable=True)

    creator_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    creator: Mapped[User] = relationship()
