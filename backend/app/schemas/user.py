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
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    full_name: str | None
    username: str
    bio: str | None
    gender: str | None
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
    tags: list[TagOut]
