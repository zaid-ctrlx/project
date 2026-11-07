import uuid
from typing import Literal

from pydantic import BaseModel

InteractionKind = Literal["view", "bookmark", "rsvp", "join"]


class InteractionCreate(BaseModel):
    event_id: uuid.UUID
    # Clients may only report views; bookmark/rsvp/join are logged by the
    # server when the real action happens, so they can't be forged here.
    kind: Literal["view"] = "view"
