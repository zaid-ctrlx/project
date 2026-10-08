// Discover map's geographic scope. Mirrors backend/app/core/geo.py's
// ENABLED_REGIONS / INDIA_BOUNDS — kept in sync by hand, same pattern as
// eventTags.ts mirroring ACTIVITY_TYPE_OPTIONS. Adding another enabled state
// later means adding it here too (and to the backend), nothing else about
// the map screen needs to change.

export type LatLngRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

// Initial camera position for the Discover map — centered/zoomed on
// Karnataka rather than the whole world or all of India, per the initial
// rollout scope.
export const KARNATAKA_INITIAL_REGION: LatLngRegion = {
  latitude: 15.317,
  longitude: 75.714,
  latitudeDelta: 6.5,
  longitudeDelta: 6.5,
};

// Roughly all of India — used only as the map's outer pan/zoom boundary so
// the view doesn't wander off to unrelated parts of the world; the *real*
// content gate is server-side (GET /events/map only ever returns items
// inside an enabled region).
export const INDIA_BOUNDARY = {
  northEast: { latitude: 37.6, longitude: 97.5 },
  southWest: { latitude: 6.5, longitude: 68.0 },
};

// Mirrors backend/app/core/geo.py ENABLED_REGIONS (the real gate is
// server-side; this just lets the creation flow reject a bad pick early with
// a clear message instead of waiting for a 422).
export const ENABLED_REGIONS: Record<string, { label: string; minLat: number; maxLat: number; minLng: number; maxLng: number }> = {
  karnataka: { label: "Karnataka", minLat: 11.3, maxLat: 18.5, minLng: 74.0, maxLng: 78.6 },
};

export function isWithinEnabledRegion(lat: number, lng: number): boolean {
  return Object.values(ENABLED_REGIONS).some((r) => lat >= r.minLat && lat <= r.maxLat && lng >= r.minLng && lng <= r.maxLng);
}

export function enabledRegionLabels(): string {
  return Object.values(ENABLED_REGIONS).map((r) => r.label).join(", ");
}
