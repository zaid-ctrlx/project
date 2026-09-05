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
export function listMapItems(kind?: EventKind): Promise<MapItem[]> {
  return api.authed(`/events/map${kind ? `?kind=${kind}` : ""}`);
}
