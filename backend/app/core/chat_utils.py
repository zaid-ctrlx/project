"""Helpers shared by the DM (routes/messages.py) and group
(routes/groups.py) message endpoints: the edit window, sticker validation,
reply-quote snapshots, reaction loading, and list-preview wording."""

import re
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

# A text message can only be edited for this long after it was sent. Enforced
# here on the server — the mobile client hides the Edit option after the same
# window, but that's only a convenience.
EDIT_WINDOW = timedelta(minutes=5)

# Sticker ids are the file-less names the mobile client ships (see
# mobile/src/stickers). The server only checks the shape, so adding a sticker
# to the app never needs a backend change.
STICKER_ID_RE = re.compile(r"^[a-z0-9_]{1,40}$")

QUOTE_MAX_LEN = 200
DELETED_PREVIEW = "This message was deleted"


def validate_body(kind: str, text: str, db: Session | None = None) -> None:
    if kind == "sticker" and not STICKER_ID_RE.match(text):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid sticker")
    if kind == "event":
        from app.models.event import Event  # local import: avoid a cycle

        try:
            event_id = uuid.UUID(text)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid event") from None
        if db is None or db.get(Event, event_id) is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")


def preview_text(kind: str, deleted_at: datetime | None, body: str) -> str:
    """What a conversation-list row / notification shows for a message."""
    if deleted_at is not None:
        return DELETED_PREVIEW
    if kind == "sticker":
        return "Sticker"
    if kind == "event":
        return "Shared an event"
    return body


def quote_fields(message) -> dict:
    """Snapshot of a message for a reply's quoted strip. Taken at send time
    so the quote survives the original later being edited or deleted."""
    text = {"sticker": "Sticker", "event": "Event"}.get(message.kind, message.body)
    return {
        "quote_text": text[:QUOTE_MAX_LEN],
        "quote_sender_id": message.sender_id,
        "quote_kind": message.kind,
    }


def check_can_edit(message, user_id: uuid.UUID) -> None:
    if message.sender_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only edit your own messages")
    if message.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This message was deleted")
    if message.kind != "text":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only text messages can be edited")
    if datetime.now(timezone.utc) - message.created_at > EDIT_WINDOW:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Messages can only be edited within 5 minutes of sending"
        )


def check_can_delete(message, user_id: uuid.UUID) -> None:
    if message.sender_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only delete your own messages")


def tombstone(message) -> None:
    """Delete-for-everyone: keep the row (so replies/threads stay intact) but
    drop its content."""
    message.body = ""
    message.deleted_at = datetime.now(timezone.utc)


def attach_reactions(db: Session, reaction_model, messages: list) -> None:
    """Sets a non-mapped `reactions` list on each message so MessageOut /
    GroupMessageOut can serialize it (same non-mapped-attribute approach as
    GroupMessageOut.sender_username). One query for the whole page."""
    if not messages:
        return
    by_message: dict[uuid.UUID, list[dict]] = {m.id: [] for m in messages}
    rows = db.execute(
        select(reaction_model.message_id, reaction_model.user_id, reaction_model.emoji).where(
            reaction_model.message_id.in_(by_message.keys())
        )
    ).all()
    for message_id, user_id, emoji in rows:
        by_message[message_id].append({"user_id": user_id, "emoji": emoji})
    for m in messages:
        m.reactions = by_message[m.id]


def set_reaction(db: Session, reaction_model, message_id: uuid.UUID, user_id: uuid.UUID, emoji: str | None) -> None:
    """One reaction per user per message: setting replaces, null removes."""
    existing = db.execute(
        select(reaction_model).where(reaction_model.message_id == message_id, reaction_model.user_id == user_id)
    ).scalar_one_or_none()
    if emoji is None:
        if existing is not None:
            db.delete(existing)
    elif existing is None:
        db.add(reaction_model(message_id=message_id, user_id=user_id, emoji=emoji))
    else:
        existing.emoji = emoji
    db.commit()
