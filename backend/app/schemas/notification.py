import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

NOTIFICATION_TYPES = Literal["dm_message", "group_message", "added_to_group"]


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    type: NOTIFICATION_TYPES
    title: str
    body: str
    data: dict[str, Any]
    created_at: datetime
    read_at: datetime | None


class UnreadCountOut(BaseModel):
    unread_count: int


class PushTokenPayload(BaseModel):
    # Expo push tokens look like "ExponentPushToken[xxxxxxxx]" — not
    # validated further here, the Expo push API itself rejects malformed
    # ones when we try to send (see app/core/push.py).
    token: str = Field(min_length=1, max_length=255)
