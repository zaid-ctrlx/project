import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base


class Interaction(Base):
    """Append-only log of a user acting on an event/community: the implicit
    feedback the recommender trains on. One row per action (not deduplicated)
    so the temporal train/test split in the evaluation has real timestamps.

    kind is a plain string ("view" | "bookmark" | "rsvp" | "join"), validated
    in the schema layer. bookmark/rsvp/join rows are written server-side by
    the existing routes; "view" comes from the client (POST /interactions).
    Strength per kind lives in app/recsys/config.py, not in the database.
    """

    __tablename__ = "interactions"
    __table_args__ = (Index("ix_interactions_user_created", "user_id", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
