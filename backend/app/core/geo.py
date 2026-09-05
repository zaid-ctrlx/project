# Geographic scope for location-bearing content (event/community physical
# locations, and by extension the Discover map — see app/schemas/map.py and
# GET /events/map in app/api/routes/events.py).
#
# Deliberately a plain dict of simple lat/lng bounding boxes, not a real
# polygon/GIS boundary — Karnataka's actual border is irregular, but a
# bounding box is enough to keep out-of-state locations from being created
# for this pass, and keeps the check dependency-free (no PostGIS/shapely).
# Enabling another state later is just adding an entry here; every call site
# (EventCreate's validator, GET /events/map) already loops over all enabled
# regions instead of hardcoding "karnataka", so no other code needs to change.
#
# Bounds are intentionally generous (drawn a little outside Karnataka's real
# border) so legitimate border-town locations aren't rejected by a tight box.
ENABLED_REGIONS: dict[str, dict] = {
    "karnataka": {
        "label": "Karnataka",
        "min_lat": 11.3,
        "max_lat": 18.5,
        "min_lng": 74.0,
        "max_lng": 78.6,
    },
}

# Loose full-India box — not used to gate creation (ENABLED_REGIONS is
# stricter and is the real gate), but kept as the map's outer viewport limit
# and for the "India only" framing in error messages.
INDIA_BOUNDS: dict[str, float] = {
    "min_lat": 6.5,
    "max_lat": 37.6,
    "min_lng": 68.0,
    "max_lng": 97.5,
}


def is_within_enabled_region(lat: float, lng: float) -> bool:
    """True if (lat, lng) falls inside any currently-enabled region's
    bounding box. Used both to validate new event/community locations
    (app/schemas/event.py) and to filter what the Discover map returns
    (GET /events/map) — kept as one function so both stay in sync."""
    return any(
        region["min_lat"] <= lat <= region["max_lat"] and region["min_lng"] <= lng <= region["max_lng"]
        for region in ENABLED_REGIONS.values()
    )


def enabled_region_labels() -> list[str]:
    """Human-readable names of the currently-enabled regions, e.g. for a
    validation error message ("location must be within: Karnataka")."""
    return [region["label"] for region in ENABLED_REGIONS.values()]
