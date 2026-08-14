import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class MessageParticipantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    full_name: str | None
    avatar_url: str | None


class MessageCreate(BaseModel):
    recipient_id: uuid.UUID
    text: str = Field(min_length=1, max_length=2000)


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    sender_id: uuid.UUID
    recipient_id: uuid.UUID
    body: str
    created_at: datetime
    read_at: datetime | None


class ConversationOut(BaseModel):
    # Built manually in the route (aggregated across several queries), not
    # via from_attributes off a single ORM object — no model_config needed.
    # One shape covers both DM and group rows (discriminated by `type`) so
    # GET /messages/conversations can return one merged, sorted list rather
    # than the mobile client stitching two endpoints together itself.
    type: Literal["dm", "group"]
    # dm only:
    other_user: MessageParticipantOut | None = None
    # group only:
    group_id: uuid.UUID | None = None
    group_name: str | None = None
    group_avatar_url: str | None = None
    member_count: int | None = None
    # Group only — whether this group backs a community rather than being a
    # plain user-created group chat, same distinction as
    # ChatGroupOut.is_community. Lets the mobile client filter Messages by
    # DMs/Groups/Communities without a second round trip.
    is_community: bool | None = None
    # shared:
    last_message: str
    last_message_at: datetime
    # None only for a just-created, still-empty group (no messages sent yet).
    last_sender_id: uuid.UUID | None = None
    # Group only — lets the mobile client prefix a group's preview with
    # "Sender: message" (WhatsApp-style), which a DM preview doesn't need
    # (there's only ever one possible "them"). None alongside
    # last_sender_id being None (empty group), never otherwise — see
    # _group_conversations in routes/messages.py.
    last_sender_username: str | None = None
    unread_count: int
