import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base


class Connection(Base):
    """A mutual link between two users. One row per pair: it starts as
    status="pending" (requester -> addressee) and flips to "accepted" when
    the addressee accepts, after which the direction no longer matters and
    both users count it once. Routes always look the pair up in both
    directions, so a second row for the reverse direction is never created."""

    __tablename__ = "connections"
    __table_args__ = (UniqueConstraint("requester_id", "addressee_id", name="uq_connections_requester_addressee"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    requester_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    addressee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(10), nullable=False, default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
