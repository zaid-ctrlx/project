"""Single entry point for creating a Notification row and best-effort
delivering it live — over the same per-user WebSocket messages.py's chat
pushes use (a "notification" frame, distinct from "message"/"group_message")
plus an Expo push to every device the user has registered (see
routes/notifications.py's push-token endpoints). Called from the three
trigger points that generate a notification: send_message (DM),
send_group_message (group/community chat), and add_group_member — see
routes/messages.py and routes/groups.py.

Mute is checked by the caller, not here: send_group_message already has to
loop per-recipient to decide who gets the "group_message" WS frame, so it's
simplest for that same loop to skip calling this for muted members rather
than this function re-querying GroupMember itself.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.push import send_expo_push
from app.core.ws_manager import manager
from app.models.notification import Notification, PushToken
from app.schemas.notification import NotificationOut


async def notify_user(
    db: Session,
    *,
    user_id: uuid.UUID,
    type: str,
    title: str,
    body: str,
    data: dict | None = None,
) -> None:
    notification = Notification(user_id=user_id, type=type, title=title, body=body, data=data or {})
    db.add(notification)
    db.commit()
    db.refresh(notification)

    await manager.send_to_user(
        user_id,
        {"type": "notification", "notification": NotificationOut.model_validate(notification).model_dump(mode="json")},
    )

    tokens = db.scalars(select(PushToken.token).where(PushToken.user_id == user_id)).all()
    await send_expo_push(list(tokens), title=title, body=body, data=data or {})
