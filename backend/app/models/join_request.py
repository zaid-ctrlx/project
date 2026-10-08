import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base


class JoinRequest(Base):
    """A user's request to join a community whose join_policy is
    "admin_approval". One row per (event, user): re-requesting after a
    rejection flips the same row back to "pending" instead of piling up
    history. status is a plain string ("pending" | "approved" | "rejected"),
    validated in the route layer, same approach as GroupMember.role.
    Approving adds the user to the community's linked group (that *is*
    membership, see Event.group_id) -- this row only tracks the request."""

    __tablename__ = "join_requests"
    __table_args__ = (UniqueConstraint("event_id", "user_id", name="uq_join_requests_event_user"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
