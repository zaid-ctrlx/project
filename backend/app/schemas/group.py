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


class AddGroupMemberPayload(BaseModel):
    user_id: uuid.UUID


class GroupMessageCreate(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


class GroupMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    group_id: uuid.UUID
    sender_id: uuid.UUID
    body: str
    created_at: datetime
