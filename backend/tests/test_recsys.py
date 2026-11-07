"""Unit tests for the recommender and the reminder windows. No database needed.

Run from backend/ with the venv active:

    pip install -r requirements-dev.txt
    python -m pytest tests -q
"""
from datetime import datetime, timedelta, timezone
from typing import get_args

import numpy as np
import pytest

from app.core.reminders import _kind_for, _when_phrase
from app.recsys import cf as cfmod
from app.recsys import metrics
from app.recsys.config import COLD_START_MIN, FULL_BLEND_AT, INTERACTION_WEIGHTS, MAX_CF_WEIGHT, MAX_STRENGTH
from app.recsys.content import content_scores, haversine_km, tag_similarity
from app.recsys.hybrid import blend, cf_weight, minmax
from app.recsys.service import distance_km
from app.recsys.synthetic import generate
from app.recsys.taxonomy import ACTIVITY_TAGS, TAG_INDEX, TAG_NAMES, TAG_SLUGS
from app.recsys.types import EventFeat, Interact, UserFeat
from app.schemas.event import ACTIVITY_TYPE_OPTIONS

NOW = datetime(2026, 11, 7, 12, 0, tzinfo=timezone.utc)


# ---- taxonomy: the vocabulary both sides of content matching depend on -------
def test_every_event_activity_type_has_a_tag_mapping():
    # If someone adds an activity type to the API but not to the taxonomy, its
    # events could never match any user's interests. Fail loudly instead.
    assert set(get_args(ACTIVITY_TYPE_OPTIONS)) == set(ACTIVITY_TAGS)


def test_every_tag_slug_has_a_display_name_and_index():
    assert set(TAG_SLUGS) == set(TAG_NAMES)
    assert set(TAG_INDEX) == set(TAG_SLUGS)


# ---- hybrid / cold start -------------------------------------------------------
def test_cold_start_users_get_no_collaborative_weight():
    assert cf_weight(0) == 0.0
    assert cf_weight(COLD_START_MIN - 1) == 0.0


def test_collaborative_weight_ramps_up_and_is_capped():
    weights = [cf_weight(n) for n in range(0, FULL_BLEND_AT + 15)]
    assert weights == sorted(weights)  # never decreases as history grows
    assert cf_weight(FULL_BLEND_AT) == pytest.approx(MAX_CF_WEIGHT)
    assert cf_weight(10_000) == pytest.approx(MAX_CF_WEIGHT)
    assert MAX_CF_WEIGHT < 1.0  # content always keeps a voice


def test_blend_for_cold_user_is_pure_content_ranking():
    content = np.array([0.1, 0.9, 0.5])
    cf = np.array([9.0, 0.0, 0.0])
    assert list(np.argsort(-blend(content, cf, 0))) == list(np.argsort(-content))


def test_minmax_handles_constant_input():
    assert list(minmax(np.array([2.0, 2.0, 2.0]))) == [0.0, 0.0, 0.0]


# ---- content-based --------------------------------------------------------------
def _ev(i, act, lat=12.9, lng=74.8, starts=None, online=False):
    return EventFeat(i, act, lat, lng, starts, online)


def test_matching_interest_outranks_unrelated_one():
    user = UserFeat("u", {"cycling"}, 12.9, 74.8)
    events = [_ev("music", "music"), _ev("cyc", "cycling")]
    scores = content_scores(user, events, np.zeros(2))
    assert scores[1] > scores[0]


def test_user_without_tags_has_zero_tag_similarity():
    assert list(tag_similarity(UserFeat("u", set()), [_ev("a", "cycling")])) == [0.0]


def test_nearer_event_scores_higher_when_everything_else_equal():
    user = UserFeat("u", {"cycling"}, 12.9141, 74.8560)  # Mangaluru
    near = _ev("near", "cycling", 12.92, 74.86)
    far = _ev("far", "cycling", 12.9716, 77.5946)  # Bengaluru
    scores = content_scores(user, [near, far], np.zeros(2))
    assert scores[0] > scores[1]


def test_past_events_get_no_time_credit():
    user = UserFeat("u", {"music"})
    future = _ev("f", "music", starts=NOW + timedelta(days=2))
    past = _ev("p", "music", starts=NOW - timedelta(days=2))
    scores = content_scores(user, [future, past], np.zeros(2), now=NOW)
    assert scores[0] > scores[1]


# ---- distance shown to the user must be real or absent --------------------------
def test_haversine_matches_known_distance():
    # Mangaluru -> Bengaluru is ~ 300 km in a straight line.
    d = haversine_km(12.9141, 74.8560, 12.9716, 77.5946)
    assert 290 < d < 310
    assert haversine_km(12.0, 77.0, 12.0, 77.0) == 0.0


