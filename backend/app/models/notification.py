import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base


class Notification(Base):
    """One in-app notification for one recipient. `type` is a plain string
    ("dm_message" | "group_message" | "added_to_group"), same
    validated-at-the-Pydantic-layer approach as GroupMember.role elsewhere
    in this codebase rather than a DB-level enum. `data` carries whatever
    the mobile client needs to navigate on tap (sender_id / group_id /
    message_id) without a second round trip — see app/core/notify.py, the
    one place that creates these rows."""

    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    type: Mapped[str] = mapped_column(String(30), nullable=False)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    data: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class PushToken(Base):
    """One Expo push token for one of a user's devices. A token belongs to
    whichever device generated it — re-registering the same token (app
    reinstall, different account on the same device) just moves it to the
    new owner rather than erroring, see the upsert in
    routes/notifications.py. Multiple rows per user are normal (multiple
    devices); deleted on logout (best-effort) so a shared/reset device
    doesn't keep receiving the previous account's pushes."""

    __tablename__ = "push_tokens"
    __table_args__ = (UniqueConstraint("token", name="uq_push_tokens_token"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
