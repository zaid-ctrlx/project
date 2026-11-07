"""Tunable constants for the recommender. Kept in one place so the evaluation
script and the live endpoint use identical settings."""

# Implicit-feedback strength per interaction kind. A stronger action means a
# stronger statement of interest; repeated actions on the same event sum, then
# are capped (see MAX_STRENGTH) so one obsessive user can't dominate.
INTERACTION_WEIGHTS: dict[str, float] = {
    "view": 1.0,
    "bookmark": 3.0,
    "rsvp": 4.0,
    "join": 4.0,
}
MAX_STRENGTH = 6.0

# Cold-start switch (proposal section 4): below COLD_START_MIN interactions a
# user gets content-based only; the collaborative weight then ramps linearly to
# MAX_CF_WEIGHT by FULL_BLEND_AT interactions.
COLD_START_MIN = 5
FULL_BLEND_AT = 25
MAX_CF_WEIGHT = 0.7

# SVD latent factors (capped at the matrix size at fit time).
SVD_FACTORS = 16

# Content score mix: interest-tag match, distance, recency/upcoming, popularity.
CONTENT_WEIGHTS = {"tags": 0.55, "distance": 0.20, "time": 0.15, "popularity": 0.10}
# Distance (km) at which the distance score has decayed to ~0.37 (e^-1).
DISTANCE_SCALE_KM = 25.0
