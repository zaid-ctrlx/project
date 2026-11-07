import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base


class EventReminder(Base):
    """Ledger of reminders already sent: one row per (event, user, kind) where
    kind is "24h" or "6h". The unique constraint is what guarantees a reminder
    fires exactly once even if the scheduler runs twice, restarts, or two server
    processes race - the sender inserts this row first and only notifies if the
    insert actually created it (see app/core/reminders.py)."""

    __tablename__ = "event_reminders"
    __table_args__ = (UniqueConstraint("event_id", "user_id", "kind", name="uq_event_reminders_event_user_kind"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    kind: Mapped[str] = mapped_column(String(10), nullable=False)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
