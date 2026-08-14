import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base


class Message(Base):
    """A single direct message. There is no Conversation table — a thread
    between two users is implied by the (sender_id, recipient_id) pair on
    these rows (see GET /messages/conversations for how "latest message per
    counterpart" is derived on the fly)."""

    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sender_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    recipient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class DmClear(Base):
    """"Clear chat" for a DM thread, per user: everything with created_at <=
    cleared_at is hidden from *this* user only — the other side's view is
    untouched (same one-sided semantics as WhatsApp/Telegram's "Clear Chat",
    distinct from a "delete for everyone" feature, which doesn't exist here).

    Groups have a natural per-user row to hang this off already
    (GroupMember.cleared_at) since membership is already modeled; DMs have
    no such row (see Message's docstring — no Conversation table), hence
    this separate table rather than a column on Message itself, which is
    shared by both sides and isn't the right place for a one-sided marker.
    """

    __tablename__ = "dm_clears"
    __table_args__ = (UniqueConstraint("user_id", "other_user_id", name="uq_dm_clears_user_other"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    other_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    cleared_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class DmMute(Base):
    """Presence = muted, same shape as UserBlock (app/models/block.py) —
    one row per (user, other_user) pair. Unlike a block, this is
    deliberately one-directional only and never checked both ways: me
    muting you says nothing about whether you've muted me, and only gates
    *my* notifications for messages *you* send (see notify_user's caller in
    routes/messages.py's send_message) — it has no effect on message
    delivery itself, mirroring GroupMember.muted's semantics on the group
    side."""

    __tablename__ = "dm_mutes"
    __table_args__ = (UniqueConstraint("user_id", "other_user_id", name="uq_dm_mutes_user_other"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    other_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
