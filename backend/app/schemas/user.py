import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, ConfigDict, Field

from app.schemas.tag import TagOut


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
    is_active: bool
    is_verified: bool
    onboarding_completed: bool
    location_lat: float | None
    location_lng: float | None
    location_label: str | None
    tags: list[TagOut]
    created_at: datetime


class ProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=255)
    location_lat: float = Field(ge=-90, le=90)
    location_lng: float = Field(ge=-180, le=180)
    location_label: str = Field(min_length=1, max_length=255)
    tag_ids: list[uuid.UUID] = Field(default_factory=list, max_length=50)
