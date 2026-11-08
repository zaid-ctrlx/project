"""Shared vocabulary between the two sides of content-based matching.

Users pick interest tags (the `tags` table); events carry a single
`activity_type`. This maps every activity type onto tag slugs - a primary tag
(weight 1.0) plus optional related ones (weight < 1) - so both live in the same
feature space and can be compared with cosine similarity.
"""

ACTIVITY_TAGS: dict[str, dict[str, float]] = {
    "fitness_running": {"running": 1.0, "gym-fitness": 0.4},
    "gym_workout": {"gym-fitness": 1.0},
    "cycling": {"cycling": 1.0, "gym-fitness": 0.3},
    "trekking": {"trekking-hiking": 1.0, "camping": 0.4},
    "camping": {"camping": 1.0, "trekking-hiking": 0.4},
    "travel": {"travel": 1.0, "photography": 0.2},
    "photography": {"photography": 1.0},
    "art_creative": {"art-creative": 1.0},
    "gaming": {"gaming": 1.0, "board-games": 0.3},
    "board_games": {"board-games": 1.0, "gaming": 0.3},
    "tech_coding": {"tech-coding": 1.0, "study-groups": 0.3},
    "study_learning": {"study-groups": 1.0, "books-reading": 0.3},
    "music": {"music": 1.0},
    "cooking": {"cooking": 1.0},
    "books_reading": {"books-reading": 1.0, "study-groups": 0.3},
    "sports": {"sports": 1.0},
    "badminton": {"badminton": 1.0, "sports": 0.5},
    "cricket": {"cricket": 1.0, "sports": 0.5},
    "public_speaking": {"public-speaking": 1.0, "study-groups": 0.2},
    "volunteering": {"volunteering": 1.0},
}

TAG_SLUGS: list[str] = sorted({slug for tags in ACTIVITY_TAGS.values() for slug in tags})
TAG_INDEX: dict[str, int] = {slug: i for i, slug in enumerate(TAG_SLUGS)}

# Tag display names for seeding (slug -> name). Existing slugs keep the names
# already seeded by scripts/seed_tags.py.
TAG_NAMES: dict[str, str] = {
    "running": "Running",
    "gym-fitness": "Gym & Fitness",
    "cycling": "Cycling",
    "trekking-hiking": "Trekking & Hiking",
    "camping": "Camping",
    "travel": "Travel",
    "photography": "Photography",
    "art-creative": "Art & Creative",
    "gaming": "Gaming",
    "board-games": "Board Games",
    "tech-coding": "Tech & Coding",
    "study-groups": "Study Groups",
    "music": "Music",
    "cooking": "Cooking",
    "books-reading": "Books & Reading",
    "sports": "Sports",
    "badminton": "Badminton",
    "cricket": "Cricket",
    "public-speaking": "Public Speaking",
    "volunteering": "Volunteering",
}
