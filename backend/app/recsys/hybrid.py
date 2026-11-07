"""Switching/weighted hybrid (proposal section 3): content-only for new users,
blending in collaborative filtering as their interaction count grows."""
import numpy as np

from app.recsys.config import COLD_START_MIN, FULL_BLEND_AT, MAX_CF_WEIGHT


def cf_weight(n_interactions: int) -> float:
    """0 below COLD_START_MIN; linear ramp to MAX_CF_WEIGHT at FULL_BLEND_AT."""
    if n_interactions < COLD_START_MIN:
        return 0.0
    span = max(FULL_BLEND_AT - COLD_START_MIN, 1)
    return MAX_CF_WEIGHT * min((n_interactions - COLD_START_MIN) / span, 1.0)


def minmax(x: np.ndarray) -> np.ndarray:
    lo, hi = float(x.min()), float(x.max())
    return np.zeros_like(x) if hi - lo < 1e-12 else (x - lo) / (hi - lo)


def blend(content: np.ndarray, cf: np.ndarray, n_interactions: int) -> np.ndarray:
    w = cf_weight(n_interactions)
    return (1 - w) * minmax(content) + w * minmax(cf)
