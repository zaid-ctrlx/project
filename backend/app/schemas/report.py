import uuid
from typing import Literal

from pydantic import BaseModel, Field

ReportTarget = Literal["user", "event"]
ReportReason = Literal["spam", "harassment", "inappropriate", "fake", "unsafe", "other"]


class ReportCreate(BaseModel):
    target_type: ReportTarget
    target_id: uuid.UUID
    reason: ReportReason
    details: str | None = Field(default=None, max_length=500)


class ReportOut(BaseModel):
    # "created" the first time, "already_reported" on a repeat (idempotent).
    result: Literal["created", "already_reported"]
