import { api } from "./client";
import { ActivityType, EventKind } from "./events";

// Map-ready shape for the Discover map — deliberately slimmer than Event
// (see backend/app/schemas/map.py's MapItemOut): no creator info, no
// bookmark/RSVP/join flags, no cover image, and never any user-location
// data. `type`/`name`/`latitude`/`longitude` naming matches the map's own
// vocabulary rather than Event's kind/title/location_lat/location_lng.
export type MapItem = {
  id: string;
  type: EventKind;
  name: string;
  latitude: number;
  longitude: number;
  location_name: string | null;
  description: string | null;
  start_date: string | null; // events only
  category: ActivityType | null; // events only
  attendee_count: number | null; // events only
  member_count: number | null; // communities only
};

// Only returns events/communities inside a currently-enabled geographic
// region (Karnataka for now — see backend/app/core/geo.py) with a real
// physical location; never online events, never individual users.
// Repeated map opens reuse the last response for a minute instead of
// refetching unchanged data; `force` (pull/retry) bypasses it.
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { at: number; items: MapItem[] }>();

export async function listMapItems(kind?: EventKind, force = false): Promise<MapItem[]> {
  const key = kind ?? "all";
  const hit = cache.get(key);
  if (!force && hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.items;
  const items = await api.authed(`/events/map${kind ? `?kind=${kind}` : ""}`);
  cache.set(key, { at: Date.now(), items });
  return items;
}

export function invalidateMapCache(): void {
  cache.clear();
}
