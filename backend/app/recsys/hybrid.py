"""Switching/weighted hybrid (proposal section 3): content-only for new users,
blending in collaborative filtering as their interaction count grows."""
import numpy as np

from app.recsys.config import COLD_START_MIN, FULL_BLEND_AT, MAX_CF_WEIGHT


def cf_weight(
    n_interactions: int, max_weight: float = MAX_CF_WEIGHT, full_at: int = FULL_BLEND_AT, start: int = COLD_START_MIN
) -> float:
    """0 below `start` (cold-start rule); linear ramp to `max_weight` at `full_at`."""
    if n_interactions < start:
        return 0.0
    span = max(full_at - start, 1)
    return max_weight * min((n_interactions - start) / span, 1.0)


def minmax(x: np.ndarray) -> np.ndarray:
    lo, hi = float(x.min()), float(x.max())
    return np.zeros_like(x) if hi - lo < 1e-12 else (x - lo) / (hi - lo)


def blend(
    content: np.ndarray,
    cf: np.ndarray,
    n_interactions: int,
    max_weight: float = MAX_CF_WEIGHT,
    full_at: int = FULL_BLEND_AT,
) -> np.ndarray:
    w = cf_weight(n_interactions, max_weight, full_at)
    return (1 - w) * minmax(content) + w * minmax(cf)
