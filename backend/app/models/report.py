import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base


class Report(Base):
    """A user reporting another user, or an event/community post, for review.

    target_id is deliberately NOT a foreign key: the target can be a user or
    an event (polymorphic), and a report should survive the target being
    deleted - that is exactly when moderators still want the evidence. The
    reporter's own account deletion does cascade (their report goes with them).

    One report per (reporter, target): reporting twice is a no-op, so nobody
    can pile on a single target from one account. status is "open" until a
    moderator handles it (Settings > Reports for admins; or scripts/list_reports.py).
    """

    __tablename__ = "reports"
    __table_args__ = (UniqueConstraint("reporter_id", "target_type", "target_id", name="uq_reports_reporter_target"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reporter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    target_type: Mapped[str] = mapped_column(String(10), nullable=False)  # "user" | "event"
    target_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    reason: Mapped[str] = mapped_column(String(20), nullable=False)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(10), nullable=False, server_default="open")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
