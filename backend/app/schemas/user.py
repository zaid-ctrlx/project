import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, ConfigDict, Field

from app.schemas.tag import TagOut

GENDER_OPTIONS = Literal["Male", "Female", "Prefer not to say"]


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = None


class UserLogin(BaseModel):
    # Either the account's email or its @username — see login() in
    # routes/auth.py for the lookup. Plain str (not EmailStr): a username
    # like "zaid_ctrl" would fail EmailStr validation outright.
    identifier: str = Field(min_length=1, max_length=255)
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    full_name: str | None
    username: str
    bio: str | None
    gender: str | None
    avatar_url: str | None
    is_active: bool
    is_verified: bool
    onboarding_completed: bool
    location_lat: float | None
    location_lng: float | None
    location_label: str | None
    tags: list[TagOut]
    created_at: datetime


USERNAME_PATTERN = r"^[a-zA-Z0-9_]+$"


class ProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=255)
    username: str = Field(min_length=3, max_length=30, pattern=USERNAME_PATTERN)
    bio: str | None = Field(default=None, max_length=150)
    gender: GENDER_OPTIONS | None = None
    location_lat: float = Field(ge=-90, le=90)
    location_lng: float = Field(ge=-180, le=180)
    location_label: str = Field(min_length=1, max_length=255)
    tag_ids: list[uuid.UUID] = Field(default_factory=list, max_length=50)


class UserSearchResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    full_name: str | None
    avatar_url: str | None
    tags: list[TagOut]


class UserPublicOut(BaseModel):
    """What one user is allowed to see of another's profile — deliberately
    excludes email, gender, and location, matching the privacy stance
    already established on UserSearchResult (location in particular has no
    rounding-for-privacy logic yet, so it stays fully unexposed to others)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    full_name: str | None
    bio: str | None
    avatar_url: str | None
    tags: list[TagOut]
    # Whether *I* (the caller) have blocked this user — set outside
    # from_attributes by the route (not a real column on User), same pattern
    # as EventOut.is_bookmarked in app/schemas/event.py.
    is_blocked: bool = False
    # Whether *I* have muted this user's DMs — same non-mapped-attribute
    # pattern as is_blocked above. See DmMute's docstring.
    is_muted: bool = False


class AccountDeleteRequest(BaseModel):
    password: str = Field(min_length=1)


class BlockedUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    full_name: str | None
    avatar_url: str | None
