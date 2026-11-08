from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.api.routes.admin import ReportStatusUpdate, require_admin
from app.schemas.user import ProfileUpdate


def test_non_admin_is_turned_away_with_404():
    with pytest.raises(HTTPException) as e:
        require_admin(SimpleNamespace(is_admin=False))
    assert e.value.status_code == 404


def test_admin_passes():
    user = SimpleNamespace(is_admin=True)
    assert require_admin(user) is user


def test_status_values_are_restricted():
    ReportStatusUpdate(status="resolved")
    with pytest.raises(Exception):
        ReportStatusUpdate(status="deleted")


def test_profile_update_cannot_set_admin():
    assert "is_admin" not in ProfileUpdate.model_fields
