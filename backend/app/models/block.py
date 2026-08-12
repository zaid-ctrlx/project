import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base


class UserBlock(Base):
    """One row per (blocker, blocked) pair. Directional — A blocking B does
    not imply B has blocked A — but everywhere this is checked (search,
    messaging) looks in both directions, so in practice a block acts
    mutually even though only one side "did" it. No relationship()s here;
    every read site (search_users, send_message, read_user_profile) queries
    this table directly by id pair, same style as event_bookmarks."""

    __tablename__ = "user_blocks"
    __table_args__ = (UniqueConstraint("blocker_id", "blocked_id", name="uq_user_blocks_blocker_blocked"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    blocker_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    blocked_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
