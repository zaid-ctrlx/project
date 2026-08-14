import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.message import MessageParticipantOut

GROUP_ROLES = Literal["admin", "member"]


class GroupMemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user: MessageParticipantOut
    role: GROUP_ROLES
    joined_at: datetime
    # Only meaningful for "is *my* membership row muted" — the mobile client
    # finds its own row in ChatGroupOut.members by user.id == current user
    # rather than this getting a dedicated endpoint. See PATCH
    # /groups/{id}/mute in routes/groups.py.
    muted: bool


class ChatGroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    # The creator is added as admin automatically (see create_group) — this
    # is everyone *else* to add, so at least one keeps a group from being
    # created with just yourself in it.
    member_ids: list[uuid.UUID] = Field(min_length=1, max_length=200)


class ChatGroupOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    avatar_url: str | None
    creator_id: uuid.UUID
    created_at: datetime
    members: list[GroupMemberOut]
    # Not a mapped column — set explicitly by _load_group in
    # routes/groups.py (same non-mapped-attribute pattern as
    # EventOut.is_bookmarked). Whether this group backs a community
    # (Event.kind="community", Event.group_id == this group's id) rather
    # than being a plain user-created group chat — lets the mobile client
    # label it "Community Info" vs "Group Info" regardless of which screen
    # navigated here.
    is_community: bool = False


class AddGroupMemberPayload(BaseModel):
    user_id: uuid.UUID


class MuteGroupPayload(BaseModel):
    muted: bool


class GroupMessageCreate(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


class GroupMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    group_id: uuid.UUID
    sender_id: uuid.UUID
    body: str
    created_at: datetime
    # Not a mapped column (same non-mapped-attribute approach as EventOut's
    # is_bookmarked/is_joined/member_count, see _set_event_flags in
    # routes/events.py) — set explicitly on the ORM object by
    # send_group_message right before it's serialized, for both the
    # WebSocket push and the POST response, so the mobile client can render
    # "Sender: message" without a second lookup. None everywhere else
    # (e.g. GET /groups/{id}/messages's history list) — the group-chat
    # screen that renders those already resolves sender names off the
    # group's member list it has loaded anyway.
    sender_username: str | None = None