def test_distance_is_none_when_it_cannot_be_known():
    ev = _ev("e", "music")
    assert distance_km(UserFeat("u", set(), None, None), ev) is None  # user has no location
    assert distance_km(UserFeat("u", set(), 12.9, 74.8), _ev("o", "music", online=True)) is None
    assert distance_km(UserFeat("u", set(), 12.9, 74.8), EventFeat("n", "music", None, None)) is None
    assert distance_km(UserFeat("u", set(), 12.9, 74.8), ev) == pytest.approx(0.0, abs=0.01)


# ---- collaborative filtering ------------------------------------------------------
def test_strength_sums_per_pair_and_is_capped():
    ui, ei = {"u": 0}, {"e": 0}
    many = [Interact("u", "e", "rsvp", NOW)] * 10
    R = cfmod.strength_matrix(many, ui, ei)
    assert R[0, 0] == MAX_STRENGTH
    one = cfmod.strength_matrix([Interact("u", "e", "view", NOW), Interact("u", "e", "bookmark", NOW)], ui, ei)
    assert one[0, 0] == INTERACTION_WEIGHTS["view"] + INTERACTION_WEIGHTS["bookmark"]


def test_unknown_users_and_events_are_ignored():
    R = cfmod.strength_matrix([Interact("ghost", "e", "view", NOW)], {"u": 0}, {"e": 0})
    assert R.nnz == 0


def test_svd_recovers_obvious_block_structure():
    # Two groups of users liking two disjoint groups of events.
    inter = []
    for u in range(6):
        for e in range(4):
            if (u < 3) == (e < 2):
                inter.append(Interact(f"u{u}", f"e{e}", "rsvp", NOW))
    ui = {f"u{i}": i for i in range(6)}
    ei = {f"e{i}": i for i in range(4)}
    model = cfmod.SVDModel(factors=2).fit(cfmod.strength_matrix(inter, ui, ei))
    assert model.scores(0)[0] > model.scores(0)[3]
    assert model.scores(5)[3] > model.scores(5)[0]


def test_svd_on_empty_matrix_does_not_crash():
    model = cfmod.SVDModel().fit(cfmod.strength_matrix([], {"u": 0}, {"e": 0}))
    assert model.scores(0).shape == (1,)


# ---- metrics ------------------------------------------------------------------------
def test_ranking_metrics_on_a_tiny_example():
    ranked = ["a", "b", "c", "d"]
    relevant = {"a", "c"}
    assert metrics.precision_at_k(ranked, relevant, 2) == 0.5
    assert metrics.recall_at_k(ranked, relevant, 2) == 0.5
    assert metrics.recall_at_k(ranked, set(), 2) == 0.0
    # DCG = 1/log2(2) + 1/log2(4) = 1.5 ; ideal = 1 + 1/log2(3) ~ 1.6309
    assert metrics.ndcg_at_k(ranked, relevant, 4) == pytest.approx(1.5 / (1 + 1 / np.log2(3)))
    assert metrics.ndcg_at_k(["x", "y"], relevant, 2) == 0.0


def test_error_metrics():
    y, p = np.array([1.0, 3.0]), np.array([2.0, 5.0])
    assert metrics.mae(y, p) == pytest.approx(1.5)
    assert metrics.rmse(y, p) == pytest.approx(np.sqrt(2.5))


# ---- synthetic data -------------------------------------------------------------------
def test_synthetic_generation_is_reproducible_and_time_ordered():
    a = generate(n_users=30, n_events=20, seed=3)
    b = generate(n_users=30, n_events=20, seed=3)
    assert [(i.user_id, i.event_id, i.kind) for i in a[2]] == [(i.user_id, i.event_id, i.kind) for i in b[2]]
    times = [i.at for i in a[2]]
    assert times == sorted(times)


# ---- reminder windows ---------------------------------------------------------------------
@pytest.mark.parametrize(
    "hours,expected",
    [(30, None), (24.01, None), (24, "24h"), (12, "24h"), (6.01, "24h"), (6, "6h"), (1, "6h"), (0.01, "6h"), (0, None), (-1, None)],
)
def test_reminder_window_boundaries(hours, expected):
    assert _kind_for(timedelta(hours=hours)) == expected


def test_reminder_wording_is_truthful_about_remaining_time():
    assert _when_phrase(timedelta(hours=20)) == "in about 20 hours"
    assert _when_phrase(timedelta(minutes=30)) == "in about 30 minutes"
