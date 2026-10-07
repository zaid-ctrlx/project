import httpx
from fastapi import APIRouter, HTTPException, Query, status

from app.core.geo import ENABLED_REGIONS, is_within_enabled_region
from app.schemas.geocode import GeocodeResult, ReverseGeocodeOut

router = APIRouter(prefix="/geocode", tags=["geocode"])

# Free, no API key. Their usage policy requires a real User-Agent and caps
# ~1 req/sec — fine for dev/FYP scale. Swap for a paid provider (Mapbox,
# Google) before any real traffic.
NOMINATIM_BASE = "https://nominatim.openstreetmap.org"
HEADERS = {"User-Agent": "niche-events-fyp/0.1 (dev)"}
TIMEOUT = 5.0

# Nominatim's "importance" is a 0..1 ranking score. Very low values are
# obscure/ambiguous matches (a random street in another town sharing the
# typed name), which the plan says must not be offered for publishing.
MIN_IMPORTANCE = 0.1
# Nominatim viewbox is "left,top,right,bottom" = min_lng,max_lat,max_lng,min_lat.
# Built from ENABLED_REGIONS so enabling another state widens search with no
# change here. A single box covering all enabled regions.
def _viewbox() -> str:
    regions = list(ENABLED_REGIONS.values())
    return "{},{},{},{}".format(
        min(r["min_lng"] for r in regions),
        max(r["max_lat"] for r in regions),
        max(r["max_lng"] for r in regions),
        min(r["min_lat"] for r in regions),
    )


def _short_label(address: dict, display_name: str) -> str:
    city = address.get("city") or address.get("town") or address.get("village") or address.get("suburb")
    region = address.get("state") or address.get("region")
    country = address.get("country")
    parts = [p for p in (city, region, country) if p]
    return ", ".join(parts) if parts else display_name


@router.get("/reverse", response_model=ReverseGeocodeOut)
async def reverse_geocode(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
) -> ReverseGeocodeOut:
    params = {"format": "jsonv2", "lat": lat, "lon": lng, "addressdetails": 1, "accept-language": "en"}
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(f"{NOMINATIM_BASE}/reverse", params=params, headers=HEADERS)
        resp.raise_for_status()
        data = resp.json()
    except httpx.HTTPError:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Geocoding service unavailable")

    if "error" in data:
        # Valid response, just nothing found at these coordinates (e.g. open ocean).
        return ReverseGeocodeOut(label=f"{lat:.4f}, {lng:.4f}")

    label = _short_label(data.get("address", {}), data.get("display_name", f"{lat:.4f}, {lng:.4f}"))
    return ReverseGeocodeOut(label=label)


@router.get("/search", response_model=list[GeocodeResult])
async def search_location(
    q: str = Query(..., min_length=1, max_length=200),
    restrict: bool = Query(default=False),
) -> list[GeocodeResult]:
    # restrict=true is for event/community creation: only confident matches
    # inside the enabled map regions. Profile/onboarding search stays
    # India-wide.
    # India-only app — countrycodes restricts Nominatim's results to India
    # so searching "Springfield" or "Paris" doesn't surface international
    # matches. Doesn't touch /reverse below: that's driven by GPS
    # coordinates the device already reports, which in practice are always
    # within India for this app's real users.
    # viewbox + bounded=1 limits matches to the enabled regions, so a search
    # for "Springfield" can't surface a place in another state.
    params = {
        "format": "jsonv2", "q": q, "limit": 8, "addressdetails": 1, "accept-language": "en",
        "countrycodes": "in",
    }
    if restrict:
        params.update({"viewbox": _viewbox(), "bounded": 1})
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(f"{NOMINATIM_BASE}/search", params=params, headers=HEADERS)
        resp.raise_for_status()
        data = resp.json()
    except httpx.HTTPError:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Geocoding service unavailable")

    results: list[GeocodeResult] = []
    for item in data:
        lat, lng = float(item["lat"]), float(item["lon"])
        # Drop low-confidence matches and anything outside the enabled
        # regions (the bounding box is rectangular, so double-check).
        if restrict and (float(item.get("importance", 0) or 0) < MIN_IMPORTANCE or not is_within_enabled_region(lat, lng)):
            continue
        results.append(GeocodeResult(label=_short_label(item.get("address", {}), item["display_name"]), lat=lat, lng=lng))
    return results[:5]
