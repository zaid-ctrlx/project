import httpx
from fastapi import APIRouter, HTTPException, Query, status

from app.schemas.geocode import GeocodeResult, ReverseGeocodeOut

router = APIRouter(prefix="/geocode", tags=["geocode"])

# Free, no API key. Their usage policy requires a real User-Agent and caps
# ~1 req/sec — fine for dev/FYP scale. Swap for a paid provider (Mapbox,
# Google) before any real traffic.
NOMINATIM_BASE = "https://nominatim.openstreetmap.org"
HEADERS = {"User-Agent": "niche-events-fyp/0.1 (dev)"}
TIMEOUT = 5.0


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
async def search_location(q: str = Query(..., min_length=1, max_length=200)) -> list[GeocodeResult]:
    # India-only app — countrycodes restricts Nominatim's results to India
    # so searching "Springfield" or "Paris" doesn't surface international
    # matches. Doesn't touch /reverse below: that's driven by GPS
    # coordinates the device already reports, which in practice are always
    # within India for this app's real users.
    params = {"format": "jsonv2", "q": q, "limit": 5, "addressdetails": 1, "accept-language": "en", "countrycodes": "in"}
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(f"{NOMINATIM_BASE}/search", params=params, headers=HEADERS)
        resp.raise_for_status()
        data = resp.json()
    except httpx.HTTPError:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Geocoding service unavailable")

    return [
        GeocodeResult(
            label=_short_label(item.get("address", {}), item["display_name"]),
            lat=float(item["lat"]),
            lng=float(item["lon"]),
        )
        for item in data
    ]
