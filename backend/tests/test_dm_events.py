import uuid

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.core.chat_utils import preview_text, validate_body
from app.schemas.group import GroupMessageCreate
from app.schemas.message import MessageCreate


def test_dm_accepts_event_kind_but_groups_do_not():
    MessageCreate(recipient_id=uuid.uuid4(), text=str(uuid.uuid4()), kind="event")
    with pytest.raises(ValidationError):
        GroupMessageCreate(text=str(uuid.uuid4()), kind="event")


def test_event_card_body_must_be_an_existing_event():
    with pytest.raises(HTTPException) as e:
        validate_body("event", "not-a-uuid")
    assert e.value.status_code == 400
    with pytest.raises(HTTPException) as e:
        validate_body("event", str(uuid.uuid4()), None)
    assert e.value.status_code == 404


def test_event_preview():
    assert preview_text("event", None, "x") == "Shared an event"
