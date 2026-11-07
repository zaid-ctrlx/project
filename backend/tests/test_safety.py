"""Location coarsening and report-schema checks. No database needed."""
import pytest
from pydantic import ValidationError

from app.core.geo import USER_LOCATION_DECIMALS, coarsen_location
from app.recsys.content import haversine_km
from app.schemas.report import ReportCreate


def test_coarsen_rounds_to_about_one_km():
    lat, lng = coarsen_location(12.914163, 74.856027)
    assert (lat, lng) == (12.91, 74.86)
    assert USER_LOCATION_DECIMALS == 2


def test_coarsening_moves_a_point_by_at_most_about_a_kilometre_and_a_half():
    for lat, lng in [(12.914163, 74.856027), (13.0049, 77.4999), (15.3173, 75.7139)]:
        clat, clng = coarsen_location(lat, lng)
        assert haversine_km(lat, lng, clat, clng) < 1.6


def test_coarsening_is_idempotent():
    once = coarsen_location(12.914163, 74.856027)
    assert coarsen_location(*once) == once


def test_report_requires_a_known_reason_and_target_type():
    ok = ReportCreate(target_type="user", target_id="00000000-0000-0000-0000-000000000001", reason="spam")
    assert ok.details is None
    with pytest.raises(ValidationError):
        ReportCreate(target_type="user", target_id="00000000-0000-0000-0000-000000000001", reason="nope")
    with pytest.raises(ValidationError):
        ReportCreate(target_type="group", target_id="00000000-0000-0000-0000-000000000001", reason="spam")


def test_report_details_are_length_capped():
    with pytest.raises(ValidationError):
        ReportCreate(target_type="event", target_id="00000000-0000-0000-0000-000000000001", reason="other", details="x" * 501)
